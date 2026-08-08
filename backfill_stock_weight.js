const mysql = require('./backend/node_modules/mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sales_erp'
  });

  // Backfill weight_in from qc_inspection_items for QC-created stock entries
  const [r1] = await conn.query(`
    UPDATE stock_ledger sl
    INNER JOIN qc_inspection_items qci 
      ON sl.qc_id = qci.qc_inspection_id 
      AND sl.grn_item_id = qci.grn_item_id
    SET sl.weight_in = COALESCE(qci.accepted_weight, 0),
        sl.weight_out = 0
    WHERE sl.transaction_type = 'IN' 
      AND sl.weight_in = 0 
      AND COALESCE(qci.accepted_weight, 0) > 0
  `);
  console.log('Backfilled ledger weight_in rows:', r1.affectedRows);

  // Now recalculate running weight_after per item for each ledger row
  // Get all items that have weight_in > 0
  const [rows] = await conn.query(`
    SELECT DISTINCT item_code FROM stock_ledger WHERE weight_in > 0 OR weight_out > 0
  `);
  
  for (const row of rows) {
    const itemCode = row.item_code;
    const [ledgerRows] = await conn.query(
      `SELECT id, weight_in, weight_out FROM stock_ledger WHERE item_code = ? ORDER BY id ASC`,
      [itemCode]
    );
    let running = 0;
    for (const lr of ledgerRows) {
      running += (parseFloat(lr.weight_in) || 0) - (parseFloat(lr.weight_out) || 0);
      if (running < 0) running = 0;
      await conn.query('UPDATE stock_ledger SET weight_after = ? WHERE id = ?', [running, lr.id]);
    }
    console.log(`Updated weight_after for ${itemCode}: ${running} KG`);
  }

  // Refresh stock_balance current_weight from ledger
  const [r2] = await conn.query(`
    UPDATE stock_balance sb
    INNER JOIN (
      SELECT item_code, GREATEST(0, SUM(weight_in - weight_out)) as cw 
      FROM stock_ledger 
      GROUP BY item_code
    ) sl ON sb.item_code = sl.item_code
    SET sb.current_weight = sl.cw
  `);
  console.log('Refreshed stock_balance current_weight rows:', r2.affectedRows);

  // Verify
  const [verify] = await conn.query(`SELECT item_code, material_name, current_balance, current_weight FROM stock_balance WHERE current_weight > 0 LIMIT 10`);
  console.log('Sample balances:');
  verify.forEach(v => console.log(JSON.stringify(v)));

  await conn.end();
  console.log('Done');
})().catch(console.error);
