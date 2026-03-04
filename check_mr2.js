const pool = require('./backend/src/config/db');

async function checkMR() {
  try {
    const mr_number = 'MR-20260212-002';
    const [mrs] = await pool.query('SELECT id FROM material_requests WHERE mr_number = ?', [mr_number]);
    
    if (mrs.length === 0) {
      console.log('MR not found');
      return;
    }
    
    const mrId = mrs[0].id;
    console.log(`Checking MR ID: ${mrId} (${mr_number})`);

    const [items] = await pool.query(`
      SELECT mri.item_code, mri.item_type, mri.design_qty, mri.quantity,
      (SELECT SUM(current_balance) FROM stock_balance WHERE item_code = mri.item_code) as total_stock
      FROM material_request_items mri
      WHERE mri.mr_id = ?
    `, [mrId]);

    console.log('Items:');
    items.forEach(item => {
      const required = parseFloat(item.design_qty || item.quantity || 0);
      const stock = parseFloat(item.total_stock || 0);
      const isAvailable = stock >= required;
      console.log(`Code: ${item.item_code}, Type: ${item.item_type}, Required: ${required}, Stock: ${stock}, Available: ${isAvailable}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkMR();
