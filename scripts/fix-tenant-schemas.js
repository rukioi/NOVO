
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/database',
});

async function fixTenantSchemas() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Starting tenant schema fix...');

    // Get all tenants
    const tenantsResult = await client.query('SELECT id, schema_name FROM tenants WHERE is_active = true');
    const tenants = tenantsResult.rows;

    console.log(`📋 Found ${tenants.length} tenants to fix`);

    for (const tenant of tenants) {
      const { id, schema_name } = tenant;
      console.log(`\n🏢 Fixing tenant: ${id} (${schema_name})`);

      try {
        // Create schema if it doesn't exist
        await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema_name}"`);
        console.log(`  ✅ Schema "${schema_name}" created/verified`);

        // Create/update transactions table with correct structure
        await client.query(`
          CREATE TABLE IF NOT EXISTS "${schema_name}".transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
            category_id VARCHAR(255),
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
            recurring_frequency VARCHAR(20),
            recurring_config JSONB,
            attachments JSONB,
            notes TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            created_by UUID,
            last_modified_by UUID
          )
        `);
        console.log(`  ✅ Transactions table created/updated`);

        // Create/update tasks table with progress column
        await client.query(`
          CREATE TABLE IF NOT EXISTS "${schema_name}".tasks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR(255) NOT NULL,
            description TEXT,
            project_id UUID,
            assigned_to UUID,
            status VARCHAR(50) DEFAULT 'pending',
            priority VARCHAR(20) DEFAULT 'medium',
            progress INTEGER DEFAULT 0,
            due_date TIMESTAMP,
            completed_at TIMESTAMP,
            tags TEXT[],
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            created_by UUID
          )
        `);
        console.log(`  ✅ Tasks table created/updated`);

        // Create/update other required tables
        await client.query(`
          CREATE TABLE IF NOT EXISTS "${schema_name}".clients (
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
        `);
        console.log(`  ✅ Clients table created/updated`);

        await client.query(`
          CREATE TABLE IF NOT EXISTS "${schema_name}".projects (
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
        `);
        console.log(`  ✅ Projects table created/updated`);

        await client.query(`
          CREATE TABLE IF NOT EXISTS "${schema_name}".invoices (
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
        `);
        console.log(`  ✅ Invoices table created/updated`);

        await client.query(`
          CREATE TABLE IF NOT EXISTS "${schema_name}".publications (
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
        `);
        console.log(`  ✅ Publications table created/updated`);

        console.log(`  🎉 Tenant ${id} schema fixed successfully!`);

      } catch (tenantError) {
        console.error(`  ❌ Error fixing tenant ${id}:`, tenantError.message);
      }
    }

    console.log('\n🎉 All tenant schemas have been processed!');

  } catch (error) {
    console.error('❌ Error during schema fix:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix
fixTenantSchemas().catch(console.error);
