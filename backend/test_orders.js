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

  const [orders] = await pool.query('SELECT * FROM orders WHERE id IN (188, 202) OR order_no LIKE "%ORD14-09-2026%"');
  console.log('Orders 188 & 202:', orders);

  const [orderItems] = await pool.query('SELECT * FROM order_items WHERE order_id IN (188, 202)');
  console.log('Order items for 188 & 202:', orderItems.map(oi => ({ id: oi.id, order_id: oi.order_id, item_code: oi.item_code, drawing_no: oi.drawing_no, description: oi.description, quantity: oi.quantity })));

  // Check sales_orders or quotations linked to these orders
  if (orders.length > 0) {
    for (const ord of orders) {
      console.log(`Order ${ord.id} (${ord.order_no}) source_type: ${ord.source_type}, quotation_id: ${ord.quotation_id}`);
      if (ord.quotation_id) {
        // could be sales_orders or customer_pos or quotations
        const [so] = await pool.query('SELECT * FROM sales_orders WHERE id = ? OR customer_po_id = ?', [ord.quotation_id, ord.quotation_id]);
        console.log(`Linked sales_orders for order ${ord.id}:`, so);
        if (so.length > 0) {
          const soIds = so.map(s => s.id);
          const [soItems] = await pool.query('SELECT * FROM sales_order_items WHERE sales_order_id IN (?)', [soIds]);
          console.log(`Sales order items for order ${ord.id}:`, soItems);
        }
      }
    }
  }

  // Check sales_order_items where drawing_no = '09000693103'
  const [soItemsAll] = await pool.query('SELECT * FROM sales_order_items WHERE drawing_no = "09000693103" OR item_code = "09000693103"');
  console.log('All sales_order_items for 09000693103:', soItemsAll);

  // Check sales_order_item_materials where sales_order_item_id IN (above)
  if (soItemsAll.length > 0) {
    const ids = soItemsAll.map(s => s.id);
    const [mats] = await pool.query('SELECT * FROM sales_order_item_materials WHERE sales_order_item_id IN (?)', [ids]);
    console.log('Materials for sales_order_items:', mats);
  }

  // Check bom and bom_items tables if any
  const [boms] = await pool.query('SHOW TABLES LIKE "%bom%"');
  console.log('BOM tables:', boms);

  await pool.end();
})().catch(console.error);
