const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

async function fixMissingColumns() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'backend',
    database: process.env.DB_NAME || 'sales_erp'
  });

  console.log('Connected to database');

  const tables = ['purchase_orders', 'job_cards', 'work_orders', 'orders', 'sales_orders'];
  
  for (const table of tables) {
    try {
      const [columns] = await connection.query(`SHOW COLUMNS FROM ${table}`);
      const existing = new Set(columns.map(c => c.Field));
      
      if (!existing.has('public_id')) {
        console.log(`Adding public_id to ${table}...`);
        await connection.query(`ALTER TABLE ${table} ADD COLUMN public_id VARCHAR(100) UNIQUE NULL`);
      } else {
        console.log(`public_id already exists in ${table}`);
      }
    } catch (err) {
      console.error(`Error processing ${table}:`, err.message);
    }
  }

  await connection.end();
  console.log('Done');
}

fixMissingColumns();
