
const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function check() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    const drawing = 'DRW_101';
    console.log(`Checking data for Drawing: ${drawing}`);

    // Check Materials
    const [m] = await pool.query('SELECT COUNT(*) as count FROM sales_order_item_materials WHERE drawing_no = ?', [drawing]);
    const [m_master] = await pool.query('SELECT COUNT(*) as count FROM sales_order_item_materials WHERE drawing_no = ? AND sales_order_item_id IS NULL', [drawing]);
    
    // Check Components
    const [c] = await pool.query('SELECT COUNT(*) as count FROM sales_order_item_components WHERE drawing_no = ?', [drawing]);
    const [c_master] = await pool.query('SELECT COUNT(*) as count FROM sales_order_item_components WHERE drawing_no = ? AND sales_order_item_id IS NULL', [drawing]);

    // Check Operations
    const [o] = await pool.query('SELECT COUNT(*) as count FROM sales_order_item_operations WHERE drawing_no = ?', [drawing]);
    const [o_master] = await pool.query('SELECT COUNT(*) as count FROM sales_order_item_operations WHERE drawing_no = ? AND sales_order_item_id IS NULL', [drawing]);

    console.log(`Materials: Total=${m[0].count}, Master=${m_master[0].count}`);
    console.log(`Components: Total=${c[0].count}, Master=${c_master[0].count}`);
    const [oi_ids] = await pool.query('SELECT id FROM order_items WHERE drawing_no = ?', [drawing]);
    console.log('order_items IDs for DRW_101:', oi_ids.map(r => r.id));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
