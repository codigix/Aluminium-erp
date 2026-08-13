const pool = require('./src/config/db');

async function test() {
  console.log('--- TESTING MATERIAL REQUEST STOCK AVAILABILITY ---');
  
  const connection = pool;
  
  // Simulate the item from MR id=142 as reported by user
  const testItems = [
    { item_code: 'RM-ALUMINUMSH-0001', item_name: 'aluminum sheet', length: 1000, width: 12, thickness: 0, diameter: 0, outer_diameter: 0, shape_type: 'Square Bar' },
    { item_code: 'RM-ALIUMNINUM-0001', item_name: 'ALIUMNINUM PLATE', length: 130, width: 40, thickness: 50, diameter: 0, outer_diameter: 0, shape_type: 'Flat Bar' },
    { item_code: 'RM-ALUMINUMSQ-0001', item_name: 'aluminum square tube', length: 300, width: 120, thickness: 40, diameter: 0, outer_diameter: 0, shape_type: 'Square Tube' },
  ];

  for (const item of testItems) {
    // Query stock_balance with dimension filter (the NEW logic)
    const lengthVal = parseFloat(item.length || 0);
    const widthVal = parseFloat(item.width || 0);
    const thicknessVal = parseFloat(item.thickness || 0);
    const diameterVal = parseFloat(item.diameter || 0);
    const outerDiameterVal = parseFloat(item.outer_diameter || 0);
    const hasDimensions = (lengthVal > 0 || widthVal > 0 || thicknessVal > 0 || diameterVal > 0 || outerDiameterVal > 0);

    let query = `SELECT item_code, warehouse, current_balance, current_weight, length, width, thickness, diameter, outer_diameter FROM stock_balance WHERE item_code = ? AND current_balance > 0`;
    const params = [item.item_code];

    if (hasDimensions) {
      query += ' AND (ABS(COALESCE(length, 0) - ?) < 0.0001)'; params.push(lengthVal);
      query += ' AND (ABS(COALESCE(width, 0) - ?) < 0.0001)'; params.push(widthVal);
      query += ' AND (ABS(COALESCE(thickness, 0) - ?) < 0.0001)'; params.push(thicknessVal);
      query += ' AND (ABS(COALESCE(diameter, 0) - ?) < 0.0001)'; params.push(diameterVal);
      query += ' AND (ABS(COALESCE(outer_diameter, 0) - ?) < 0.0001)'; params.push(outerDiameterVal);
    }

    const [rows] = await pool.query(query, params);
    
    console.log(`\nItem: ${item.item_code} | ${item.item_name} | L=${item.length} W=${item.width} T=${item.thickness}`);
    if (rows.length === 0) {
      console.log('  → NO MATCHING STOCK for this exact dimension');
    } else {
      rows.forEach(r => {
        console.log(`  → Warehouse: ${r.warehouse} | Balance: ${r.current_balance} | Weight: ${r.current_weight} | L=${r.length} W=${r.width} T=${r.thickness}`);
      });
    }
  }

  // Also show all stock_balance rows for RM-ALUMINUMSH-0001 to show dimension isolation works
  const [allRows] = await pool.query(`SELECT item_code, warehouse, current_balance, length, width, thickness, diameter, outer_diameter FROM stock_balance WHERE item_code = 'RM-ALUMINUMSH-0001' ORDER BY length, width`);
  console.log('\n--- All stock_balance rows for RM-ALUMINUMSH-0001 (should be dimension-wise) ---');
  allRows.forEach(r => console.log(`  Warehouse: ${r.warehouse} | Balance: ${r.current_balance} | L=${r.length} W=${r.width} T=${r.thickness} D=${r.diameter} OD=${r.outer_diameter}`));

  process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });
