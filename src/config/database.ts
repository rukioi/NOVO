import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://pdsgfvjhtunnzvtlrihw.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkc2dmdmpodHVubnp2dGxyaWh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NTkwMzIsImV4cCI6MjA3MzAzNTAzMn0.XJzgbqFnUzzLWJgaowHMwtLex2rrV5KZZKBP0PePhQU';

// Service key for server operations (only use server-side)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Database config loaded:', {
  url: supabaseUrl,
  hasAnonKey: !!supabaseAnonKey,
  hasServiceKey: !!supabaseServiceKey,
  environment: process.env.NODE_ENV
});

// Main Supabase client for all operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  db: {
    schema: 'public'
  }
});

// Service client for admin operations (server-side only)
export const supabaseAdmin = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  db: {
    schema: 'public'
  }
}) : null;

// Database operations using Supabase
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
      const { data, error } = await supabase.from('tenants').select('count').limit(1);
      if (error) {
        console.warn('Database connection test failed:', error.message);
        return false;
      }
      console.log('Database connection successful');
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  // Admin operations
  async findAdminByEmail(email: string) {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('email', email)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error finding admin by email:', error);
        return null;
      }
      return data;
    } catch (error) {
      console.error('Error in findAdminByEmail:', error);
      return null;
    }
  }

  async createAdminUser(userData: any) {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .insert(userData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating admin user:', error);
      throw error;
    }
  }

  async updateAdminLastLogin(id: string) {
    try {
      const { error } = await supabase
        .from('admin_users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating admin last login:', error);
      throw error;
    }
  }

  // User operations
  async findUserByEmail(email: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          tenant:tenants(*)
        `)
        .eq('email', email)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error finding user by email:', error);
        return null;
      }
      return data;
    } catch (error) {
      console.error('Error in findUserByEmail:', error);
      return null;
    }
  }

  async createUser(userData: any) {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert(userData)
        .select(`
          *,
          tenant:tenants(*)
        `)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUserLastLogin(id: string) {
    try {
      const { error } = await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating user last login:', error);
      throw error;
    }
  }

  // Tenant operations
  async getAllTenants() {
    return await this.query('SELECT * FROM tenants ORDER BY created_at DESC');
  }

  async getAllUsers() {
    return await this.query('SELECT id, email, name, account_type, tenant_id, is_active, created_at FROM users ORDER BY created_at DESC');
  }

  async createTenant(tenantData: any) {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .insert(tenantData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating tenant:', error);
      throw error;
    }
  }

  async updateTenant(id: string, data: any) {
    const result = await this.query(`
      UPDATE tenants 
      SET name = COALESCE($1, name), 
          plan_type = COALESCE($2, plan_type),
          max_users = COALESCE($3, max_users),
          max_storage = COALESCE($4, max_storage),
          is_active = COALESCE($5, is_active),
          updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `, [data.name, data.plan_type, data.max_users, data.max_storage, data.is_active, id]);

    return result[0];
  }

  async createTenantSchema(schemaName: string): Promise<void> {
    try {
      console.log(`Creating schema: ${schemaName}`);

      // Criar o schema
      await this.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

      // Criar tabelas básicas no schema do tenant
      const tables = [
        // Clientes
        `CREATE TABLE IF NOT EXISTS "${schemaName}".clients (
          id VARCHAR PRIMARY KEY DEFAULT 'client_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_' || SUBSTR(md5(random()::text), 1, 8),
          name VARCHAR NOT NULL,
          email VARCHAR NOT NULL,
          phone VARCHAR,
          organization VARCHAR,
          address JSONB DEFAULT '{}',
          budget DECIMAL(15,2),
          currency VARCHAR(3) DEFAULT 'BRL',
          status VARCHAR DEFAULT 'active',
          tags JSONB DEFAULT '[]',
          notes TEXT,
          cpf VARCHAR,
          rg VARCHAR,
          professional_title VARCHAR,
          marital_status VARCHAR,
          birth_date DATE,
          created_by VARCHAR NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          is_active BOOLEAN DEFAULT TRUE
        )`,

        // Projetos
        `CREATE TABLE IF NOT EXISTS "${schemaName}".projects (
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
        )`,

        // Tarefas
        `CREATE TABLE IF NOT EXISTS "${schemaName}".tasks (
          id VARCHAR PRIMARY KEY,
          title VARCHAR NOT NULL,
          description TEXT,
          project_id VARCHAR,
          project_title VARCHAR,
          client_id VARCHAR,
          client_name VARCHAR,
          assigned_to VARCHAR NOT NULL,
          status VARCHAR DEFAULT 'not_started',
          priority VARCHAR DEFAULT 'medium',
          start_date TIMESTAMP,
          end_date TIMESTAMP,
          estimated_hours DECIMAL(5,2),
          actual_hours DECIMAL(5,2),
          progress INTEGER DEFAULT 0,
          tags JSONB DEFAULT '[]',
          notes TEXT,
          subtasks JSONB DEFAULT '[]',
          created_by VARCHAR NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          is_active BOOLEAN DEFAULT TRUE
        )`,

        // Transações (apenas para COMPOSTA e GERENCIAL)
        `CREATE TABLE IF NOT EXISTS "${schemaName}".transactions (
          id VARCHAR PRIMARY KEY,
          type VARCHAR NOT NULL CHECK (type IN ('income', 'expense')),
          amount DECIMAL(15,2) NOT NULL,
          category_id VARCHAR NOT NULL,
          category VARCHAR NOT NULL,
          description VARCHAR NOT NULL,
          date DATE NOT NULL,
          payment_method VARCHAR CHECK (payment_method IN ('pix', 'credit_card', 'debit_card', 'bank_transfer', 'boleto', 'cash', 'check')),
          status VARCHAR DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
          project_id VARCHAR,
          project_title VARCHAR,
          client_id VARCHAR,
          client_name VARCHAR,
          tags JSONB DEFAULT '[]',
          notes TEXT,
          is_recurring BOOLEAN DEFAULT FALSE,
          recurring_frequency VARCHAR CHECK (recurring_frequency IN ('monthly', 'quarterly', 'yearly')),
          created_by VARCHAR NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          is_active BOOLEAN DEFAULT TRUE
        )`,

        // Faturas (apenas para COMPOSTA e GERENCIAL)
        `CREATE TABLE IF NOT EXISTS "${schemaName}".invoices (
          id VARCHAR PRIMARY KEY,
          number VARCHAR NOT NULL UNIQUE,
          title VARCHAR NOT NULL,
          description TEXT,
          client_id VARCHAR,
          client_name VARCHAR NOT NULL,
          client_email VARCHAR,
          client_phone VARCHAR,
          amount DECIMAL(15,2) NOT NULL,
          currency VARCHAR(3) DEFAULT 'BRL',
          status VARCHAR DEFAULT 'draft',
          due_date DATE NOT NULL,
          items JSONB DEFAULT '[]',
          tags JSONB DEFAULT '[]',
          notes TEXT,
          payment_status VARCHAR DEFAULT 'pending',
          payment_method VARCHAR,
          payment_date DATE,
          email_sent BOOLEAN DEFAULT FALSE,
          email_sent_at TIMESTAMP,
          reminders_sent INTEGER DEFAULT 0,
          last_reminder_at TIMESTAMP,
          created_by VARCHAR NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          is_active BOOLEAN DEFAULT TRUE
        )`,

        // Publicações (isolado por usuário)
        `CREATE TABLE IF NOT EXISTS "${schemaName}".publications (
          id VARCHAR PRIMARY KEY,
          user_id VARCHAR NOT NULL,
          oab_number VARCHAR NOT NULL,
          process_number VARCHAR,
          publication_date DATE NOT NULL,
          content TEXT NOT NULL,
          source VARCHAR NOT NULL CHECK (source IN ('CNJ-DATAJUD', 'Codilo', 'JusBrasil')),
          external_id VARCHAR,
          status VARCHAR DEFAULT 'novo' CHECK (status IN ('novo', 'lido', 'arquivado')),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          is_active BOOLEAN DEFAULT TRUE,
          UNIQUE(user_id, external_id)
        )`
      ];

      // Executar criação de cada tabela
      for (const tableSQL of tables) {
        await this.query(tableSQL);
      }

      console.log(`Schema ${schemaName} created successfully with all tables`);
    } catch (error) {
      console.error(`Error creating tenant schema ${schemaName}:`, error);
      throw error;
    }
  }

  async deleteTenant(id: string) {
    try {
      const { error } = await supabase
        .from('tenants')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting tenant:', error);
      throw error;
    }
  }

  // Registration keys operations
  async getAllRegistrationKeys() {
    try {
      const { data, error } = await supabase
        .from('registration_keys')
        .select(`
          *,
          tenant:tenants(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting registration keys:', error);
      return [];
    }
  }

  async createRegistrationKey(keyData: any) {
    try {
      const { data, error } = await supabase
        .from('registration_keys')
        .insert(keyData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating registration key:', error);
      throw error;
    }
  }

  async revokeRegistrationKey(id: string) {
    try {
      const { error } = await supabase
        .from('registration_keys')
        .update({ revoked: true })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error revoking registration key:', error);
      throw error;
    }
  }

  async findValidRegistrationKeys() {
    try {
      const { data, error } = await supabase
        .from('registration_keys')
        .select('*')
        .eq('revoked', false)
        .gt('uses_left', 0)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error finding valid registration keys:', error);
      return [];
    }
  }

  async updateRegistrationKeyUsage(id: string, updateData: any) {
    try {
      const { error } = await supabase
        .from('registration_keys')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating registration key usage:', error);
      throw error;
    }
  }

  // Refresh tokens operations
  async createRefreshToken(tokenData: any) {
    try {
      const { data, error } = await supabase
        .from('refresh_tokens')
        .insert(tokenData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating refresh token:', error);
      throw error;
    }
  }

  async findValidRefreshToken(tokenHash: string) {
    try {
      const { data, error } = await supabase
        .from('refresh_tokens')
        .select(`
          *,
          user:users(*)
        `)
        .eq('token_hash', tokenHash)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error finding refresh token:', error);
        return null;
      }
      return data;
    } catch (error) {
      console.error('Error in findValidRefreshToken:', error);
      return null;
    }
  }

  async revokeAllUserTokens(userId: string) {
    try {
      const { error } = await supabase
        .from('refresh_tokens')
        .update({ is_active: false })
        .eq('user_id', userId);

      if (error) throw error;
    } catch (error) {
      console.error('Error revoking user tokens:', error);
      throw error;
    }
  }

  async revokeRefreshToken(tokenHash: string) {
    try {
      const { error } = await supabase
        .from('refresh_tokens')
        .update({ is_active: false })
        .eq('token_hash', tokenHash);

      if (error) throw error;
    } catch (error) {
      console.error('Error revoking refresh token:', error);
      throw error;
    }
  }

  // Audit logs
  async createAuditLog(logData: any) {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .insert(logData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating audit log:', error);
      throw error;
    }
  }

  // System logs
  async createSystemLog(logData: any) {
    try {
      const { data, error } = await supabase
        .from('system_logs')
        .insert(logData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating system log:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('count')
        .limit(1);

      return {
        database: !error,
        timestamp: new Date().toISOString(),
        error: error?.message
      };
    } catch (error) {
      return {
        database: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
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

      // For now, return mock data since we need to implement proper schema switching
      // This would need to be implemented with proper SQL execution
      return [] as T[];
    } catch (error) {
      console.error('Error executing tenant query:', error);
      throw error;
    }
  }

  async query<T = any>(query: string, params: any[] = []): Promise<T[]> {
    return this.executeInTenantSchema<T>(query, params);
  }

  async create<T = any>(table: string, data: any): Promise<T> {
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map((_, i) => `$${i + 1}`).join(', ');
    const values = Object.values(data);

    const query = `
      INSERT INTO \${schema}.${table} (${columns})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await this.executeInTenantSchema<T>(query, values);
    return result[0];
  }

  async findById<T = any>(table: string, id: string): Promise<T | null> {
    const query = `SELECT * FROM \${schema}.${table} WHERE id = $1`;
    const result = await this.executeInTenantSchema<T>(query, [id]);
    return result[0] || null;
  }

  async update<T = any>(table: string, id: string, data: any): Promise<T> {
    const setClause = Object.keys(data).map((key, i) => `${key} = $${i + 2}`).join(', ');
    const values = [id, ...Object.values(data)];

    const query = `
      UPDATE \${schema}.${table}
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.executeInTenantSchema<T>(query, values);
    return result[0];
  }

  async delete(table: string, id: string): Promise<boolean> {
    const query = `DELETE FROM \${schema}.${table} WHERE id = $1`;
    const result = await this.executeInTenantSchema(query, [id]);
    return result.length > 0;
  }
}

// Export tenant database factory
export const tenantDB = {
  executeInTenantSchema: <T = any>(tenantId: string, query: string, params: any[] = []): Promise<T[]> => {
    const db = new TenantDatabase(tenantId);
    return db.executeInTenantSchema<T>(query, params);
  }
};