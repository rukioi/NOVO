/**
 * PROJECTS SERVICE - GESTÃO DE PROJETOS
 * ====================================
 * 
 * Serviço responsável por operações de banco de dados relacionadas aos projetos.
 * Substitui os dados mock por operações reais com PostgreSQL usando isolamento por tenant.
 */

import { tenantDB } from './tenantDatabase';

export interface Project {
  id: string;
  title: string;
  description?: string;
  client_name: string;
  client_id?: string;
  organization?: string;
  address?: string;
  budget?: number;
  currency?: 'BRL' | 'USD' | 'EUR';
  status: 'contacted' | 'proposal' | 'won' | 'lost';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  start_date?: string;
  due_date?: string;
  tags: string[];
  assigned_to: string[];
  notes?: string;
  contacts: ProjectContact[];
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface ProjectContact {
  name: string;
  email: string;
  phone: string;
  role: string;
}

export interface CreateProjectData {
  title: string;
  description?: string;
  clientName: string;
  clientId?: string;
  organization?: string;
  address?: string;
  budget?: number;
  currency?: 'BRL' | 'USD' | 'EUR';
  status?: 'contacted' | 'proposal' | 'won' | 'lost';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  startDate?: string;
  dueDate?: string;
  tags?: string[];
  assignedTo?: string[];
  notes?: string;
  contacts?: ProjectContact[];
}

export interface UpdateProjectData extends Partial<CreateProjectData> {}

export interface ProjectFilters {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  search?: string;
  tags?: string[];
  assignedTo?: string[];
}

export class ProjectsService {
  private tableName = 'projects';

  /**
   * Cria as tabelas necessárias se não existirem
   */
  async initializeTables(tenantId: string): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS \${schema}.${this.tableName} (
        id VARCHAR PRIMARY KEY,
        title VARCHAR NOT NULL,
        description TEXT,
        client_name VARCHAR NOT NULL,
        client_id VARCHAR,
        organization VARCHAR,
        address TEXT,
        budget DECIMAL(15,2),
        currency VARCHAR(3) DEFAULT 'BRL',
        status VARCHAR DEFAULT 'contacted',
        priority VARCHAR DEFAULT 'medium',
        start_date DATE,
        due_date DATE,
        tags JSONB DEFAULT '[]',
        assigned_to JSONB DEFAULT '[]',
        notes TEXT,
        contacts JSONB DEFAULT '[]',
        created_by VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        is_active BOOLEAN DEFAULT TRUE
      )
    `;
    
    await tenantDB.executeInTenantSchema(tenantId, createTableQuery);
    
    // Criar índices para performance
    const createIndexes = [
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_title ON \${schema}.${this.tableName}(title)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_client_name ON \${schema}.${this.tableName}(client_name)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_status ON \${schema}.${this.tableName}(status)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_priority ON \${schema}.${this.tableName}(priority)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_active ON \${schema}.${this.tableName}(is_active)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_created_by ON \${schema}.${this.tableName}(created_by)`
    ];
    
    for (const indexQuery of createIndexes) {
      await tenantDB.executeInTenantSchema(tenantId, indexQuery);
    }
  }

  /**
   * Busca projetos com filtros e paginação
   */
  async getProjects(tenantId: string, filters: ProjectFilters = {}): Promise<{
    projects: Project[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    await this.initializeTables(tenantId);
    
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;
    
    let whereConditions = ['is_active = TRUE'];
    let queryParams: any[] = [];
    let paramIndex = 1;
    
    // Filtro por status
    if (filters.status) {
      whereConditions.push(`status = $${paramIndex}`);
      queryParams.push(filters.status);
      paramIndex++;
    }
    
    // Filtro por prioridade
    if (filters.priority) {
      whereConditions.push(`priority = $${paramIndex}`);
      queryParams.push(filters.priority);
      paramIndex++;
    }
    
    // Filtro por busca (título ou nome do cliente)
    if (filters.search) {
      whereConditions.push(`(title ILIKE $${paramIndex} OR client_name ILIKE $${paramIndex})`);
      queryParams.push(`%${filters.search}%`);
      paramIndex++;
    }
    
    // Filtro por tags
    if (filters.tags && filters.tags.length > 0) {
      whereConditions.push(`tags ?| $${paramIndex}`);
      queryParams.push(filters.tags);
      paramIndex++;
    }
    
    // Filtro por assigned_to
    if (filters.assignedTo && filters.assignedTo.length > 0) {
      whereConditions.push(`assigned_to ?| $${paramIndex}`);
      queryParams.push(filters.assignedTo);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';
    
    // Query para buscar projetos
    const projectsQuery = `
      SELECT 
        id, title, description, client_name, client_id, organization, address,
        budget, currency, status, priority, start_date, due_date, tags,
        assigned_to, notes, contacts, created_by, created_at, updated_at, is_active
      FROM \${schema}.${this.tableName}
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM \${schema}.${this.tableName}
      ${whereClause}
    `;
    
    const [projects, countResult] = await Promise.all([
      tenantDB.executeInTenantSchema<Project>(tenantId, projectsQuery, [...queryParams, limit, offset]),
      tenantDB.executeInTenantSchema<{total: string}>(tenantId, countQuery, queryParams)
    ]);
    
    const total = parseInt(countResult[0]?.total || '0');
    const totalPages = Math.ceil(total / limit);
    
    return {
      projects,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Busca um projeto por ID
   */
  async getProjectById(tenantId: string, projectId: string): Promise<Project | null> {
    await this.initializeTables(tenantId);
    
    const query = `
      SELECT 
        id, title, description, client_name, client_id, organization, address,
        budget, currency, status, priority, start_date, due_date, tags,
        assigned_to, notes, contacts, created_by, created_at, updated_at, is_active
      FROM \${schema}.${this.tableName}
      WHERE id = $1 AND is_active = TRUE
    `;
    
    const result = await tenantDB.executeInTenantSchema<Project>(tenantId, query, [projectId]);
    return result[0] || null;
  }

  /**
   * Cria um novo projeto
   */
  async createProject(tenantId: string, projectData: CreateProjectData, createdBy: string): Promise<Project> {
    await this.initializeTables(tenantId);
    
    // Gerar ID único seguindo o mesmo padrão do tasksService
    const projectId = `project_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const query = `
      INSERT INTO \${schema}.${this.tableName} (
        id, title, description, client_name, client_id, organization, address,
        budget, currency, status, priority, start_date, due_date, tags,
        assigned_to, notes, contacts, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb,
        $15::jsonb, $16, $17::jsonb, $18
      )
      RETURNING 
        id, title, description, client_name, client_id, organization, address,
        budget, currency, status, priority, start_date, due_date, tags,
        assigned_to, notes, contacts, created_by, created_at, updated_at, is_active
    `;
    
    const params = [
      projectId,
      projectData.title,
      projectData.description || null,
      projectData.clientName,
      projectData.clientId || null,
      projectData.organization || null,
      projectData.address || null,
      projectData.budget || null,
      projectData.currency || 'BRL',
      projectData.status || 'contacted',
      projectData.priority || 'medium',
      projectData.startDate || null,
      projectData.dueDate || null,
      JSON.stringify(projectData.tags || []),
      JSON.stringify(projectData.assignedTo || []),
      projectData.notes || null,
      JSON.stringify(projectData.contacts || []),
      createdBy
    ];
    
    const result = await tenantDB.executeInTenantSchema<Project>(tenantId, query, params);
    return result[0];
  }

  /**
   * Atualiza um projeto existente
   */
  async updateProject(tenantId: string, projectId: string, updateData: UpdateProjectData): Promise<Project | null> {
    await this.initializeTables(tenantId);
    
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    
    // Mapeamento dos campos para atualização
    const fieldMappings = {
      title: 'title',
      description: 'description',
      clientName: 'client_name',
      clientId: 'client_id',
      organization: 'organization',
      address: 'address',
      budget: 'budget',
      currency: 'currency',
      status: 'status',
      priority: 'priority',
      startDate: 'start_date',
      dueDate: 'due_date',
      tags: 'tags',
      assignedTo: 'assigned_to',
      notes: 'notes',
      contacts: 'contacts'
    };
    
    for (const [key, dbField] of Object.entries(fieldMappings)) {
      if (updateData.hasOwnProperty(key)) {
        const value = (updateData as any)[key];
        if (key === 'tags' || key === 'assignedTo' || key === 'contacts') {
          updateFields.push(`${dbField} = $${paramIndex}::jsonb`);
          params.push(JSON.stringify(value));
        } else {
          updateFields.push(`${dbField} = $${paramIndex}`);
          params.push(value);
        }
        paramIndex++;
      }
    }
    
    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }
    
    // Adicionar updated_at
    updateFields.push(`updated_at = NOW()`);
    
    const query = `
      UPDATE \${schema}.${this.tableName}
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex} AND is_active = TRUE
      RETURNING 
        id, title, description, client_name, client_id, organization, address,
        budget, currency, status, priority, start_date, due_date, tags,
        assigned_to, notes, contacts, created_by, created_at, updated_at, is_active
    `;
    
    params.push(projectId);
    
    const result = await tenantDB.executeInTenantSchema<Project>(tenantId, query, params);
    return result[0] || null;
  }

  /**
   * Exclui um projeto (soft delete)
   */
  async deleteProject(tenantId: string, projectId: string): Promise<boolean> {
    await this.initializeTables(tenantId);
    
    const query = `
      UPDATE \${schema}.${this.tableName}
      SET is_active = FALSE, updated_at = NOW()
      WHERE id = $1 AND is_active = TRUE
    `;
    
    const result = await tenantDB.executeInTenantSchema(tenantId, query, [projectId]);
    return result.length > 0;
  }

  /**
   * Obtém estatísticas dos projetos
   */
  async getProjectsStats(tenantId: string): Promise<{
    total: number;
    contacted: number;
    proposal: number;
    won: number;
    lost: number;
    thisMonth: number;
  }> {
    await this.initializeTables(tenantId);
    
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'contacted') as contacted,
        COUNT(*) FILTER (WHERE status = 'proposal') as proposal,
        COUNT(*) FILTER (WHERE status = 'won') as won,
        COUNT(*) FILTER (WHERE status = 'lost') as lost,
        COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW())) as this_month
      FROM \${schema}.${this.tableName}
      WHERE is_active = TRUE
    `;
    
    const result = await tenantDB.executeInTenantSchema<any>(tenantId, query);
    const stats = result[0];
    
    return {
      total: parseInt(stats.total || '0'),
      contacted: parseInt(stats.contacted || '0'),
      proposal: parseInt(stats.proposal || '0'),
      won: parseInt(stats.won || '0'),
      lost: parseInt(stats.lost || '0'),
      thisMonth: parseInt(stats.this_month || '0')
    };
  }
}

export const projectsService = new ProjectsService();
import { supabase } from '../config/supabase';

export interface ProjectData {
  title: string;
  description?: string;
  clientName: string;
  clientId?: string;
  organization?: string;
  address?: string;
  budget?: number;
  currency: 'BRL' | 'USD' | 'EUR';
  status: 'contacted' | 'proposal' | 'won' | 'lost';
  startDate: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  progress: number;
  tags: string[];
  assignedTo: string[];
  contacts: Array<{
    name: string;
    email: string;
    phone: string;
    role: string;
  }>;
  notes?: string;
  createdBy?: string;
  lastModifiedBy?: string;
  tenantId: string;
}

export interface ProjectFilters {
  search?: string;
  status?: string;
  priority?: string;
}

class ProjectsService {
  async getProjectsByTenant(
    tenantId: string, 
    page: number = 1, 
    limit: number = 50,
    filters: ProjectFilters = {}
  ) {
    try {
      let query = supabase
        .from('projects')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,client_name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.priority) {
        query = query.eq('priority', filters.priority);
      }

      // Apply pagination
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching projects:', error);
        throw error;
      }

      return {
        projects: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      };
    } catch (error) {
      console.error('Error in getProjectsByTenant:', error);
      throw error;
    }
  }

  async getProjectById(tenantId: string, projectId: string) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', projectId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching project:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in getProjectById:', error);
      throw error;
    }
  }

  async createProject(tenantId: string, projectData: ProjectData) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert([{
          ...projectData,
          tenant_id: tenantId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating project:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in createProject:', error);
      throw error;
    }
  }

  async updateProject(tenantId: string, projectId: string, updateData: Partial<ProjectData>) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('id', projectId)
        .select()
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error updating project:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in updateProject:', error);
      throw error;
    }
  }

  async deleteProject(tenantId: string, projectId: string) {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('id', projectId);

      if (error) {
        console.error('Error deleting project:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteProject:', error);
      throw error;
    }
  }

  async getProjectStats(tenantId: string) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('status, priority, budget')
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error fetching project stats:', error);
        throw error;
      }

      const projects = data || [];
      
      const stats = {
        total: projects.length,
        byStatus: {
          contacted: projects.filter(p => p.status === 'contacted').length,
          proposal: projects.filter(p => p.status === 'proposal').length,
          won: projects.filter(p => p.status === 'won').length,
          lost: projects.filter(p => p.status === 'lost').length,
        },
        byPriority: {
          low: projects.filter(p => p.priority === 'low').length,
          medium: projects.filter(p => p.priority === 'medium').length,
          high: projects.filter(p => p.priority === 'high').length,
          urgent: projects.filter(p => p.priority === 'urgent').length,
        },
        totalBudget: projects.reduce((sum, p) => sum + (p.budget || 0), 0),
        averageBudget: projects.length > 0 
          ? projects.reduce((sum, p) => sum + (p.budget || 0), 0) / projects.length 
          : 0,
      };

      return stats;
    } catch (error) {
      console.error('Error in getProjectStats:', error);
      throw error;
    }
  }
}

export const projectsService = new ProjectsService();
