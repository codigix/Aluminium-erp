const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'backend/.env' });

async function listTables() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
  });

  try {
    const [tables] = await connection.query('SHOW TABLES');
    console.log('Tables:', JSON.stringify(tables, null, 2));
    
    const [columns] = await connection.query('SHOW COLUMNS FROM customer_drawings');
    console.log('Columns in customer_drawings:', JSON.stringify(columns, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

listTables();
