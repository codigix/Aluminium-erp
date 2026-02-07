const mysql = require('mysql2/promise');
async function run() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'aluminium_user',
    password: 'C0digix$309',
    database: 'sales_erp',
    port: 3306
  });
  const [rows] = await connection.query('DESCRIBE sales_orders');
  console.table(rows);
  await connection.end();
}
run();