const mysql = require('mysql2/promise');
require('dotenv').config();

async function inspect() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3307'),
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'spTech_prod'
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Searching in sales_order_item_operations...');
        const [soOps] = await connection.query(
            "SELECT * FROM sales_order_item_operations WHERE cycle_time_min = 10.2 OR cycle_time_min = '10.2' OR cycle_time_min = '10.200'"
        );
        console.log(soOps);

        console.log('Searching in job_cards...');
        const [jcs] = await connection.query(
            "SELECT id, job_card_no, work_order_id, std_time, cycle_time FROM job_cards WHERE std_time = 10.2 OR cycle_time = 10.2"
        );
        console.log(jcs);

    } catch (error) {
        console.error('Error during query:', error);
    } finally {
        await connection.end();
    }
}

inspect();
