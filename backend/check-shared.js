const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'backend/.env' });

async function check() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
  });

  try {
    const [rows] = await connection.query("SELECT id, client_name, drawing_no, status, shared_with_design FROM customer_drawings WHERE client_name = 'xdcfvbn'");
    console.log('Drawings for xdcfvbn:', JSON.stringify(rows, null, 2));
    
    const [allShared] = await connection.query("SELECT id, client_name, drawing_no, status FROM customer_drawings WHERE status = 'SHARED'");
    console.log('All SHARED drawings:', JSON.stringify(allShared, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

check();
