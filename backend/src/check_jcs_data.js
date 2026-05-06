const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function run() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 3307,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sales_erp'
    });
    
    const query = `DESC work_orders`;
    
    const [rows] = await conn.query(query);
    console.log(JSON.stringify(rows, null, 2));
    
    await conn.end();
  } catch (err) {
    console.error(err);
  }
}
run();
