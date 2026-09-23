const pool = require('../src/config/db');

async function fixDb() {
  try {
    // 1. Update sales_order_items for 00Y315W where item_group = 'Assembly'
    const [res1] = await pool.query(
      "UPDATE sales_order_items SET drawing_type = 'Assembly' WHERE (drawing_no = '00Y315W' OR item_code LIKE '%00Y315W%') AND (item_group = 'Assembly' OR item_code LIKE 'ASSEMBLY-%')"
    );
    console.log('Updated sales_order_items for 00Y315W:', res1.affectedRows);

    // 2. Ensure customer_drawings has drawing_type = 'Assembly'
    const [res2] = await pool.query(
      "UPDATE customer_drawings SET drawing_type = 'Assembly' WHERE drawing_no = '00Y315W'"
    );
    console.log('Updated customer_drawings for 00Y315W:', res2.affectedRows);

    // 3. Ensure stock_balance has material_type = 'ASSEMBLY'
    const [res3] = await pool.query(
      "UPDATE stock_balance SET material_type = 'ASSEMBLY' WHERE drawing_no = '00Y315W' AND item_code LIKE 'ASSEMBLY-%'"
    );
    console.log('Updated stock_balance for 00Y315W:', res3.affectedRows);

    // 4. Verify updated records
    const [soi] = await pool.query("SELECT id, item_code, drawing_no, item_group, drawing_type FROM sales_order_items WHERE drawing_no = '00Y315W'");
    console.log('Verified sales_order_items:', soi);

  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

fixDb();
