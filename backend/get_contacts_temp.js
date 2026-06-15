const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3307,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'sales_erp'
  });
  
  try {
    const [pos] = await connection.query("SELECT id, company_id, po_number, project_name FROM customer_pos");
    console.log('All POs:', pos);
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}
run();
