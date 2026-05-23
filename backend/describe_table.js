const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

async function describeTable() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        const [cols] = await connection.query('DESCRIBE sales_order_item_components');
        console.log('sales_order_item_components columns:', cols.map(c => c.Field));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

describeTable();
