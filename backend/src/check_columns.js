const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    const [wo] = await conn.query('DESCRIBE work_orders');
    console.log('work_orders:', wo.map(c => c.Field).join(', '));
    const [jc] = await conn.query('DESCRIBE job_cards');
    console.log('job_cards:', jc.map(c => c.Field).join(', '));
    const [ws] = await conn.query('DESCRIBE workstations');
    console.log('workstations:', ws.map(c => c.Field).join(', '));
    const [wsData] = await conn.query('SELECT department FROM workstations LIMIT 5');
    console.log('workstations department samples:', wsData);
    const [deptData] = await conn.query('SELECT id, name FROM departments LIMIT 5');
    console.log('departments samples:', deptData);
  } finally {
    await conn.end();
  }
}
run();
