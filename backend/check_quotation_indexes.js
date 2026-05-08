const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkIndexes() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [rows] = await connection.query('SHOW INDEX FROM quotations');
    console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    console.error('Error checking indexes:', error);
  } finally {
    await connection.end();
  }
}

checkIndexes();
