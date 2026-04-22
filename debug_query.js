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
        const [orders] = await connection.query("SELECT id, order_no, quotation_id FROM orders WHERE order_no = 'ORD-20260420-002' LIMIT 1");
        console.log('Orders:', JSON.stringify(orders, null, 2));

        if (orders.length > 0) {
            const [items] = await connection.query("SELECT id, item_code, drawing_no, description FROM order_items WHERE order_id = ?", [orders[0].id]);
            console.log('Order Items:', JSON.stringify(items, null, 2));
            
            for (const item of items) {
                const [soi] = await connection.query("SELECT id, item_code, drawing_no FROM sales_order_items WHERE drawing_no = ? AND sales_order_id = ?", [item.drawing_no, orders[0].quotation_id]);
                console.log(`Matching SOI for ${item.drawing_no}:`, JSON.stringify(soi, null, 2));
            }
        }
        
        const [materials] = await connection.query("SELECT * FROM sales_order_item_materials WHERE drawing_no = '900001104' LIMIT 5");
        console.log('Materials for 900001104:', JSON.stringify(materials, null, 2));

        const [operations] = await connection.query("SELECT * FROM sales_order_item_operations WHERE drawing_no = '900001104' LIMIT 5");
        console.log('Operations for 900001104:', JSON.stringify(operations, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

queryDb();
