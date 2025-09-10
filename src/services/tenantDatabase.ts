import { PrismaClient } from '@prisma/client';

// Cache de clientes Prisma por tenant
const tenantPrismaClients = new Map<string, PrismaClient>();

export class TenantDatabaseService {
  private static instance: TenantDatabaseService;

  static getInstance(): TenantDatabaseService {
    if (!TenantDatabaseService.instance) {
      TenantDatabaseService.instance = new TenantDatabaseService();
    }
    return TenantDatabaseService.instance;
  }

  // Validar e normalizar tenant ID para segurança
  private validateAndNormalizeTenantId(tenantId: string): string {
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error('Tenant ID is required and must be a string');
    }
    
    // Validação rigorosa: apenas alfanuméricos e hífens
    if (!/^[a-zA-Z0-9-]+$/.test(tenantId)) {
      throw new Error('Invalid tenant ID format. Only alphanumeric characters and hyphens allowed.');
    }
    
    // Validar comprimento
    if (tenantId.length === 0 || tenantId.length > 50) {
      throw new Error('Tenant ID must be between 1 and 50 characters');
    }
    
    // Normalizar removendo hífens
    const normalized = tenantId.replace(/-/g, '');
    if (normalized.length === 0) {
      throw new Error('Tenant ID cannot be only hyphens');
    }
    
    return normalized;
  }

  // Obter cliente Prisma para um tenant específico
  getTenantPrisma(tenantId: string): PrismaClient {
    // Validar tenant ID primeiro
    this.validateAndNormalizeTenantId(tenantId);

    // Verificar se já existe um cliente no cache
    if (tenantPrismaClients.has(tenantId)) {
      return tenantPrismaClients.get(tenantId)!;
    }

    // Criar novo cliente Prisma
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });

    // Adicionar ao cache
    tenantPrismaClients.set(tenantId, prisma);
    
    return prisma;
  }

  // Executar query raw com schema do tenant
  async executeInTenantSchema<T>(
    tenantId: string, 
    query: string, 
    params: any[] = []
  ): Promise<T[]> {
    const prisma = this.getTenantPrisma(tenantId);
    
    // Validar e normalizar tenant ID de forma segura
    const normalizedTenantId = this.validateAndNormalizeTenantId(tenantId);
    const schemaName = `tenant_${normalizedTenantId}`;
    
    // Substituir placeholder ${schema} pela schema validada do tenant
    const finalQuery = query.replace(/\$\{schema\}/g, schemaName);
    
    try {
      const result = await prisma.$queryRawUnsafe<T[]>(finalQuery, ...params);
      return result;
    } catch (error) {
      console.error(`Error executing query in tenant ${tenantId}:`, error);
      throw error;
    }
  }

  // Limpar cache de conexões (para graceful shutdown)
  async cleanup() {
    for (const [tenantId, client] of tenantPrismaClients.entries()) {
      try {
        await client.$disconnect();
        tenantPrismaClients.delete(tenantId);
      } catch (error) {
        console.error(`Error disconnecting client for tenant ${tenantId}:`, error);
      }
    }
  }
}

// Instância singleton
export const tenantDB = TenantDatabaseService.getInstance();