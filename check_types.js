const pool = require('./backend/src/config/db');
async function check() {
  try {
    const [sb] = await pool.query('SELECT DISTINCT material_type FROM stock_balance');
    const [poi] = await pool.query('SELECT DISTINCT material_type FROM purchase_order_items');
    console.log('Stock Balance Types:', sb.map(r => r.material_type));
    console.log('PO Item Types:', poi.map(r => r.material_type));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
