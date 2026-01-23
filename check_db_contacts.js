const mysql = require('mysql2');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

async function checkContacts() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sales_erp',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  }).promise();

  try {
    const [rows] = await pool.query('SELECT name, phone, email, contact_type FROM contacts');
    console.log('Contacts:', JSON.stringify(rows, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkContacts();
