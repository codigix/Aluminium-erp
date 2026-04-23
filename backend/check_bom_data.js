const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

(async () => {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT) || 3307,
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);
    try {
        console.log('--- Materials for ID 89 ---');
        const [materials] = await connection.query('SELECT * FROM sales_order_item_materials WHERE sales_order_item_id = 89');
        console.table(materials);

        console.log('--- Components for ID 89 ---');
        const [components] = await connection.query('SELECT * FROM sales_order_item_components WHERE sales_order_item_id = 89');
        console.table(components);

        console.log('--- Operations for ID 89 ---');
        const [operations] = await connection.query('SELECT * FROM sales_order_item_operations WHERE sales_order_item_id = 89');
        console.table(operations);
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
})();
