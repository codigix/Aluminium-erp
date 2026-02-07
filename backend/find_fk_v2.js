const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function find() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'backend',
    database: process.env.DB_NAME || 'sales_erp'
  });

  try {
    console.log('--- SHOW CREATE TABLE work_orders ---');
    const [rows] = await connection.query('SHOW CREATE TABLE work_orders');
    console.log(rows[0]['Create Table']);
    
    console.log('\n--- INFORMATION_SCHEMA.TABLE_CONSTRAINTS ---');
    const [constraints] = await connection.query(`
      SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE 
      FROM information_schema.TABLE_CONSTRAINTS 
      WHERE TABLE_SCHEMA = 'sales_erp' AND TABLE_NAME = 'work_orders'
    `);
    console.log(JSON.stringify(constraints, null, 2));

    console.log('\n--- INFORMATION_SCHEMA.KEY_COLUMN_USAGE ---');
    const [usage] = await connection.query(`
      SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME 
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = 'sales_erp' AND TABLE_NAME = 'work_orders'
    `);
    console.log(JSON.stringify(usage, null, 2));

  } catch (e) {
    console.log('Error:', e.message);
  }

  await connection.end();
}

find();
