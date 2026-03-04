const pool = require('./src/config/db');

(async () => {
  try {
    console.log('🔍 Testing what /purchase-orders endpoint returns...\n');

    // Simulate what getPurchaseOrders returns
    let query = `
      SELECT 
        po.id,
        po.po_number,
        po.status,
        po.total_amount,
        po.vendor_id,
        po.invoice_url,
        po.created_at,
        v.vendor_name
      FROM purchase_orders po
      LEFT JOIN vendors v ON v.id = po.vendor_id
      ORDER BY po.created_at DESC
    `;

    const [pos] = await pool.query(query);

    console.log(`All POs (${pos.length}):\n`);
    
    pos.forEach(po => {
      const hasInvoice = po.invoice_url ? '✅' : '❌';
      console.log(`${hasInvoice} ID: ${po.id} | ${po.po_number} | Status: ${po.status} | Invoice: ${po.invoice_url}`);
    });

    console.log('\n\n📊 Filtered to only POs with invoice_url:\n');
    const withInvoice = pos.filter(p => p.invoice_url);
    withInvoice.forEach(po => {
      console.log(`✅ ID: ${po.id} | ${po.po_number} | Status: ${po.status}`);
    });

    console.log(`\n\nTotal with invoice_url: ${withInvoice.length}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
