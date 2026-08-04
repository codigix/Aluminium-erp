const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

async function checkOpWorkstations() {
  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'aluminium_user',
    password: process.env.DB_PASSWORD || 'C0digix$309',
    port: Number(process.env.DB_PORT || 3307),
    database: 'spTech_dev'
  };
  const conn = await mysql.createConnection(config);

  const [ops] = await conn.query(`
    SELECT o.id, o.operation_name, GROUP_CONCAT(w.workstation_name) as ws_names, GROUP_CONCAT(w.workstation_code) as ws_codes
    FROM operations o
    LEFT JOIN operation_workstations ow ON o.id = ow.operation_id
    LEFT JOIN workstations w ON ow.workstation_id = w.id
    GROUP BY o.id
  `);
  console.log('Master Operations and Workstations in spTech_dev:');
  console.log(ops);

  const [sampleBomOps] = await conn.query('SELECT sales_order_item_id, operation_name, workstation FROM sales_order_item_operations LIMIT 10');
  console.log('Sample sales_order_item_operations:');
  console.log(sampleBomOps);

  await conn.end();
}

checkOpWorkstations().catch(err => console.error(err));
