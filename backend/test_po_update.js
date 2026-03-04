const pool = require('./src/config/db');

async function testPOUpdate() {
  try {
    console.log('🔧 Testing PO 37 status update with transaction...\n');

    const connection = await pool.getConnection();
    
    try {
      // Start transaction
      await connection.beginTransaction();
      
      // Check current status
      console.log('Step 1: Check current status');
      const [before] = await connection.query('SELECT id, po_number, status FROM purchase_orders WHERE id = 37');
      if (before.length === 0) {
        throw new Error('PO 37 not found');
      }
      console.log(`   Current status: ${before[0].status}`);

      // Try to update
      console.log('\nStep 2: Update status to PENDING_PAYMENT');
      console.log(`   SQL: UPDATE purchase_orders SET status = 'PENDING_PAYMENT' WHERE id = 37`);
      
      const result = await connection.execute(
        'UPDATE purchase_orders SET status = ? WHERE id = ?',
        ['PENDING_PAYMENT', 37]
      );
      
      console.log(`   ✅ Update successful`);
      console.log(`   Affected rows: ${result[0].affectedRows}`);

      // Check new status
      console.log('\nStep 3: Verify new status');
      const [after] = await connection.query('SELECT status FROM purchase_orders WHERE id = 37');
      console.log(`   New status: ${after[0].status}`);

      // Commit
      await connection.commit();
      console.log('\n✅ Transaction committed successfully');

    } catch (error) {
      await connection.rollback();
      console.error('\n❌ Error during transaction:', error.message);
      throw error;
    } finally {
      connection.release();
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testPOUpdate();
