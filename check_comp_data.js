const pool = require('./backend/src/config/db');
async function check() {
  try {
    const [rows] = await pool.query(`
      SELECT component_code, material_name, material_type, item_group, product_type 
      FROM sales_order_item_components 
      WHERE component_code LIKE 'SA-%' OR component_code LIKE 'FG-%' 
      LIMIT 10
    `);
    console.table(rows);
    
    const [rows2] = await pool.query(`
      SELECT item_code, material_name, material_type, item_group, product_type 
      FROM stock_balance 
      WHERE item_code LIKE 'SA-%' OR item_code LIKE 'FG-%' 
      LIMIT 10
    `);
    console.log('Stock Balance:');
    console.table(rows2);
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
check();