import { Request, Response } from 'express';
import { z } from 'zod';
import { authService } from '../services/authService';
import { database } from '../database'; // Assuming database is imported here

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  key: z.string().min(1, 'Registration key is required'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      console.log('Registration attempt:', { email: req.body.email, name: req.body.name });

      const validatedData = registerSchema.parse(req.body);
      const keyRecord = await database.getRegistrationKey(validatedData.key);

      if (!keyRecord) {
        return res.status(400).json({ error: 'Invalid registration key' });
      }

      const hashedPassword = await authService.hashPassword(validatedData.password);

      // 4. Create tenant if key doesn't have one
      let tenantId = keyRecord.tenant_id;
      let tenantName = 'Default Tenant';

      if (!tenantId) {
        // Create new tenant
        const { tenantService } = await import('../services/tenantService');
        const newTenantId = await tenantService.createTenant(`${validatedData.name}'s Organization`);
        console.log('Created new tenant:', newTenantId);

        // Update key with new tenantId
        await database.updateRegistrationKeyTenant(validatedData.key, newTenantId);
        tenantId = newTenantId;

        // Get tenant name
        const tenants = await database.getAllTenants();
        const tenant = tenants.rows.find(t => t.id === tenantId);
        tenantName = tenant?.name || 'Default Tenant';
      } else {
        // Get existing tenant name
        const tenants = await database.getAllTenants();
        const tenant = tenants.rows.find(t => t.id === tenantId);
        tenantName = tenant?.name || 'Default Tenant';
      }

      // 5. Create user
      const userData = {
        email: validatedData.email,
        password: hashedPassword,
        name: validatedData.name,
        accountType: keyRecord.account_type as any,
        tenantId: tenantId,
        isActive: true,
        mustChangePassword: false,
      };

      console.log('Creating user with data:', userData);
      const user = await database.createUser(userData);

      const tokens = await authService.generateTokens(user.id, user.account_type, user.tenantId);

      console.log('Registration successful:', { userId: user.id, tenantId: user.tenant_id });

      res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          accountType: user.accountType,
          tenantId: user.tenantId,
          tenantName: tenantName,
        },
        tokens,
        isNewTenant: !keyRecord.tenant_id, // Indicate if a new tenant was created
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Registration failed',
      });
    }
  }

  async login(req: Request, res: Response) {
    try {
      console.log('Login attempt:', { email: req.body.email });

      const validatedData = loginSchema.parse(req.body);

      const { user, tokens } = await authService.loginUser(validatedData.email, validatedData.password);

      // Fetch tenant name
      let tenantName = 'Default Tenant';
      if (user.tenantId) {
        const tenants = await database.getAllTenants();
        const tenant = tenants.rows.find(t => t.id === user.tenantId);
        tenantName = tenant?.name || 'Default Tenant';
      }

      console.log('Login successful:', { userId: user.id, tenantId: user.tenant_id });

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          accountType: user.accountType,
          tenantId: user.tenantId,
          tenantName: tenantName,
        },
        tokens,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Login failed',
      });
    }
  }

  async refresh(req: Request, res: Response) {
    try {
      const validatedData = refreshSchema.parse(req.body);

      const { user, tokens } = await authService.refreshTokens(validatedData.refreshToken);

      // Fetch tenant name
      let tenantName = 'Default Tenant';
      if (user.tenantId) {
        const tenants = await database.getAllTenants();
        const tenant = tenants.rows.find(t => t.id === user.tenantId);
        tenantName = tenant?.name || 'Default Tenant';
      }

      res.json({
        message: 'Tokens refreshed',
        user: {
          ...user,
          tenantName: tenantName,
        },
        tokens,
      });
    } catch (error) {
      console.error('Refresh error:', error);
      res.status(401).json({
        error: error instanceof Error ? error.message : 'Token refresh failed',
      });
    }
  }

  async logout(req: Request, res: Response) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.split(' ')[1];

      if (token) {
        try {
          const decoded = await authService.verifyAccessToken(token);
          await authService.revokeAllTokens(decoded.userId, !!decoded.role);
        } catch (error) {
          console.error('Error revoking tokens during logout:', error);
        }
      }

      res.json({ message: 'Logout successful' });
    } catch (error) {
      // Even if token verification fails, return success for logout
      res.json({ message: 'Logout successful' });
    }
  }

  async getProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Fetch tenant name
      let tenantName = 'Default Tenant';
      if ((req as any).user?.tenantId) {
        const tenants = await database.getAllTenants();
        const tenant = tenants.rows.find(t => t.id === (req as any).user?.tenantId);
        tenantName = tenant?.name || 'Default Tenant';
      }

      // Return user profile
      const user = {
        id: userId,
        email: (req as any).user?.email || 'user@example.com',
        name: (req as any).user?.name || 'User',
        accountType: (req as any).user?.accountType || 'SIMPLES',
        tenantId: (req as any).user?.tenantId || 'default',
        tenantName: tenantName,
      };

      res.json({ user });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        error: 'Failed to get profile',
      });
    }
  }

  async updateProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      res.json({
        message: 'Profile updated successfully',
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(400).json({
        error: 'Failed to update profile',
      });
    }
  }
}

export const authController = new AuthController();