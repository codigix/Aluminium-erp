const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

async function check() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3307,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sales_erp'
  };

  const connection = await mysql.createConnection(config);
  try {
    const [rows] = await connection.query('DESCRIBE job_card_quality_logs');
    console.log('--- job_card_quality_logs columns ---');
    console.table(rows);
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}
check();
