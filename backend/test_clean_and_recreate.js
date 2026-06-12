const mysql = require('mysql2/promise');
const workOrderService = require('./src/services/workOrderService');
const jobCardService = require('./src/services/jobCardService');
require('dotenv').config();

async function run() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: process.env.DB_PORT || 3307
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('--- Cleaning Plan 51 ---');
        // Delete job cards of work orders belonging to plan 51
        await connection.query(
            `DELETE jc FROM job_cards jc
             JOIN work_orders wo ON jc.work_order_id = wo.id
             WHERE wo.plan_id = 51`
        );
        // Delete work orders of plan 51
        await connection.query('DELETE FROM work_orders WHERE plan_id = 51');
        console.log('Clean completed.');

        console.log('--- Recreating Plan 51 ---');
        const createdWos = await workOrderService.createWorkOrdersFromPlan(51);
        console.log('Created work orders IDs:', createdWos);

        console.log('--- Fetching updated Job Cards ---');
        const jobCards = await jobCardService.listJobCards();
        const plan51Jcs = jobCards.filter(jc => jc.plan_id === 51);
        
        plan51Jcs.forEach(jc => {
            console.log(`JC: ${jc.job_card_no} | Op: ${jc.operation_name} | WO: ${jc.wo_number} | Item: ${jc.item_name} | Type: ${jc.source_type}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

run();
