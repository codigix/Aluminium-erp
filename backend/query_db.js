const mysql = require('mysql2/promise');
require('dotenv').config();

async function query() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: parseInt(process.env.DB_PORT || '3307')
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('\n--- Materials for FG (ID 29) ---');
        const [materials] = await connection.query(`
            SELECT * FROM sales_order_item_materials WHERE sales_order_item_id = 29
        `);
        console.table(materials);

        console.log('\n--- Components for FG (ID 29) ---');
        const [components] = await connection.query(`
            SELECT * FROM sales_order_item_components WHERE sales_order_item_id = 29
        `);
        console.table(components);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

query();
