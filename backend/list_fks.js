const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function listAll() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'backend',
    database: 'information_schema'
  });

  try {
    const [rows] = await connection.query(`
      SELECT TABLE_NAME, CONSTRAINT_NAME 
      FROM KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = 'sales_erp' 
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }

  await connection.end();
}

listAll();
