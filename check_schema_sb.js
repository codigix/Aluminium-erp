const pool = require('./backend/src/config/db');
async function check() {
  try {
    const [cols] = await pool.query('SHOW COLUMNS FROM stock_balance');
    console.log('Stock Balance Columns:', cols.map(c => c.Field));
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
check();
