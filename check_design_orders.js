const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkDesignOrders() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3307),
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Checking columns for design_orders...');
        const [columns] = await connection.query('SHOW COLUMNS FROM design_orders');
        console.log(JSON.stringify(columns, null, 2));

        console.log('Checking contents for sales_order_id = 1...');
        const [rows] = await connection.query('SELECT * FROM design_orders WHERE sales_order_id = 1');
        console.log(JSON.stringify(rows, null, 2));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkDesignOrders();
