const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkData() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'backend',
    database: process.env.DB_NAME || 'sales_erp'
  });

  try {
    const [rows] = await connection.query('SELECT * FROM material_request_items ORDER BY id DESC LIMIT 5');
    console.log('Recent material_request_items:');
    console.table(rows);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkData();
