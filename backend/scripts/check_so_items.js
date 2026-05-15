const pool = require('../src/config/db');

async function check() {
  try {
    const [tables] = await pool.query('SHOW TABLES');
    console.table(tables);
    const [rows] = await pool.query('SELECT * FROM sales_order_items WHERE sales_order_id = 1');
    console.table(rows);
    const [materials] = await pool.query('SELECT * FROM sales_order_item_materials WHERE sales_order_item_id = 4');
    console.log('Materials for SO Item 4:');
    console.table(materials);
    const [components] = await pool.query('SELECT * FROM sales_order_item_components WHERE sales_order_item_id = 4');
    console.log('Components for SO Item 4:');
    console.table(components);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

check();
