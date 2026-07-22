const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'e:/codigix-project/Aluminium-erp/backend/.env' });

async function inspectMR101() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp',
        port: parseInt(process.env.DB_PORT) || 3306
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Querying material_requests for ID 101...');
        const [mr] = await connection.query("SELECT * FROM material_requests WHERE id = 101");
        console.log('MR:', mr);

        console.log('Querying material_request_items for ID 101...');
        const [items] = await connection.query(
            "SELECT id, mr_id, item_code, item_name, shape_type, length, width, thickness, diameter, outer_diameter, quantity, design_qty, allocated_quantity FROM material_request_items WHERE mr_id = 101"
        );
        console.log('Items:', items);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

inspectMR101();
