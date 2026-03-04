const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkDatabase() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Querying sales_orders...');
        const [orders] = await connection.query('SELECT id, status, quotation_id FROM sales_orders WHERE project_name LIKE "%SUCESS%" OR id = 8');
        console.log('Orders:', JSON.stringify(orders, null, 2));

        if (orders.length > 0) {
            const orderId = orders[0].id;
            console.log(`Querying sales_order_items for order ${orderId}...`);
            const [items] = await connection.query('SELECT id, sales_order_id, item_code, item_type, item_group, drawing_no, bom_cost, status FROM sales_order_items WHERE sales_order_id = ?', [orderId]);
            console.log('Items:', JSON.stringify(items, null, 2));
        }

        console.log('Querying quotation_requests...');
        const [quotes] = await connection.query('SELECT * FROM quotation_requests WHERE company_id = (SELECT company_id FROM sales_orders WHERE id = 8 LIMIT 1)');
        console.log('Quotes:', JSON.stringify(quotes, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkDatabase();
