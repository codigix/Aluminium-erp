const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function checkData() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        port: parseInt(process.env.DB_PORT || '3307')
    };

    const connection = await mysql.createConnection(config);

    try {
        await connection.query('USE `spTech_dev`');
        
        console.log('Checking orders table for extra columns data...');
        const [ordersWithSalesOrderId] = await connection.query('SELECT COUNT(*) as count FROM orders WHERE sales_order_id IS NOT NULL');
        const [ordersWithShipmentId] = await connection.query('SELECT COUNT(*) as count FROM orders WHERE shipment_id IS NOT NULL');
        
        console.log('Orders with sales_order_id:', ordersWithSalesOrderId[0].count);
        console.log('Orders with shipment_id:', ordersWithShipmentId[0].count);

        console.log('Checking procurement_rfqs for PENDING_ITEMS status...');
        const [rfqsWithPending] = await connection.query('SELECT COUNT(*) as count FROM procurement_rfqs WHERE status = "PENDING_ITEMS"');
        console.log('RFQs with PENDING_ITEMS status:', rfqsWithPending[0].count);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkData();
