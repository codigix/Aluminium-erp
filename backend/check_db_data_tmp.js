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
        const [jcs] = await connection.query("SELECT id, job_card_no, operation_name, status, planned_qty, produced_qty, accepted_qty FROM job_cards");
        console.log("Total Job Cards:", jcs.length);
        const shipmentJcs = jcs.filter(jc => 
            String(jc.operation_name || '').toLowerCase().includes('shipment') ||
            String(jc.operation_name || '').toLowerCase().includes('dispatch')
        );
        console.log("Shipment/Dispatch Job Cards:", shipmentJcs);

        const [shipOrders] = await connection.query("SELECT * FROM shipment_orders");
        console.log("Shipment Orders:", shipOrders);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await connection.end();
    }
}

run();
