const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function check() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'backend',
    database: process.env.DB_NAME || 'sales_erp'
  });

  try {
    const [rows] = await connection.query('DESCRIBE work_orders');
    console.table(rows);
  } catch (e) {
    console.log('Error:', e.message);
  }

  await connection.end();
}

check();
