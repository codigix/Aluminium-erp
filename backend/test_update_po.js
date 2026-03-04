const pool = require('./src/config/db');

async function testUpdate() {
  try {
    console.log('🧪 Testing direct UPDATE of PO 37...\n');

    // Get current status
    const [before] = await pool.query('SELECT id, po_number, status FROM purchase_orders WHERE id = 37');
    console.log(`Before: ${before[0].po_number} - Status: ${before[0].status}\n`);

    // Try simple update with query (not execute)
    console.log('Method 1: Using pool.query()...');
    try {
      const [result] = await pool.query(
        'UPDATE purchase_orders SET status = ? WHERE id = ?',
        ['PENDING_PAYMENT', 37]
      );
      console.log('✅ Success with query()\n');
    } catch (err) {
      console.log(`❌ Failed: ${err.message}\n`);
    }

    // Try with execute
    console.log('Method 2: Using pool.execute()...');
    try {
      const [result] = await pool.execute(
        'UPDATE purchase_orders SET status = ? WHERE id = ?',
        ['PENDING_PAYMENT', 37]
      );
      console.log('✅ Success with execute()\n');
    } catch (err) {
      console.log(`❌ Failed: ${err.message}\n`);
    }

    // Check current status
    const [after] = await pool.query('SELECT status FROM purchase_orders WHERE id = 37');
    console.log(`After: Status = ${after[0].status}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testUpdate();
