const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkData() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('--- Production Plans ---');
        const [plans] = await connection.query('SELECT id, created_at FROM production_plans ORDER BY id DESC LIMIT 5');
        console.table(plans);

        console.log('--- Work Orders ---');
        const [wos] = await connection.query('SELECT id, wo_number, plan_id, source_type, created_at FROM work_orders ORDER BY id DESC LIMIT 20');
        console.table(wos);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkData();
