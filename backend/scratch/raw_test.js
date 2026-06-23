const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function run() {
  console.log("Connecting to MySQL natively...");
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3307,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'spTech_dev'
    });
    console.log("Connection successful!");
    const [rows] = await connection.query('SELECT 1 + 1 as val');
    console.log("Query result:", rows);
  } catch (e) {
    console.error("Connection failed:", e);
  } finally {
    if (connection) {
      await connection.end();
      console.log("Connection closed.");
    }
  }
}
run();
