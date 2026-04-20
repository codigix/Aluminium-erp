const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function queryDb() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        const [soi] = await connection.query("SELECT id, sales_order_id, item_code, drawing_no FROM sales_order_items WHERE id IN (17, 18, 19)");
        console.log('SOI Details:', JSON.stringify(soi, null, 2));

        if (soi.length > 0) {
            const soIds = [...new Set(soi.map(s => s.sales_order_id))];
            const [sos] = await connection.query("SELECT id, project_name FROM sales_orders WHERE id IN (?)", [soIds]);
            console.log('Sales Orders:', JSON.stringify(sos, null, 2));
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

queryDb();
