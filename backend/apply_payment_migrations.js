const pool = require('./src/config/db');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  try {
    console.log('Starting payment system migrations...\n');

    const migrations = [
      '010-add-payments-tables.sql',
      '011-add-payment-permissions.sql',
      '012-add-payment-statuses.sql',
      '013-grant-payment-to-accounts.sql'
    ];

    for (const migration of migrations) {
      const migrationPath = path.join(__dirname, 'migrations', migration);
      
      if (!fs.existsSync(migrationPath)) {
        console.log(`⚠️  Migration not found: ${migration}`);
        continue;
      }

      const sql = fs.readFileSync(migrationPath, 'utf8');
      console.log(`📝 Running: ${migration}`);
      
      try {
        const statements = sql.split(';').filter(stmt => stmt.trim());
        
        for (const statement of statements) {
          if (statement.trim()) {
            await pool.query(statement);
          }
        }
        
        console.log(`✅ ${migration} completed successfully\n`);
      } catch (error) {
        console.error(`❌ Error in ${migration}:`, error.message);
        if (!migration.includes('permission') && !migration.includes('grant')) {
          throw error;
        }
        console.log('⚠️  Continuing with next migration...\n');
      }
    }

    console.log('✅ All migrations completed!');
    
    const [result] = await pool.query(`
      SELECT DISTINCT p.code, p.name 
      FROM permissions p
      WHERE p.code LIKE 'PAYMENT%'
      ORDER BY p.code
    `);
    
    if (result.length > 0) {
      console.log('\n📋 Payment permissions registered:');
      result.forEach(perm => {
        console.log(`   • ${perm.code}: ${perm.name}`);
      });
    }

    const [accountsRole] = await pool.query(`
      SELECT rp.permission_id, p.code 
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      JOIN roles r ON rp.role_id = r.id
      WHERE r.code = 'ACC_MGR' AND p.code LIKE 'PAYMENT%'
    `);

    if (accountsRole.length > 0) {
      console.log('\n👤 Accounts Manager (ACC_MGR) role permissions:');
      accountsRole.forEach(perm => {
        console.log(`   • ${perm.code}`);
      });
    } else {
      console.log('\n⚠️  Accounts Manager role does not have payment permissions yet');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigrations();
