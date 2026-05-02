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
    
    console.log('=== Schema of work_orders ===');
    const [rows] = await conn.query("DESC work_orders");
    console.table(rows);
    
    await conn.end();
  } catch (err) {
    console.error(err);
  }
}
run();
