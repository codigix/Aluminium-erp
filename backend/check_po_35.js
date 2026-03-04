const pool = require('./src/config/db');

(async () => {
  try {
    const [po] = await pool.query('SELECT id, po_number, status, invoice_url FROM purchase_orders WHERE id = 35');

    if (po.length === 0) {
      console.log('❌ PO 35 not found');
      process.exit(0);
    }

    console.log('✅ PO 35 found:');
    console.log(`   PO Number: ${po[0].po_number}`);
    console.log(`   Status: ${po[0].status}`);
    console.log(`   Invoice URL: ${po[0].invoice_url}`);

    // Reset to FULFILLED if needed
    if (po[0].status !== 'FULFILLED') {
      await pool.query('UPDATE purchase_orders SET status = "FULFILLED" WHERE id = 35');
      console.log('\n✅ Reset status to FULFILLED');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
