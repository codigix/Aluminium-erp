const mysql = require('mysql2/promise');
async function run() {
  try {
    const conn = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3307,
      user: 'aluminium_user',
      password: 'C0digix$309',
      database: 'sales_erp'
    });
    
    console.log('--- Drawing 900001104 ---');
    const [rows] = await conn.query("SELECT id, item_code, item_type, item_group, drawing_no, description, bom_cost FROM sales_order_items WHERE drawing_no = '900001104'");
    console.table(rows);
    
    console.log('--- Drawing 900001105 ---');
    const [rows2] = await conn.query("SELECT id, item_code, item_type, item_group, drawing_no, description, bom_cost FROM sales_order_items WHERE drawing_no = '900001105'");
    console.table(rows2);
    
    console.log('--- BOM Table for these items ---');
    const [boms] = await conn.query("SELECT * FROM bom WHERE drawing_no IN ('900001104', '900001105')");
    console.table(boms);
    
    await conn.end();
  } catch (err) {
    console.error(err);
  }
}
run();
