const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkMRItems() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'backend',
    database: process.env.DB_NAME || 'sales_erp'
  });

  try {
    const [columns] = await connection.query('SHOW COLUMNS FROM material_request_items');
    console.log('Columns in material_request_items:');
    console.table(columns.map(c => ({ Field: c.Field, Type: c.Type })));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkMRItems();
