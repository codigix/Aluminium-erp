const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function findBOMData() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3307),
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        const itemCode = 'OTH-STAINLESSS-0002';
        console.log(`Searching for BOM entries linked to: ${itemCode}`);

        // 1. Search by item_code in materials table
        const [materials] = await connection.query(
            'SELECT * FROM sales_order_item_materials WHERE item_code = ? OR drawing_no = "900001104"', 
            [itemCode]
        );
        console.log('Materials Found:', materials.length);
        if (materials.length > 0) console.log(JSON.stringify(materials, null, 2));

        // 2. Search by item_code in components table
        const [components] = await connection.query(
            'SELECT * FROM sales_order_item_components WHERE item_code = ? OR drawing_no = "900001104"', 
            [itemCode]
        );
        console.log('Components Found:', components.length);
        if (components.length > 0) console.log(JSON.stringify(components, null, 2));

        // 3. Check if there are any Master BOMs (where sales_order_item_id is NULL)
        const [masterBOM] = await connection.query(
            'SELECT * FROM sales_order_items WHERE (item_code = ? OR drawing_no = "900001104") AND sales_order_id IS NULL',
            [itemCode]
        );
        console.log('Master BOM Headers Found:', masterBOM.length);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

findBOMData();
