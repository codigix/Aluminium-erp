const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
  });

  try {
    await connection.query("INSERT INTO migrations (file_name) VALUES (?)", ['003-grn-item-logic.sql']);
    console.log("Marked 003-grn-item-logic.sql as applied.");
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      console.log("Already marked.");
    } else {
      console.error(err);
    }
  } finally {
    await connection.end();
  }
}

run();
