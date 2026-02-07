require('dotenv').config();
const pool = require('./src/config/db');

async function debug() {
  try {
    const [orders] = await pool.query(`
      SELECT so.id, so.company_id, c.company_name, cp.po_number, so.status
      FROM sales_orders so
      JOIN companies c ON so.company_id = c.id
      LEFT JOIN customer_pos cp ON so.customer_po_id = cp.id
      WHERE c.company_name LIKE '%Ashwini%'
    `);
    
    console.log('--- Sales Orders for Ashwini ---');
    console.log(JSON.stringify(orders, null, 2));

    for (const order of orders) {
      const [items] = await pool.query(`
        SELECT id, item_code, drawing_no, status, description
        FROM sales_order_items
        WHERE sales_order_id = ?
      `, [order.id]);
      console.log(`--- Items for Order ${order.id} ---`);
      console.log(JSON.stringify(items, null, 2));
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

debug();
