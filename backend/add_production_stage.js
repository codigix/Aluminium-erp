require('dotenv').config();
const pool = require('./src/config/db');

async function migrate() {
  const tables = [
    'sales_order_item_materials',
    'sales_order_item_components',
    'sales_order_item_operations',
    'sales_order_item_scrap'
  ];

  const connection = await pool.getConnection();
  try {
    for (const table of tables) {
      console.log(`Adding production_stage to ${table}...`);
      await connection.query(`
        ALTER TABLE ${table} 
        ADD COLUMN production_stage VARCHAR(100) DEFAULT 'Final Assembly'
      `);
    }
    console.log('Migration successful');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    connection.release();
    process.exit(0);
  }
}

migrate();
