const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function checkDetails() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3307,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sales_erp'
  };

  console.log('Connecting to database:', config.database, 'on port', config.port);
  const connection = await mysql.createConnection(config);

  try {
    const [sos] = await connection.query('SELECT * FROM sales_orders WHERE id = 42');
    console.log('--- SALES ORDER 42 ---');
    console.log(sos[0]);

    const [wos] = await connection.query('SELECT id, wo_number, sales_order_id, sales_order_item_id, item_name, quantity, status FROM work_orders WHERE id = 63');
    console.log('--- WORK ORDER 63 ---');
    console.table(wos);

    const [jcs] = await connection.query('SELECT id, job_card_no, operation_name, planned_qty, produced_qty, accepted_qty, dispatch_qty, status FROM job_cards WHERE id = 143');
    console.log('--- JOB CARD 143 ---');
    console.table(jcs);

    const [shps] = await connection.query('SELECT * FROM shipment_orders WHERE job_card_id = 143');
    console.log('--- SHIPMENT ORDERS FOR JOB CARD 143 ---');
    console.table(shps);
  } catch (error) {
    console.error('Failed to query:', error);
  } finally {
    await connection.end();
  }
}

checkDetails();
