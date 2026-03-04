const pool = require('./src/config/db');

async function listPOs() {
  try {
    console.log('📋 Purchase Orders in Database:\n');

    const [pos] = await pool.query(`
      SELECT 
        id,
        po_number,
        status,
        total_amount,
        vendor_id,
        quotation_id,
        created_at
      FROM purchase_orders
      ORDER BY id DESC
      LIMIT 20
    `);

    if (pos.length === 0) {
      console.log('❌ No purchase orders found!');
      process.exit(0);
    }

    console.log(`Found ${pos.length} POs:\n`);
    pos.forEach(po => {
      const statusIcon = po.status === 'FULFILLED' || po.status === 'APPROVED' ? '🟢' : '⚪';
      console.log(`${statusIcon} ID: ${po.id} | PO: ${po.po_number} | Status: ${po.status} | Amount: ₹${po.total_amount}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listPOs();
