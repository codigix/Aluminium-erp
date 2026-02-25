const pool = require('./backend/src/config/db');

async function debugSchema() {
  try {
    console.log('--- Checking Current Schema ---');
    const [columns] = await pool.query("SHOW COLUMNS FROM shipment_orders LIKE 'status'");
    console.log('Status column definition:', columns[0]);

    console.log('\n--- Attempting Force Update ---');
    const alterQuery = `
      ALTER TABLE shipment_orders 
      MODIFY COLUMN status ENUM(
        'PENDING_ACCEPTANCE',
        'ACCEPTED',
        'REJECTED',
        'PLANNING',
        'PLANNED',
        'READY_TO_DISPATCH',
        'DISPATCHED',
        'IN_TRANSIT',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CLOSED',
        'RETURN_INITIATED',
        'RETURN_IN_TRANSIT',
        'RETURN_RECEIVED',
        'RETURN_COMPLETED'
      ) DEFAULT 'PENDING_ACCEPTANCE'
    `;
    await pool.query(alterQuery);
    console.log('ALTER TABLE executed.');

    const [newColumns] = await pool.query("SHOW COLUMNS FROM shipment_orders LIKE 'status'");
    console.log('New Status column definition:', newColumns[0]);

    // Test the update that was failing
    console.log('\n--- Testing Update Query ---');
    // Find a shipment to test with
    const [shipments] = await pool.query("SELECT id, status FROM shipment_orders LIMIT 1");
    if (shipments.length > 0) {
      const testId = shipments[0].id;
      const originalStatus = shipments[0].status;
      console.log(`Testing on ID ${testId} (Original: ${originalStatus})`);
      
      try {
        await pool.query("UPDATE shipment_orders SET status = 'RETURN_INITIATED' WHERE id = ?", [testId]);
        console.log('Update successful!');
        // Restore
        await pool.query("UPDATE shipment_orders SET status = ? WHERE id = ?", [originalStatus, testId]);
      } catch (err) {
        console.error('Update failed even after ALTER:', err.message);
      }
    } else {
      console.log('No shipments found to test update.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Debug failed:', error);
    process.exit(1);
  }
}

debugSchema();
