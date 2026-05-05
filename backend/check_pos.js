const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkPurchaseOrders() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: process.env.DB_PORT || 3307
    };

    const connection = await mysql.createConnection(config);

    try {
        const [pos] = await connection.query('SELECT id, po_number, status FROM purchase_orders LIMIT 20');
        console.log('Purchase Orders:', pos);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkPurchaseOrders();
