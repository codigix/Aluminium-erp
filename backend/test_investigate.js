const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3307,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  const [cd] = await pool.query('SELECT * FROM customer_drawings WHERE drawing_no = "09000693103"');
  console.log('customer_drawings:', cd);

  const [it] = await pool.query('SELECT * FROM items WHERE item_code LIKE "%09000693103%" OR drawing_no LIKE "%09000693103%"');
  console.log('items table:', it);

  await pool.end();
})().catch(console.error);
