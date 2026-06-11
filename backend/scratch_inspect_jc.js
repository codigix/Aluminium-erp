const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function checkDetails() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3307,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sales_erp'
  };

  const connection = await mysql.createConnection(config);

  try {
    const [cols] = await connection.query('SHOW COLUMNS FROM production_plan_operations');
    console.log('--- Columns ---');
    console.log(cols.map(c => c.Field));
  } catch (error) {
    console.error('Failed to query:', error);
  } finally {
    await connection.end();
  }
}

checkDetails();
