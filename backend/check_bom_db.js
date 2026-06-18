const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkBOM() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('--- Sales Order Items ---');
        const [items] = await connection.query(
            "SELECT id, item_code, drawing_no, parent_bom_id, bom_cost, status, item_group FROM sales_order_items WHERE drawing_no IN ('0432823/45', '1234567678', '09S24MTR17C', '123456789')"
        );
        console.table(items);

        console.log('--- Sales Order Item Components ---');
        const [components] = await connection.query(
            "SELECT id, sales_order_item_id, component_code, description, drawing_no, item_group FROM sales_order_item_components"
        );
        console.table(components);
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

checkBOM();
