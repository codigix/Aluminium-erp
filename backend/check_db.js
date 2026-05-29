const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function checkDb() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'spTech_dev',
        port: parseInt(process.env.DB_PORT || '3307')
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('=== SALES ORDER ITEMS FOR DRAWINGS 66 and 67 ===');
        const [items] = await connection.query('SELECT id, sales_order_id, drawing_no, drawing_id, description FROM sales_order_items WHERE drawing_id IN (66, 67)');
        console.log(JSON.stringify(items, null, 2));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkDb();
