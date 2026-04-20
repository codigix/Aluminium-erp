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
        const [sos] = await connection.query("SELECT id, project_name, status FROM sales_orders WHERE id IN (2, 3)");
        console.log('Sales Orders (Quotation/SO):', JSON.stringify(sos, null, 2));

        const [order] = await connection.query("SELECT id, order_no, quotation_id FROM orders WHERE id = 3");
        console.log('Order Details:', JSON.stringify(order, null, 2));

        const [soi] = await connection.query("SELECT id, sales_order_id, item_code, drawing_no FROM sales_order_items WHERE sales_order_id IN (2, 3)");
        console.log('Sales Order Items for 2 & 3:', JSON.stringify(soi, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

queryDb();
