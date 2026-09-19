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

  const [orders] = await pool.query('SELECT id, order_no, quotation_id, source_type FROM orders WHERE id IN (188, 202)');
  console.log('Orders 188 and 202:', orders);

  // Check what design orders exist for 188 and 202
  const [designOrders] = await pool.query('SHOW TABLES LIKE "%design%"');
  console.log('Design tables:', designOrders);

  const [doRows] = await pool.query('SELECT * FROM design_orders WHERE order_id IN (188, 202) OR sales_order_id IN (188, 202) LIMIT 10');
  console.log('design_orders:', doRows);

  if (doRows.length > 0) {
    const doIds = doRows.map(d => d.id);
    const [doItems] = await pool.query('SELECT * FROM design_order_items WHERE design_order_id IN (?)', [doIds]);
    console.log('design_order_items for 188/202:', doItems);
  }

  // Also check bom and bom_items for drawing 09000693103 or orders 188/202
  const [boms] = await pool.query('SELECT * FROM bom WHERE item_code LIKE "%09000693103%" OR bom_no LIKE "%09000693103%" OR sales_order_id IN (188, 202)');
  console.log('boms in bom table:', boms);

  await pool.end();
})().catch(console.error);
