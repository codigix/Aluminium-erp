const pool = require('../src/config/db');

async function check() {
  try {
    const [qr] = await pool.query('DESCRIBE quotation_requests');
    console.log('quotation_requests:');
    console.table(qr);
    const [so] = await pool.query('DESCRIBE sales_orders');
    console.log('sales_orders:');
    console.table(so);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

check();
