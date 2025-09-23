import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

console.log('Database config loaded:', {
  url: databaseUrl?.substring(0, 50) + '...',
  environment: process.env.NODE_ENV
});

// Main Prisma client for all operations
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  }
});

// Database operations using Prisma
export class Database {
  private static instance: Database;

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  async testConnection() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('✅ Database connection successful');
      return true;
    } catch (error) {
      console.error('❌ Database connection test failed:', error);
      return false;
    }
  }

  // Admin operations
  async findAdminByEmail(email: string) {
    try {
      const admin = await prisma.adminUser.findUnique({
        where: { email }
      });
      return admin;
    } catch (error) {
      console.error('Error in findAdminByEmail:', error);
      return null;
    }
  }

  async createAdminUser(userData: any) {
    try {
      const admin = await prisma.adminUser.create({
        data: userData
      });
      return admin;
    } catch (error) {
      console.error('Error creating admin user:', error);
      throw error;
    }
  }

  async updateAdminLastLogin(id: string) {
    try {
      await prisma.adminUser.update({
        where: { id },
        data: { lastLogin: new Date() }
      });
    } catch (error) {
      console.error('Error updating admin last login:', error);
      throw error;
    }
  }

  // User operations
  async findUserByEmail(email: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        include: { tenant: true }
      });
      return user;
    } catch (error) {
      console.error('Error in findUserByEmail:', error);
      return null;
    }
  }

  async createUser(userData: any) {
    try {
      const user = await prisma.user.create({
        data: userData,
        include: { tenant: true }
      });
      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUserLastLogin(id: string) {
    try {
      await prisma.user.update({
        where: { id },
        data: { lastLogin: new Date() }
      });
    } catch (error) {
      console.error('Error updating user last login:', error);
      throw error;
    }
  }

  // Tenant operations
  async getAllTenants() {
    try {
      const tenants = await prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' }
      });
      return { rows: tenants };
    } catch (error) {
      console.error('Error getting all tenants:', error);
      throw error;
    }
  }

  async getAllUsers() {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          accountType: true,
          tenantId: true,
          isActive: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      });
      return { rows: users };
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  }

  async createTenant(tenantData: any) {
    try {
      const tenant = await prisma.tenant.create({
        data: tenantData
      });
      return tenant;
    } catch (error) {
      console.error('Error creating tenant:', error);
      throw error;
    }
  }

  async updateTenant(id: string, updateData: any) {
    try {
      const tenant = await prisma.tenant.update({
        where: { id },
        data: {
          ...updateData,
          updatedAt: new Date()
        }
      });
      return tenant;
    } catch (error) {
      console.error('Error updating tenant:', error);
      throw error;
    }
  }

  async deleteTenant(id: string) {
    try {
      await prisma.tenant.delete({
        where: { id }
      });
    } catch (error) {
      console.error('Error deleting tenant:', error);
      throw error;
    }
  }

  // Registration keys operations
  async getAllRegistrationKeys() {
    try {
      const keys = await prisma.registrationKey.findMany({
        include: { tenant: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
      });
      return keys;
    } catch (error) {
      console.error('Error getting registration keys:', error);
      return [];
    }
  }

  async createRegistrationKey(keyData: any) {
    try {
      const key = await prisma.registrationKey.create({
        data: keyData
      });
      return key;
    } catch (error) {
      console.error('Error creating registration key:', error);
      throw error;
    }
  }

  async revokeRegistrationKey(id: string) {
    try {
      await prisma.registrationKey.update({
        where: { id },
        data: { revoked: true }
      });
    } catch (error) {
      console.error('Error revoking registration key:', error);
      throw error;
    }
  }

  async findValidRegistrationKeys() {
    try {
      const keys = await prisma.registrationKey.findMany({
        where: {
          revoked: false,
          usesLeft: { gt: 0 },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      });
      return keys;
    } catch (error) {
      console.error('Error finding valid registration keys:', error);
      return [];
    }
  }

  async updateRegistrationKeyUsage(id: string, updateData: any) {
    try {
      await prisma.registrationKey.update({
        where: { id },
        data: updateData
      });
    } catch (error) {
      console.error('Error updating registration key usage:', error);
      throw error;
    }
  }

  // Refresh tokens operations
  async createRefreshToken(tokenData: any) {
    try {
      const token = await prisma.refreshToken.create({
        data: tokenData
      });
      return token;
    } catch (error) {
      console.error('Error creating refresh token:', error);
      throw error;
    }
  }

  async findValidRefreshToken(tokenHash: string) {
    try {
      const token = await prisma.refreshToken.findFirst({
        where: {
          tokenHash,
          isActive: true,
          expiresAt: { gt: new Date() }
        },
        include: { user: true }
      });
      return token;
    } catch (error) {
      console.error('Error in findValidRefreshToken:', error);
      return null;
    }
  }

  async revokeAllUserTokens(userId: string) {
    try {
      await prisma.refreshToken.updateMany({
        where: { userId },
        data: { isActive: false }
      });
    } catch (error) {
      console.error('Error revoking user tokens:', error);
      throw error;
    }
  }

  async revokeRefreshToken(tokenHash: string) {
    try {
      await prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { isActive: false }
      });
    } catch (error) {
      console.error('Error revoking refresh token:', error);
      throw error;
    }
  }

  // Audit logs
  async createAuditLog(logData: any) {
    try {
      const log = await prisma.auditLog.create({
        data: logData
      });
      return log;
    } catch (error) {
      console.error('Error creating audit log:', error);
      throw error;
    }
  }

  // System logs
  async createSystemLog(logData: any) {
    try {
      const log = await prisma.systemLog.create({
        data: logData
      });
      return log;
    } catch (error) {
      console.error('Error creating system log:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        database: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        database: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Raw query execution for complex operations
  async query(query: string, params: any[] = []) {
    try {
      const result = await prisma.$queryRawUnsafe(query, ...params);
      return { rows: result };
    } catch (error) {
      console.error('Error executing raw query:', error);
      throw error;
    }
  }
}

export const database = Database.getInstance();

// Initialize connection test
database.testConnection().then(result => {
  if (result) {
    console.log('✅ Database connected successfully');
  } else {
    console.log('❌ Database connection failed');
  }
});

// Tenant Database operations for multi-tenancy
export class TenantDatabase {
  constructor(private tenantId: string) {}

  async executeInTenantSchema<T = any>(query: string, params: any[] = []): Promise<T[]> {
    try {
      const schemaName = `tenant_${this.tenantId}`;
      const finalQuery = query.replace(/\$\{schema\}/g, schemaName);

      console.log(`Executing query in schema ${schemaName}:`, finalQuery);

      const result = await prisma.$queryRawUnsafe<T[]>(finalQuery, ...params);
      return result || [];
    } catch (error) {
      console.error('Error executing tenant query:', error);
      throw error;
    }
  }

  async query<T = any>(query: string, params: any[] = []): Promise<T[]> {
    try {
      const result = await prisma.$queryRawUnsafe<T[]>(query, ...params);
      return result || [];
    } catch (error) {
      console.error('Error executing query:', error);
      throw error;
    }
  }
}

// Export tenant database factory
export const tenantDB = {
  executeInTenantSchema: <T = any>(tenantId: string, query: string, params: any[] = []): Promise<T[]> => {
    const db = new TenantDatabase(tenantId);
    return db.executeInTenantSchema<T>(query, params);
  }
};