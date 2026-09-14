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

  const tables = ['sales_order_items', 'sales_order_item_materials', 'sales_order_item_components', 'sales_order_item_operations', 'order_items', 'bom', 'bom_items', 'orders', 'sales_orders'];
  for (const t of tables) {
    const [rows] = await pool.query(`SELECT * FROM \`${t}\` ORDER BY id DESC LIMIT 3`);
    console.log(`=== Last 3 rows in ${t} ===`);
    console.log(rows);
  }

  // Also check if 09000693103 was added anywhere recently
  console.log('\n=== Checking 09000693103 across tables ===');
  const [soi] = await pool.query('SELECT * FROM sales_order_items WHERE drawing_no LIKE "%09000693103%"');
  console.log('sales_order_items for 09000693103:', soi);

  const [som] = await pool.query('SELECT * FROM sales_order_item_materials WHERE drawing_no LIKE "%09000693103%" OR item_code LIKE "%09000693103%"');
  console.log('sales_order_item_materials for 09000693103:', som);

  const [oi] = await pool.query('SELECT * FROM order_items WHERE drawing_no LIKE "%09000693103%"');
  console.log('order_items for 09000693103:', oi);

  await pool.end();
})().catch(console.error);
