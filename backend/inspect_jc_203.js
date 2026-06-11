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
        console.log('Querying job_cards for id = 203...');
        const [rows] = await connection.query(
            "SELECT id, job_card_no, work_order_id, operation_id, workstation_id, planned_qty, std_time, cycle_time, setup_time, time_uom FROM job_cards WHERE id = 203"
        );
        console.log(rows);

        if (rows.length > 0) {
            const operationId = rows[0].operation_id;
            console.log('Querying operations for operation_id:', operationId);
            const [operations] = await connection.query(
                "SELECT * FROM operations WHERE id = ?",
                [operationId]
            );
            console.log(operations);
        }

    } catch (error) {
        console.error('Error during query:', error);
    } finally {
        await connection.end();
    }
}

inspect();
