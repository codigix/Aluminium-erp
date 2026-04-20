const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

async function checkFGMissing() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('--- Production Plan Items (FG) for Plan 31 ---');
        const [ppi] = await connection.query('SELECT * FROM production_plan_items WHERE plan_id = 31');
        console.table(ppi);

        console.log('--- Work Orders for Plan 31 ---');
        const [wo] = await connection.query('SELECT * FROM work_orders WHERE plan_id = 31');
        console.table(wo);

        console.log('--- Job Cards for Plan 31 ---');
        const [jc] = await connection.query(`
            SELECT jc.id, jc.job_card_no, jc.operation_name, jc.work_order_id, wo.item_code, wo.source_type 
            FROM job_cards jc 
            JOIN work_orders wo ON jc.work_order_id = wo.id
            WHERE wo.plan_id = 31
        `);
        console.table(jc);

        console.log('--- Operations for Plan 31 (from production_plan_operations) ---');
        const [ppo] = await connection.query('SELECT * FROM production_plan_operations WHERE plan_id = 31');
        console.table(ppo);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkFGMissing();
