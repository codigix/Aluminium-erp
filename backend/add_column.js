const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sales_erp',
    port: parseInt(process.env.DB_PORT || '3306')
  };

  const connection = await mysql.createConnection(config);
  try {
    await connection.query(`ALTER TABLE production_plan_operations ADD COLUMN item_type VARCHAR(50) DEFAULT 'FG' AFTER source_item;`);
    console.log('Column item_type added successfully to production_plan_operations');
  } catch (error) {
    if (error.code === 'ER_DUP_COLUMN_NAME') {
      console.log('Column vendor_invoice already exists');
    } else {
      console.error('Error adding column:', error);
    }
  } finally {
    await connection.end();
  }
}

run();
