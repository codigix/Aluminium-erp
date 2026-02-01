const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

async function runMigration() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'Aluminium-erp'
  });

  console.log('Connected to database.');

  try {
    const migrationPath = path.join(__dirname, 'migrations', '012-add-classification-to-procurement.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    const commands = sql.split(';').filter(cmd => cmd.trim());

    for (const command of commands) {
      console.log(`Executing: ${command.trim()}`);
      try {
        await connection.execute(command);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.warn(`Field already exists, skipping: ${err.message}`);
        } else {
          throw err;
        }
      }
    }

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

runMigration();
