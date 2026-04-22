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
        console.log('--- Work Orders ---');
        const [workOrders] = await connection.query('SELECT id, wo_number, item_code, item_name, source_type, status FROM work_orders');
        console.table(workOrders);

        console.log('--- Job Cards ---');
        const [jobCards] = await connection.query(`
            SELECT jc.id, jc.job_card_no, jc.operation_name, jc.work_order_id, wo.wo_number, wo.source_type
            FROM job_cards jc
            JOIN work_orders wo ON jc.work_order_id = wo.id
        `);
        console.table(jobCards);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkData();
