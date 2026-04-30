const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkData() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT
    });

    try {
        console.log('--- work_orders columns ---');
        const [woCols] = await connection.query('DESCRIBE work_orders');
        console.log(woCols.map(c => c.Field).join(', '));

        console.log('\n--- sample work_orders ---');
        const [wos] = await connection.query('SELECT id, wo_number, plan_id, sales_order_id FROM work_orders LIMIT 5');
        console.log(wos);

    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

checkData();
