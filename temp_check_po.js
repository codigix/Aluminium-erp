const pool = require('./backend/src/config/db');
async function run() {
  try {
    const [po] = await pool.query('SELECT * FROM purchase_orders WHERE po_number = "PO-2026-0002"');
    if (po.length === 0) {
      console.log('PO not found');
      process.exit(0);
    }
    console.log('PO:', JSON.stringify(po[0], null, 2));
    const [items] = await pool.query('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?', [po[0].id]);
    console.log('Items:', JSON.stringify(items, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
