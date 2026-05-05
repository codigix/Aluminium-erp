const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkSoItems() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: process.env.DB_PORT || 3307
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Checking Sales Order Items for SO 35...');
        const [items] = await connection.query('SELECT * FROM sales_order_items WHERE sales_order_id = 35');
        console.log('Items:', JSON.stringify(items, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkSoItems();
