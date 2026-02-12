const pool = require('./backend/src/config/db');

async function checkMR() {
  try {
    const mr_number = 'MR-20260212-001';
    const [mrs] = await pool.query('SELECT id FROM material_requests WHERE mr_number = ?', [mr_number]);
    
    if (mrs.length === 0) {
      console.log('MR not found');
      return;
    }
    
    const mrId = mrs[0].id;
    console.log(`Checking MR ID: ${mrId} (${mr_number})`);

    const [rows] = await pool.query(`
        SELECT 
        (
          SELECT CASE 
            WHEN COUNT(*) = 0 THEN 'available'
            WHEN COUNT(*) = SUM(CASE WHEN (SELECT SUM(current_balance) FROM stock_balance WHERE item_code = mri.item_code) >= COALESCE(NULLIF(mri.design_qty, 0), mri.quantity) THEN 1 ELSE 0 END) THEN 'available'
            ELSE 'unavailable'
          END
          FROM material_request_items mri
          WHERE mri.mr_id = ?
          AND UPPER(COALESCE(mri.item_type, '')) NOT IN ('FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY')
        ) as availability
    `, [mrId]);

    console.log('Query Result availability:', rows[0].availability);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkMR();
