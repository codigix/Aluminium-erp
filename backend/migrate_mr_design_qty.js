const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

const run = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'backend',
    database: process.env.DB_NAME || 'sales_erp'
  });

  try {
    const [cols] = await connection.query("SHOW COLUMNS FROM material_request_items LIKE 'design_qty'");
    if (cols.length === 0) {
      console.log('Adding design_qty to material_request_items...');
      await connection.query('ALTER TABLE material_request_items ADD COLUMN design_qty DECIMAL(12, 3) AFTER item_type');
      console.log('Column added successfully');
    } else {
      console.log('design_qty already exists in material_request_items');
    }
  } catch (error) {
    console.error('Migration failed:', error.message);
  } finally {
    await connection.end();
  }
};

run();
