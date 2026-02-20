const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function fixEnum() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'backend',
    database: process.env.DB_NAME || 'sales_erp'
  });

  try {
    console.log('Updating material_requests status enum...');
    await connection.query(`ALTER TABLE material_requests MODIFY status ENUM('DRAFT', 'Approved ', 'PROCESSING', 'FULFILLED', 'CANCELLED', 'ORDERED', 'COMPLETED', 'PO_CREATED') DEFAULT 'DRAFT'`);
    console.log('Enum updated successfully!');
  } catch (error) {
    console.error('Error updating enum:', error);
  } finally {
    await connection.end();
  }
}

fixEnum();
