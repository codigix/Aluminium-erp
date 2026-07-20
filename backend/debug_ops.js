const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'aluminium_user',
    password: 'C0digix$309',
    database: 'spTech_dev'
  });

  const [wos] = await conn.query(
    `SELECT id, wo_number, item_code, item_name, source_type FROM work_orders ORDER BY id DESC LIMIT 5`
  );
  console.log('Work Orders:', JSON.stringify(wos, null, 2));

  await conn.end();
}

run().catch(console.error);
