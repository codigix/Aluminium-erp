const pool = require('./backend/src/config/db');

async function debug() {
  try {
    console.log('--- Debugging DRW_101 ---');
    const [m101] = await pool.query('SELECT id, sales_order_item_id, item_code, drawing_no, material_name, parent_id FROM sales_order_item_materials WHERE drawing_no = "DRW_101"');
    console.log('Materials:', m101);
    const [c101] = await pool.query('SELECT id, sales_order_item_id, item_code, drawing_no, component_code, source_fg, parent_id FROM sales_order_item_components WHERE drawing_no = "DRW_101"');
    console.log('Components:', c101);

    console.log('\n--- Debugging SA-FRONTPANEL-0001 ---');
    const [mSA] = await pool.query('SELECT id, sales_order_item_id, item_code, drawing_no, material_name, parent_id FROM sales_order_item_materials WHERE item_code = "SA-FRONTPANEL-0001" OR drawing_no = "DRW_001"');
    console.log('Materials:', mSA);
    const [cSA] = await pool.query('SELECT id, sales_order_item_id, item_code, drawing_no, component_code, parent_id FROM sales_order_item_components WHERE item_code = "SA-FRONTPANEL-0001" OR drawing_no = "DRW_001"');
    console.log('Components:', cSA);

  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

debug();
