const pool = require('./backend/src/config/db');
async function check() {
  try {
    const [shipCols] = await pool.query('SHOW COLUMNS FROM shipment_orders');
    console.log('Shipment Orders:', shipCols.map(c => c.Field));
    const [dcCols] = await pool.query('SHOW COLUMNS FROM delivery_challans');
    console.log('Delivery Challans:', dcCols.map(c => c.Field));
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
check();
