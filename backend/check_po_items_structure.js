const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkPOItems() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'backend',
    database: process.env.DB_NAME || 'sales_erp'
  });

  try {
    const [columns] = await connection.query('SHOW COLUMNS FROM purchase_order_items');
    console.log('Columns in purchase_order_items:');
    console.table(columns.map(c => ({ Field: c.Field, Type: c.Type })));
    
    const [rows] = await connection.query('SELECT * FROM purchase_order_items ORDER BY id DESC LIMIT 5');
    console.log('Recent purchase_order_items:');
    console.table(rows);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkPOItems();
