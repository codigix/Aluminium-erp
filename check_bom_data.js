const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkBOMData() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3307),
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        const itemCode = '900001104';
        console.log(`Checking data for item: ${itemCode}`);

        const [soItems] = await connection.query('SELECT * FROM sales_order_items WHERE item_code = ? OR drawing_no = ?', [itemCode, itemCode]);
        console.log('Sales Order Items:', JSON.stringify(soItems, null, 2));

        if (soItems.length > 0) {
            const soItemId = soItems[0].id;
            const [materials] = await connection.query('SELECT * FROM sales_order_item_materials WHERE sales_order_item_id = ?', [soItemId]);
            console.log('Materials:', JSON.stringify(materials, null, 2));

            const [components] = await connection.query('SELECT * FROM sales_order_item_components WHERE sales_order_item_id = ?', [soItemId]);
            console.log('Components:', JSON.stringify(components, null, 2));
        }

        const [masterM] = await connection.query('SELECT * FROM sales_order_item_materials WHERE (item_code = ? OR drawing_no = ?) AND sales_order_item_id IS NULL', [itemCode, itemCode]);
        console.log('Master Materials:', JSON.stringify(masterM, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkBOMData();
