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

  const [sos] = await pool.query('SELECT id, customer_po_id, company_id, status FROM sales_orders WHERE customer_po_id IN (376, 397) OR id IN (376, 397)');
  console.log('sales_orders for 376, 397:', sos);

  if (sos.length > 0) {
    const soIds = sos.map(s => s.id);
    const [soItems] = await pool.query('SELECT id, sales_order_id, item_code, drawing_no, description, quantity FROM sales_order_items WHERE sales_order_id IN (?)', [soIds]);
    console.log('sales_order_items:', soItems);

    const soiIds = soItems.map(s => s.id);
    if (soiIds.length > 0) {
      const [mats] = await pool.query('SELECT * FROM sales_order_item_materials WHERE sales_order_item_id IN (?)', [soiIds]);
      console.log('sales_order_item_materials:', mats);
    }
  }

  // Also let's check what sales_order_items exist for quotation_id 397 or sales_order_id = 397
  // Notice in task-76 output:
  // sales_order_id: 397 had ALL THOSE ITEMS!
  // E.g.:
  // id: 100179, bom_id: 100179, sales_order_id: 397, drawing_no: '09000555304'
  // id: 100180, bom_id: 100180, sales_order_id: 397, drawing_no: '09000555102'
  // Let's check sales_order_items WHERE sales_order_id = 397
  const [soi397] = await pool.query('SELECT id, sales_order_id, item_code, drawing_no, description FROM sales_order_items WHERE sales_order_id = 397');
  console.log('sales_order_items for sales_order_id 397 count:', soi397.length);
  console.log('Drawings in sales_order_id 397:', soi397.map(s => s.drawing_no));

  await pool.end();
})().catch(console.error);
