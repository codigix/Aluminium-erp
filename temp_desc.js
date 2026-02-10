const mysql = require('mysql2/promise');
async function run() {
  try {
    const c = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'aluminium_user',
      password: 'C0digix$309',
      database: 'sales_erp',
      port: 3307
    });
    const [m] = await c.query('DESCRIBE material_requests');
    console.log('MR:', JSON.stringify(m, null, 2));
    const [mi] = await c.query('DESCRIBE material_request_items');
    console.log('MRI:', JSON.stringify(mi, null, 2));
    await c.end();
  } catch (e) {
    console.error(e);
  }
}
run();