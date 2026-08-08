const mysql = require('mysql2/promise');

async function fix() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'aluminium_user',
    password: 'C0digix$309',
    database: 'spTech_prod',
    port: 3307
  });

  try {
    await conn.beginTransaction();

    // 1. Delete wrong stock ledger entries for GRN-78 and GRN-79 (they used wrong item codes)
    const [delLedger] = await conn.execute(
      'DELETE FROM stock_ledger WHERE reference_doc_type = "GRN" AND reference_doc_id IN (78, 79)'
    );
    console.log('Deleted ledger entries:', delLedger.affectedRows);

    // 2. Delete wrong stock_entries SE-PARTIAL-GRN0078 and SE-PARTIAL-GRN0079
    const [delSE] = await conn.execute(
      'DELETE FROM stock_entries WHERE grn_id IN (78, 79)'
    );
    console.log('Deleted stock entries:', delSE.affectedRows);

    // 3. Fix RM-ALUMINIUM6-0001 balance (wrongly created) - set to 0 or remove
    const [fixBal] = await conn.execute(
      'UPDATE stock_balance SET current_balance = 0 WHERE item_code = "RM-ALUMINIUM6-0001"'
    );
    console.log('Reset RM-ALUMINIUM6-0001 balance:', fixBal.affectedRows);

    await conn.commit();
    console.log('Cleanup complete! Now re-click Release Stock for GRN-0078 and GRN-0079.');
  } catch (e) {
    await conn.rollback();
    console.error('Error:', e.message);
  } finally {
    await conn.end();
  }
}
fix();
