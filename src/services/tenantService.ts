/**
 * TENANT SERVICE - Gerenciamento de Tenants
 * ========================================
 * 
 * Serviço para gerenciar operações relacionadas a tenants,
 * incluindo criação de schemas e inicialização de tabelas.
 */

import { tenantDB } from './tenantDatabase';
import { database } from '../config/database';

export class TenantService {
  /**
   * Inicializa schema e tabelas para um novo tenant
   */
  async initializeTenantSchema(tenantId: string, schemaName: string) {
    try {
      console.log(`Initializing schema for tenant ${tenantId}: ${schemaName}`);

      // Create schema
      await this.createTenantSchema(schemaName);

      // Create all tenant tables
      await this.createTenantTables(schemaName);

      console.log(`Schema ${schemaName} initialized successfully`);

      return true;
    } catch (error) {
      console.error(`Error initializing tenant schema ${schemaName}:`, error);
      throw error;
    }
  }

  /**
   * Cria o schema do tenant
   */
  private async createTenantSchema(schemaName: string) {
    const query = `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`;
    await database.query(query);
  }

  /**
   * Cria todas as tabelas necessárias no schema do tenant
   */
  private async createTenantTables(schemaName: string) {
    const tables = [
      this.getClientsTableSQL(schemaName),
      this.getProjectsTableSQL(schemaName),
      this.getTasksTableSQL(schemaName),
      this.getTransactionsTableSQL(schemaName),
      this.getInvoicesTableSQL(schemaName),
      this.getPublicationsTableSQL(schemaName)
    ];

    for (const tableSQL of tables) {
      await database.query(tableSQL);
    }
  }

  /**
   * SQL para tabela de clientes
   */
  private getClientsTableSQL(schemaName: string): string {
    return `
      CREATE TABLE IF NOT EXISTS "${schemaName}".clients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        document VARCHAR(50),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(50),
        postal_code VARCHAR(20),
        country VARCHAR(100) DEFAULT 'Brasil',
        status VARCHAR(50) DEFAULT 'active',
        type VARCHAR(50) DEFAULT 'individual',
        notes TEXT,
        tags TEXT[],
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID
      )
    `;
  }

  /**
   * SQL para tabela de projetos
   */
  private getProjectsTableSQL(schemaName: string): string {
    return `
      CREATE TABLE IF NOT EXISTS "${schemaName}".projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        client_id UUID,
        status VARCHAR(50) DEFAULT 'active',
        priority VARCHAR(20) DEFAULT 'medium',
        budget DECIMAL(15,2),
        start_date DATE,
        end_date DATE,
        progress INTEGER DEFAULT 0,
        tags TEXT[],
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID
      )
    `;
  }

  /**
   * SQL para tabela de tarefas
   */
  private getTasksTableSQL(schemaName: string): string {
    return `
      CREATE TABLE IF NOT EXISTS "${schemaName}".tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        project_id UUID,
        assigned_to UUID,
        status VARCHAR(50) DEFAULT 'pending',
        priority VARCHAR(20) DEFAULT 'medium',
        due_date TIMESTAMP,
        completed_at TIMESTAMP,
        tags TEXT[],
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID
      )
    `;
  }

  /**
   * SQL para tabela de transações (fluxo de caixa)
   */
  private getTransactionsTableSQL(schemaName: string): string {
    return `
      CREATE TABLE IF NOT EXISTS "${schemaName}".transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
        category VARCHAR(255) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        description TEXT,
        date DATE NOT NULL,
        project_id UUID,
        client_id UUID,
        payment_method VARCHAR(50),
        status VARCHAR(50) DEFAULT 'confirmed',
        tags TEXT[],
        is_recurring BOOLEAN DEFAULT FALSE,
        recurring_config JSONB,
        attachments JSONB,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID
      )
    `;
  }

  /**
   * SQL para tabela de faturas
   */
  private getInvoicesTableSQL(schemaName: string): string {
    return `
      CREATE TABLE IF NOT EXISTS "${schemaName}".invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        number VARCHAR(50) UNIQUE NOT NULL,
        client_id UUID,
        project_id UUID,
        type VARCHAR(20) DEFAULT 'invoice',
        status VARCHAR(50) DEFAULT 'draft',
        amount DECIMAL(15,2) NOT NULL,
        tax_amount DECIMAL(15,2) DEFAULT 0,
        total_amount DECIMAL(15,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'BRL',
        issue_date DATE NOT NULL,
        due_date DATE NOT NULL,
        description TEXT,
        items JSONB,
        payment_terms TEXT,
        notes TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID
      )
    `;
  }

  /**
   * SQL para tabela de publicações
   */
  private getPublicationsTableSQL(schemaName: string): string {
    return `
      CREATE TABLE IF NOT EXISTS "${schemaName}".publications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        source VARCHAR(100),
        publication_date DATE,
        status VARCHAR(50) DEFAULT 'novo',
        client_id UUID,
        project_id UUID,
        assigned_to UUID,
        tags TEXT[],
        url VARCHAR(500),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID
      )
    `;
  }

  /**
   * Remove schema e dados do tenant
   */
  async deleteTenantSchema(schemaName: string) {
    try {
      const query = `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`;
      await database.query(query);
      console.log(`Schema ${schemaName} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting tenant schema ${schemaName}:`, error);
      throw error;
    }
  }
}

export const tenantService = new TenantService();