const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'backend',
    database: process.env.DB_NAME || 'sales_erp',
    port: process.env.DB_PORT || 3306
  });

  try {
    console.log('Migrating purchase_orders status...');
    await connection.execute("ALTER TABLE purchase_orders MODIFY COLUMN status ENUM('DRAFT', 'PO_REQUEST', 'ORDERED', 'Sent ', 'ACKNOWLEDGED', 'RECEIVED', 'PARTIALLY_RECEIVED', 'CLOSED', 'COMPLETED', 'FULFILLED') DEFAULT 'ORDERED'");
    console.log('Successfully added FULFILLED to purchase_orders status.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

migrate();
