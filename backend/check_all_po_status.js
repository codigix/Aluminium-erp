const pool = require('./src/config/db');

(async () => {
  try {
    console.log('📋 Checking all PO statuses in database...\n');

    const [pos] = await pool.query(`
      SELECT id, po_number, status, vendor_id, invoice_url FROM purchase_orders ORDER BY id DESC
    `);

    pos.forEach(po => {
      const hasInvoice = po.invoice_url ? '✅' : '❌';
      console.log(`${hasInvoice} ID: ${po.id} | ${po.po_number} | Status: "${po.status}"`);
    });

    // Check the ENUM definition again
    console.log('\n\n📊 Current ENUM definition:');
    const [columns] = await pool.query(`
      SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'sales_erp' 
      AND TABLE_NAME = 'purchase_orders' 
      AND COLUMN_NAME = 'status'
    `);

    if (columns.length > 0) {
      const values = columns[0].COLUMN_TYPE.match(/enum\((.*)\)/i)[1]
        .split(',')
        .map(v => v.trim().replace(/'/g, ''));
      
      console.log(`Values: ${values.join(', ')}`);
      console.log(`\n'PENDING_PAYMENT' in ENUM: ${values.includes('PENDING_PAYMENT') ? '✅ YES' : '❌ NO'}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
