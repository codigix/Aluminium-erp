const mysql = require('mysql2/promise');
async function run() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'aluminium_user',
    password: 'C0digix$309',
    database: 'spTech_dev'
  });
  const [rows] = await connection.query("SELECT drawing_no, drawing_type, item_code, sales_order_id FROM sales_order_items WHERE sales_order_id IN (SELECT id FROM sales_orders WHERE company_id = (SELECT id FROM companies WHERE company_name = 'Client Requirement PVT'))");
  console.table(rows);
  await connection.end();
}
run().catch(console.error);
