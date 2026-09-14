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

  const [boms] = await pool.query('SELECT * FROM bom WHERE item_code LIKE "%09000693103%" OR drawing_no LIKE "%09000693103%"');
  console.log('bom matches:', boms);

  // Check sales_order_items for drawing 09000693103
  const [sois] = await pool.query('SELECT id, sales_order_id, item_code, drawing_no, description, quantity FROM sales_order_items WHERE drawing_no = "09000693103"');
  console.log('sales_order_items for drawing 09000693103:', sois);

  // For order 202, what items exist in order_items?
  const [oi202] = await pool.query('SELECT id, order_id, item_code, drawing_no, description, quantity FROM order_items WHERE order_id = 202');
  console.log('order_items for order 202 count:', oi202.length);
  const match202 = oi202.find(i => i.drawing_no === '09000693103');
  console.log('order 202 match for 09000693103:', match202);

  // For order 188, what items exist in order_items?
  const [oi188] = await pool.query('SELECT id, order_id, item_code, drawing_no, description, quantity FROM order_items WHERE order_id = 188');
  console.log('order_items for order 188 count:', oi188.length);
  const match188 = oi188.find(i => i.drawing_no === '09000693103');
  console.log('order 188 match for 09000693103:', match188);

  await pool.end();
})().catch(console.error);
