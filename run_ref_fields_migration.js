const fs = require('fs');
const path = require('path');
const pool = require('./backend/src/config/db');

async function runMigration() {
  try {
    const migrationFile = path.join(__dirname, 'backend/migrations/013-add-ref-bom-fields-to-components.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    const statements = sql.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        await pool.query(statement);
      }
    }
    
    console.log('✓ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
