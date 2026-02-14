const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function checkSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'backend',
    database: process.env.DB_NAME || 'sales_erp',
    port: process.env.DB_PORT || 3306
  });

  try {
    const [rows] = await connection.execute("SHOW COLUMNS FROM purchase_orders");
    console.log('Columns:', rows.map(r => r.Field).join(', '));
  } catch (error) {
    console.error('Failed to check schema:', error);
  } finally {
    await connection.end();
  }
}

checkSchema();
