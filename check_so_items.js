const mysql = require('mysql2/promise');
require('dotenv').config({path: './backend/.env'});

async function main() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    const [rows] = await connection.query('SHOW COLUMNS FROM sales_order_items');
    console.log(JSON.stringify(rows, null, 2));
    await connection.end();
  } catch (error) {
    console.error(error);
  }
}
main();
