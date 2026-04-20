const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function run() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: process.env.DB_PORT || 3307
    };

    const connection = await mysql.createConnection(config);
    try {
        console.log('Querying sales_order_items for 900001104...');
        const [items] = await connection.query("SELECT id, item_code, drawing_no, item_type FROM sales_order_items WHERE drawing_no = '900001104'");
        console.table(items);

        if (items.length > 0) {
            const ids = items.map(i => i.id);
            console.log('Querying sales_order_item_components for these IDs...');
            const [components] = await connection.query(`
                SELECT c.id, c.sales_order_item_id, c.component_code, c.drawing_no, c.parent_id, soi.item_type
                FROM sales_order_item_components c
                LEFT JOIN sales_order_items soi ON c.component_code = soi.item_code AND soi.sales_order_id <=> (SELECT sales_order_id FROM sales_order_items WHERE id = c.sales_order_item_id)
                WHERE c.sales_order_item_id IN (?) OR c.drawing_no = '900001104'
            `, [ids]);
            console.table(components);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

run();
