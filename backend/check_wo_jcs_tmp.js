const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function run() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'spTech_dev',
        port: parseInt(process.env.DB_PORT || '3307')
    };

    const connection = await mysql.createConnection(config);
    try {
        const [rows] = await connection.query(`
            SELECT id, job_card_no, operation_name, sequence_no, planned_qty, produced_qty, accepted_qty, status 
            FROM job_cards 
            WHERE work_order_id = 59
            ORDER BY sequence_no ASC
        `);
        console.log("Job Cards for Work Order 59:", rows);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await connection.end();
    }
}

run();
