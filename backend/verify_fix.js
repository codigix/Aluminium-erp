const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'aluminium_user',
    password: 'C0digix$309',
    database: 'sales_erp',
    port: 3307
  });

  const [rows] = await conn.query('SELECT id, sales_order_id, drawing_no, status, item_group FROM sales_order_items WHERE drawing_no = "900001105"');
  console.table(rows);
  await conn.end();
}

run();
