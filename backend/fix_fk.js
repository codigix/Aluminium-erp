const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function fix() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'backend',
    database: process.env.DB_NAME || 'sales_erp'
  });

  try {
    console.log('Attempting to drop foreign key work_orders_ibfk_2...');
    await connection.query('ALTER TABLE work_orders DROP FOREIGN KEY work_orders_ibfk_2');
    console.log('Successfully dropped work_orders_ibfk_2');
  } catch (e) {
    console.log('Error or already dropped:', e.message);
  }

  try {
    console.log('Attempting to drop foreign key work_orders_ibfk_1...');
    await connection.query('ALTER TABLE work_orders DROP FOREIGN KEY work_orders_ibfk_1');
    console.log('Successfully dropped work_orders_ibfk_1');
  } catch (e) {}

  try {
    console.log('Attempting to drop foreign key work_orders_ibfk_3...');
    await connection.query('ALTER TABLE work_orders DROP FOREIGN KEY work_orders_ibfk_3');
    console.log('Successfully dropped work_orders_ibfk_3');
  } catch (e) {}

  await connection.end();
}

fix();
