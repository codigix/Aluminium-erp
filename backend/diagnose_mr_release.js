const pool = require('./src/config/db');

async function diagnose() {
  const mrId = 142;
  console.log(`\n=== DIAGNOSING MR ${mrId} RELEASE ===\n`);

  const [items] = await pool.query('SELECT * FROM material_request_items WHERE mr_id = ?', [mrId]);
  console.log(`Total items in MR ${mrId}: ${items.length}`);

  for (const item of items) {
    console.log(`\n--- Item: ${item.item_code} | ${item.item_name} | UOM: ${item.uom}`);
    console.log(`    Dimensions: L=${item.length} W=${item.width} T=${item.thickness} D=${item.diameter} OD=${item.outer_diameter}`);
    console.log(`    Qty: ${item.quantity} | DesignQty: ${item.design_qty} | AllocQty: ${item.allocated_quantity}`);

    const lenV = parseFloat(item.length || 0);
    const widV = parseFloat(item.width || 0);
    const thkV = parseFloat(item.thickness || 0);
    const diaV = parseFloat(item.diameter || 0);
    const odV  = parseFloat(item.outer_diameter || 0);
    const hasDim = lenV > 0 || widV > 0 || thkV > 0 || diaV > 0 || odV > 0;

    // Query stock_balance WITH dimension filter (as per fix)
    let query = `SELECT item_code, warehouse, current_balance, current_weight, length, width, thickness, diameter, outer_diameter FROM stock_balance WHERE item_code = ? AND current_balance > 0`;
    const params = [item.item_code];
    if (hasDim) {
      query += ' AND (ABS(COALESCE(length, 0) - ?) < 0.0001)'; params.push(lenV);
      query += ' AND (ABS(COALESCE(width, 0) - ?) < 0.0001)'; params.push(widV);
      query += ' AND (ABS(COALESCE(thickness, 0) - ?) < 0.0001)'; params.push(thkV);
      query += ' AND (ABS(COALESCE(diameter, 0) - ?) < 0.0001)'; params.push(diaV);
      query += ' AND (ABS(COALESCE(outer_diameter, 0) - ?) < 0.0001)'; params.push(odV);
    }
    query += ' ORDER BY current_balance DESC';

    const [stockRows] = await pool.query(query, params);
    if (stockRows.length === 0) {
      console.log(`    ⚠ NO STOCK FOUND with dimension filter`);

      // Show what stock_balance has for this item_code without dimension filter
      const [allRows] = await pool.query(
        `SELECT item_code, warehouse, current_balance, current_weight, length, width, thickness, diameter, outer_diameter FROM stock_balance WHERE item_code = ?`,
        [item.item_code]
      );
      console.log(`    All stock_balance rows for ${item.item_code}:`);
      allRows.forEach(r => console.log(`      Wh: ${r.warehouse} | Bal: ${r.current_balance} | L=${r.length} W=${r.width} T=${r.thickness} D=${r.diameter} OD=${r.outer_diameter}`));
    } else {
      stockRows.forEach(r => {
        console.log(`    ✓ Stock found: Wh=${r.warehouse} | Bal=${r.current_balance} | Wt=${r.current_weight} | L=${r.length} W=${r.width} T=${r.thickness}`);
      });

      // Now simulate what addStockLedgerEntry will do with getStockBalanceByItemAndWarehouse
      const wh = stockRows[0].warehouse || '';
      const dimsObj = { length: lenV, width: widV, thickness: thkV, diameter: diaV, outer_diameter: odV };
      let innerQuery = `SELECT * FROM stock_balance WHERE item_code = ? AND (warehouse = ? OR (warehouse IS NULL AND (? IS NULL OR ? = '')))`;
      const innerParams = [item.item_code, wh, wh, wh];
      innerQuery += ` AND (ABS(COALESCE(length, 0) - COALESCE(?, 0)) < 0.0001)`;
      innerQuery += ` AND (ABS(COALESCE(width, 0) - COALESCE(?, 0)) < 0.0001)`;
      innerQuery += ` AND (ABS(COALESCE(thickness, 0) - COALESCE(?, 0)) < 0.0001)`;
      innerQuery += ` AND (ABS(COALESCE(diameter, 0) - COALESCE(?, 0)) < 0.0001)`;
      innerQuery += ` AND (ABS(COALESCE(outer_diameter, 0) - COALESCE(?, 0)) < 0.0001)`;
      innerParams.push(lenV, widV, thkV, diaV, odV);
      innerQuery += ` ORDER BY current_balance DESC`;

      const [innerRows] = await pool.query(innerQuery, innerParams);
      if (innerRows.length === 0) {
        console.log(`    ✗ addStockLedgerEntry will find NO balance row (Wh+Dim mismatch) → will get currentBalance=0 → WILL THROW!`);
      } else {
        console.log(`    ✓ addStockLedgerEntry will find balance row: Bal=${innerRows[0].current_balance}`);
      }
    }
  }

  process.exit(0);
}

diagnose().catch(e => { console.error(e.message); process.exit(1); });
