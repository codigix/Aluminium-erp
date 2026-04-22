const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

async function checkWorkOrders() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('--- Work Orders ---');
        const [wos] = await connection.query(`
            SELECT id, wo_number, plan_id, item_code, source_type 
            FROM work_orders
        `);
        console.table(wos);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkWorkOrders();
