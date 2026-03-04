const pool = require('./src/config/db');

async function fixPO37() {
  try {
    console.log('🔧 Adding invoice_url to PO 37...\n');

    await pool.execute(
      'UPDATE purchase_orders SET invoice_url = ? WHERE id = ?',
      ['uploads/invoice-po-37.pdf', 37]
    );

    console.log('✅ Updated PO 37 with invoice_url\n');

    // Verify
    const [po] = await pool.query('SELECT id, po_number, invoice_url FROM purchase_orders WHERE id = 37');
    if (po.length > 0) {
      console.log(`✅ PO ${po[0].po_number}:`);
      console.log(`   Invoice URL: ${po[0].invoice_url}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixPO37();
