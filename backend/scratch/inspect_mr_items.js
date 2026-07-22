const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'e:/codigix-project/Aluminium-erp/backend/.env' });

async function inspectMR() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp',
        port: parseInt(process.env.DB_PORT) || 3306
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Querying material_request_items for MR ID 96...');
        const [items] = await connection.query('SELECT * FROM material_request_items WHERE mr_id = 96');
        console.log('MR Items:', items);
        
        console.log('Querying stock_balance for SS304 Seamless Pipe...');
        const [sb] = await connection.query("SELECT item_code, material_name, length, width, thickness, diameter, outer_diameter, shape_id, current_balance FROM stock_balance WHERE material_name LIKE '%SS304 Seamless Pipe%'");
        console.log('Stock Balance:', sb);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

inspectMR();
