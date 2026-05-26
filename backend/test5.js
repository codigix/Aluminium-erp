const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: 'spTech_dev',
    port: process.env.DB_PORT || 3306
  });

  const [rows] = await pool.query("SELECT * FROM sales_orders WHERE public_id = ?", ['49deaab5-9d7a-4112-b087-15f714643858']);
  console.log(rows);
  pool.end();
}

run();
