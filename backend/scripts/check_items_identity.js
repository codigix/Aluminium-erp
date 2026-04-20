const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

async function checkItems() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('--- Sales Order Items ---');
        const [rows] = await connection.query(`
            SELECT id, item_code, item_type, item_group, drawing_no, description 
            FROM sales_order_items 
            WHERE item_code IN ('900001104', 'OTH-STAINLESSS-0002') 
               OR drawing_no IN ('900001104', 'OTH-STAINLESSS-0002')
        `);
        console.table(rows);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkItems();
