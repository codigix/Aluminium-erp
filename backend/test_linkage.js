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

  // Check order 202 (ORD14-09-2026-001)
  const [o202] = await pool.query('SELECT * FROM orders WHERE id = 202');
  console.log('Order 202:', o202[0]);

  // quotation_id for 202 is 397. Let's see what is 397:
  // Is it a quotation? customer_po? sales_order?
  const [q397] = await pool.query('SELECT * FROM quotations WHERE id = 397');
  console.log('Quotation 397:', q397.length > 0 ? q397[0] : 'None');

  const [cp397] = await pool.query('SELECT * FROM customer_pos WHERE id = 397');
  console.log('Customer PO 397:', cp397.length > 0 ? cp397[0] : 'None');

  const [so397] = await pool.query('SELECT * FROM sales_orders WHERE id = 397');
  console.log('Sales Order 397:', so397.length > 0 ? so397[0] : 'None');

  const [soByCp] = await pool.query('SELECT * FROM sales_orders WHERE customer_po_id = 397');
  console.log('Sales Order with customer_po_id = 397:', soByCp);

  // Now check order 188 (ORD26-07-2026-003):
  const [o188] = await pool.query('SELECT * FROM orders WHERE id = 188');
  console.log('Order 188:', o188[0]);
  const [cp376] = await pool.query('SELECT * FROM customer_pos WHERE id = 376');
  console.log('Customer PO 376:', cp376.length > 0 ? cp376[0] : 'None');
  const [soByCp376] = await pool.query('SELECT * FROM sales_orders WHERE customer_po_id = 376');
  console.log('Sales Order with customer_po_id = 376:', soByCp376);

  await pool.end();
})().catch(console.error);
