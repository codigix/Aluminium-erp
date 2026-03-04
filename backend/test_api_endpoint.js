const pool = require('./src/config/db');

async function testEndpoint() {
  try {
    console.log('🔍 Testing what getPurchaseOrders returns...\n');

    // Simulate what the API endpoint would return
    let query = `
      SELECT 
        po.*,
        v.vendor_name,
        mr.mr_number,
        COUNT(poi.id) as items_count
      FROM purchase_orders po
      LEFT JOIN vendors v ON v.id = po.vendor_id
      LEFT JOIN material_requests mr ON mr.id = po.mr_id
      LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
      WHERE po.invoice_url IS NOT NULL
      GROUP BY po.id 
      ORDER BY po.created_at DESC
    `;

    const [pos] = await pool.query(query);

    console.log(`Found ${pos.length} POs with invoice_url:\n`);
    
    pos.forEach(po => {
      console.log(`ID: ${po.id}`);
      console.log(`  PO Number: ${po.po_number}`);
      console.log(`  Status: ${po.status}`);
      console.log(`  Total Amount: ${po.total_amount}`);
      console.log(`  Invoice URL: ${po.invoice_url}`);
      console.log(`  Vendor: ${po.vendor_name}\n`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testEndpoint();
