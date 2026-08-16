const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

const tablesWithItemCode = [
  'bom',
  'customer_po_items',
  'delivery_challan_items',
  'inventory',
  'inward_challan_items',
  'items',
  'job_card_inward_item_rates',
  'material_issue_items',
  'material_request_items',
  'order_item_components',
  'order_item_materials',
  'order_item_operations',
  'order_item_scrap',
  'order_items',
  'outward_challan_items',
  'po_receipt_items',
  'procurement_rfq_items',
  'production_plan_items',
  'production_plan_materials',
  'production_plan_sub_assemblies',
  'purchase_order_items',
  'qc_inspection_items',
  'quotation_items',
  'quotation_requests',
  'sales_order_item_components',
  'sales_order_item_materials',
  'sales_order_item_operations',
  'sales_order_item_scrap',
  'sales_order_items',
  'shipment_order_items',
  'shipment_return_items',
  'stock_balance',
  'stock_entry_items',
  'stock_ledger',
  'work_order_material_consumption',
  'work_orders'
];

function getCanonicalCode(codes) {
  // 1. Prefer RM- code if it exists
  const rmCode = codes.find(c => c.startsWith('RM-'));
  if (rmCode) return rmCode;

  // 2. Sort to find best base name length (descending) and lowest numerical suffix (ascending)
  const sorted = [...codes].sort((a, b) => {
    const getParts = (c) => {
      const parts = c.split('-');
      const suffix = parseInt(parts[parts.length - 1], 10) || 9999;
      const base = parts.slice(0, -1).join('-');
      return { suffix, base };
    };
    const pa = getParts(a);
    const pb = getParts(b);
    
    // Compare base name length (longer is better, e.g. ALUMINUMSHEET > ALUMINUMSH)
    if (pa.base.length !== pb.base.length) {
      return pb.base.length - pa.base.length; // Descending order of length
    }
    // Compare suffix ascending (1 is better than 4)
    return pa.suffix - pb.suffix;
  });

  return sorted[0];
}

async function migrate() {
  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'aluminium_user',
    password: process.env.DB_PASSWORD || 'C0digix$309',
    database: process.env.DB_NAME || 'spTech_dev',
    port: parseInt(process.env.DB_PORT || '3307')
  };

  const connection = await mysql.createConnection(config);
  try {
    console.log('Starting data migration for duplicate item codes...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // 1. Find all duplicate material groups
    const [groups] = await connection.query(`
      SELECT LOWER(TRIM(material_name)) as norm_name, 
             GROUP_CONCAT(DISTINCT item_code ORDER BY item_code) as codes_str
      FROM stock_balance 
      WHERE material_name IS NOT NULL AND material_name != ''
      GROUP BY LOWER(TRIM(material_name))
      HAVING COUNT(DISTINCT item_code) > 1
    `);

    console.log(`Found ${groups.length} material groups with duplicate item codes.`);

    for (const group of groups) {
      const codes = group.codes_str.split(',');
      const canonical = getCanonicalCode(codes);
      const duplicates = codes.filter(c => c !== canonical);

      console.log(`\nGroup [${group.norm_name}] -> Canonical: [${canonical}], Duplicates: [${duplicates.join(', ')}]`);

      // A. Populate dimension columns in stock_ledger for all codes in this group (canonical + duplicates)
      for (const code of codes) {
        const [balRows] = await connection.query(
          `SELECT length, width, thickness, diameter, outer_diameter, density 
           FROM stock_balance 
           WHERE item_code = ? AND (length > 0 OR width > 0 OR thickness > 0 OR diameter > 0 OR outer_diameter > 0)
           LIMIT 1`,
          [code]
        );

        if (balRows.length > 0) {
          const b = balRows[0];
          console.log(`  Populating stock_ledger dimensions for ${code}: L=${b.length}, W=${b.width}, T=${b.thickness}`);
          await connection.query(
            `UPDATE stock_ledger SET 
               length = ?, width = ?, thickness = ?, diameter = ?, outer_diameter = ?, density = ?
             WHERE item_code = ? AND (length IS NULL AND width IS NULL AND thickness IS NULL AND diameter IS NULL AND outer_diameter IS NULL)`,
            [b.length, b.width, b.thickness, b.diameter, b.outer_diameter, b.density, code]
          );
        }
      }

      // B. Remap duplicate codes to canonical code in all 36 tables
      for (const dup of duplicates) {
        console.log(`  Remapping ${dup} -> ${canonical}...`);
        for (const tbl of tablesWithItemCode) {
          const [res] = await connection.query(
            `UPDATE \`${tbl}\` SET item_code = ? WHERE item_code = ?`,
            [canonical, dup]
          );
          if (res.affectedRows > 0) {
            console.log(`    Updated ${res.affectedRows} rows in ${tbl}`);
          }
        }
      }

      // C. Merge stock_balance records for canonical code that share same warehouse and dimensions
      const [balList] = await connection.query(
        'SELECT * FROM stock_balance WHERE item_code = ?',
        [canonical]
      );

      // Group by warehouse + dimensions (using 4 decimal places exact match or float diff check)
      const groupsToMerge = {};
      for (const row of balList) {
        const wh = row.warehouse || '';
        const len = parseFloat(row.length || 0).toFixed(4);
        const wid = parseFloat(row.width || 0).toFixed(4);
        const thk = parseFloat(row.thickness || 0).toFixed(4);
        const dia = parseFloat(row.diameter || 0).toFixed(4);
        const odia = parseFloat(row.outer_diameter || 0).toFixed(4);

        const key = `${wh}_L${len}_W${wid}_T${thk}_D${dia}_OD${odia}`;
        if (!groupsToMerge[key]) {
          groupsToMerge[key] = [];
        }
        groupsToMerge[key].push(row);
      }

      for (const key in groupsToMerge) {
        const rows = groupsToMerge[key];
        if (rows.length > 1) {
          // Merge duplicates
          const kept = rows[0];
          const dups = rows.slice(1);
          console.log(`  Merging ${rows.length} stock_balance rows for key ${key} (Kept ID: ${kept.id})`);

          let totalBalance = parseFloat(kept.current_balance || 0);
          let totalWeight = parseFloat(kept.current_weight || 0);
          let totalQtyIn = parseFloat(kept.qty_in || 0);
          let totalQtyOut = parseFloat(kept.qty_out || 0);
          let totalPoQty = parseFloat(kept.po_qty || 0);
          let totalReceivedQty = parseFloat(kept.received_qty || 0);
          let totalAcceptedQty = parseFloat(kept.accepted_qty || 0);
          let totalIssuedQty = parseFloat(kept.issued_qty || 0);

          for (const dup of dups) {
            totalBalance += parseFloat(dup.current_balance || 0);
            totalWeight += parseFloat(dup.current_weight || 0);
            totalQtyIn += parseFloat(dup.qty_in || 0);
            totalQtyOut += parseFloat(dup.qty_out || 0);
            totalPoQty += parseFloat(dup.po_qty || 0);
            totalReceivedQty += parseFloat(dup.received_qty || 0);
            totalAcceptedQty += parseFloat(dup.accepted_qty || 0);
            totalIssuedQty += parseFloat(dup.issued_qty || 0);

            // Delete duplicate stock_balance row
            await connection.query('DELETE FROM stock_balance WHERE id = ?', [dup.id]);
          }

          // Update kept row
          await connection.query(
            `UPDATE stock_balance SET 
               current_balance = ?, current_weight = ?, 
               qty_in = ?, qty_out = ?, po_qty = ?, 
               received_qty = ?, accepted_qty = ?, issued_qty = ?
             WHERE id = ?`,
            [totalBalance, totalWeight, totalQtyIn, totalQtyOut, totalPoQty, totalReceivedQty, totalAcceptedQty, totalIssuedQty, kept.id]
          );
        }
      }
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('\nData migration completed successfully.');
  } catch (error) {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

migrate();
