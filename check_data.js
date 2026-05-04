const mysql = require('mysql2');
require('dotenv').config({ path: './backend/.env' });

async function list() {
  try {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };
    const connection = await mysql.createConnection(config);
    const [wos] = await connection.promise().query('SELECT * FROM work_orders WHERE sales_order_id = 37');
    console.log('Work Orders for SO 37:', JSON.stringify(wos, null, 2));
    
    const [jc] = await connection.promise().query('SELECT * FROM job_cards WHERE work_order_id IN (SELECT id FROM work_orders WHERE sales_order_id = 37)');
    console.log('Job Cards for SO 37:', JSON.stringify(jc, null, 2));

    await connection.end();
  } catch (err) {
    console.error(err);
  }
}
list();
