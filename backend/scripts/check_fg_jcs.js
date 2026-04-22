const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

async function checkFGJobCards() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('--- Job Cards for FG ---');
        const [jcs] = await connection.query(`
            SELECT jc.id, jc.job_card_no, jc.operation_name, wo.item_code, wo.source_type 
            FROM job_cards jc 
            JOIN work_orders wo ON jc.work_order_id = wo.id
            WHERE wo.source_type = 'FG'
        `);
        console.table(jcs);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkFGJobCards();
