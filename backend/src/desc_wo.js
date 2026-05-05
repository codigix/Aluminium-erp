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

    console.log('=== Schema of operations ===');
    const [opRows] = await conn.query("DESC operations");
    console.table(opRows);

    console.log('=== Schema of workstations ===');
    const [wsRows] = await conn.query("DESC workstations");
    console.table(wsRows);

    console.log('=== Schema of job_cards ===');
    const [jcRows] = await conn.query("DESC job_cards");
    console.table(jcRows);
    
    await conn.end();
  } catch (err) {
    console.error(err);
  }
}
run();
