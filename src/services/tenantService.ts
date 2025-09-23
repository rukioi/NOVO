import { database, TenantDatabase } from '../config/database';

export class TenantService {
  async createTenant(name: string): Promise<string> {
    const tenantData = {
      name,
      schema_name: `tenant_${Date.now()}`,
      is_active: true,
      plan_type: 'basic',
      max_users: 5,
      max_storage: 1073741824, // 1GB
    };

    const tenant = await database.createTenant(tenantData);
    return tenant.id;
  }

  async getTenantDatabase(tenantId: string): Promise<TenantDatabase> {
    return new TenantDatabase(tenantId);
  }

  async getAllTenants() {
    return await database.getAllTenants();
  }

  async updateTenant(id: string, updateData: any) {
    return await database.updateTenant(id, updateData);
  }

  async deleteTenant(id: string) {
    return await database.deleteTenant(id);
  }

  async getTenantStats(tenantId: string) {
    try {
      const tenantDB = await this.getTenantDatabase(tenantId);
      
      // Buscar estatísticas reais do tenant
      const statsQuery = `
        SELECT 
          COALESCE((SELECT COUNT(*) FROM \${schema}.clients WHERE is_active = true), 0) as clients,
          COALESCE((SELECT COUNT(*) FROM \${schema}.projects WHERE is_active = true), 0) as projects,
          COALESCE((SELECT COUNT(*) FROM \${schema}.tasks WHERE is_active = true), 0) as tasks,
          COALESCE((SELECT COUNT(*) FROM \${schema}.transactions WHERE is_active = true), 0) as transactions,
          COALESCE((SELECT COUNT(*) FROM \${schema}.invoices WHERE is_active = true), 0) as invoices
      `;
      
      const result = await tenantDB.query(statsQuery);
      
      if (result && result[0]) {
        return {
          clients: parseInt(result[0].clients || '0'),
          projects: parseInt(result[0].projects || '0'),
          tasks: parseInt(result[0].tasks || '0'),
          transactions: parseInt(result[0].transactions || '0'),
          invoices: parseInt(result[0].invoices || '0'),
        };
      }
    } catch (error) {
      console.warn(`Error fetching tenant stats for ${tenantId}:`, error);
    }
    
    // Fallback para stats zerados se houver erro
    return {
      clients: 0,
      projects: 0,
      tasks: 0,
      transactions: 0,
      invoices: 0,
    };
  }
}

export const tenantService = new TenantService();