
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { database } from '../config/database';

export class AuthService {
  private accessTokenSecret = process.env.JWT_ACCESS_SECRET || 'dev-secret-change-in-production';
  private refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production';

  constructor() {
    if (process.env.NODE_ENV === 'production' && (this.accessTokenSecret === 'dev-secret-change-in-production' || this.refreshTokenSecret === 'dev-refresh-secret-change-in-production')) {
      console.error('⚠️  WARNING: Using default JWT secrets in production! Please set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET environment variables.');
    }
  }

  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 12);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  async generateTokens(user: any) {
    const payload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      ...(user.role ? { role: user.role } : {
        tenantId: user.tenant_id,
        accountType: user.account_type,
      }),
    };

    const accessToken = jwt.sign(payload, this.accessTokenSecret, { 
      expiresIn: process.env.JWT_ACCESS_EXPIRES || '24h',
      issuer: 'legalsaas',
      audience: 'legalsaas-users'
    });
    
    const refreshToken = jwt.sign(payload, this.refreshTokenSecret, { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
      issuer: 'legalsaas',
      audience: 'legalsaas-users'
    });

    // Store refresh token in database
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    try {
      await database.createRefreshToken({
        tokenHash,
        userId: user.id,
        expiresAt: expiresAt.toISOString(),
        isActive: true
      });
    } catch (error) {
      console.error('Error storing refresh token:', error);
    }

    return { accessToken, refreshToken };
  }

  async verifyAccessToken(token: string): Promise<any> {
    try {
      return jwt.verify(token, this.accessTokenSecret, {
        issuer: 'legalsaas',
        audience: 'legalsaas-users'
      });
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  async verifyRefreshToken(token: string): Promise<any> {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: 'legalsaas',
        audience: 'legalsaas-users'
      });

      // Verify token exists in database and is active
      const tokenHash = await bcrypt.hash(token, 10);
      const storedToken = await database.findValidRefreshToken(tokenHash);
      
      if (!storedToken) {
        throw new Error('Refresh token not found or expired');
      }

      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  async refreshTokens(refreshToken: string) {
    const decoded = await this.verifyRefreshToken(refreshToken);
    
    // Get fresh user data
    const user = await database.findUserByEmail(decoded.email);
    if (!user || !user.is_active) {
      throw new Error('User not found or inactive');
    }

    // Revoke old refresh token
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    await database.revokeRefreshToken(tokenHash);

    // Generate new tokens
    const tokens = await this.generateTokens(user);
    
    return { user, tokens };
  }

  async revokeAllTokens(userId: string, isAdmin: boolean = false) {
    try {
      if (isAdmin) {
        // Handle admin token revocation if needed
        console.log('Revoking admin tokens for user:', userId);
      } else {
        await database.revokeAllUserTokens(userId);
      }
    } catch (error) {
      console.error('Error revoking tokens:', error);
    }
  }

  async loginUser(email: string, password: string) {
    const user = await database.findUserByEmail(email);
    
    if (!user) {
      // Use a generic error to prevent email enumeration
      throw new Error('Invalid credentials');
    }

    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    const isValidPassword = await this.verifyPassword(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await database.updateUserLastLogin(user.id);

    const tokens = await this.generateTokens(user);
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    
    return { user: userWithoutPassword, tokens };
  }

  async loginAdmin(email: string, password: string) {
    const admin = await database.findAdminByEmail(email);
    
    if (!admin) {
      throw new Error('Invalid admin credentials');
    }

    if (!admin.is_active) {
      throw new Error('Admin account is deactivated');
    }

    const isValidPassword = await this.verifyPassword(password, admin.password);
    if (!isValidPassword) {
      throw new Error('Invalid admin credentials');
    }

    // Update last login
    await database.updateAdminLastLogin(admin.id);

    const tokens = await this.generateTokens(admin);
    
    // Remove password from response
    const { password: _, ...adminWithoutPassword } = admin;
    
    return { user: adminWithoutPassword, tokens };
  }

  async registerUser(email: string, password: string, name: string, key: string) {
    // Validate registration key
    const validKeys = await database.findValidRegistrationKeys();
    const registrationKey = validKeys.find(k => 
      k.key_hash && bcrypt.compareSync(key, k.key_hash)
    );

    if (!registrationKey) {
      throw new Error('Invalid or expired registration key');
    }

    // Check if user already exists
    const existingUser = await database.findUserByEmail(email);
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    const hashedPassword = await this.hashPassword(password);
    
    let tenant;
    let isNewTenant = false;

    // Create or use existing tenant
    if (registrationKey.tenant_id) {
      // Use existing tenant
      const tenants = await database.getAllTenants();
      tenant = tenants.find(t => t.id === registrationKey.tenant_id);
      if (!tenant) {
        throw new Error('Associated tenant not found');
      }
    } else {
      // Create new tenant
      tenant = await database.createTenant({
        name: `${name}'s Law Firm`,
        schema_name: `tenant_${Date.now()}`,
        plan_type: 'basic',
        is_active: true,
        max_users: 5,
        max_storage: 1073741824, // 1GB
      });
      isNewTenant = true;
    }

    // Create user
    const userData = {
      email,
      password: hashedPassword,
      name,
      account_type: registrationKey.account_type,
      tenant_id: tenant.id,
      is_active: true,
      must_change_password: false,
    };

    const user = await database.createUser(userData);

    // Update registration key usage
    await database.updateRegistrationKeyUsage(registrationKey.id, {
      uses_left: registrationKey.uses_left - 1,
      used_logs: JSON.stringify([
        ...(registrationKey.used_logs ? JSON.parse(registrationKey.used_logs) : []),
        {
          userId: user.id,
          email: user.email,
          usedAt: new Date().toISOString()
        }
      ])
    });

    const tokens = await this.generateTokens(user);
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    
    return { user: userWithoutPassword, tokens, isNewTenant };
  }
}

export const authService = new AuthService();
