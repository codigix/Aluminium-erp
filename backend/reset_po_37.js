const pool = require('./src/config/db');

(async () => {
  try {
    await pool.execute('UPDATE purchase_orders SET status = ? WHERE id = ?', ['FULFILLED', 37]);
    console.log('✅ Reset PO 37 to FULFILLED');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
