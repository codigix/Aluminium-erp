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
    
    console.log('=== Work Orders Sorting Check ===');
    const [rows] = await conn.query(
        `SELECT id, wo_number, plan_id, sales_order_item_id, source_type, created_at 
         FROM work_orders 
         ORDER BY IFNULL(plan_id, 0) DESC, IFNULL(sales_order_item_id, 0) DESC, CASE WHEN source_type = 'SA' THEN 0 ELSE 1 END ASC, id ASC 
         LIMIT 20`
    );
    console.table(rows);
    
    await conn.end();
  } catch (err) {
    console.error(err);
  }
}
run();
