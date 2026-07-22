const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'e:/codigix-project/Aluminium-erp/backend/.env' });

async function testQueries() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp',
        port: parseInt(process.env.DB_PORT) || 3306
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Testing connection...');
        const [tables] = await connection.query('SHOW TABLES');
        console.log(`Found ${tables.length} tables.`);

        // Test querying material_request_items
        console.log('Querying material_request_items...');
        const [mrItems] = await connection.query('SELECT shape_type FROM material_request_items LIMIT 1');
        console.log('mri shape_type sample:', mrItems);

        // Test querying procurement_rfq_items
        console.log('Querying procurement_rfq_items...');
        const [rfqItems] = await connection.query('SELECT shape_type FROM procurement_rfq_items LIMIT 1');
        console.log('rfq shape_type sample:', rfqItems);

        // Test querying quotation_items
        console.log('Querying quotation_items...');
        const [qItems] = await connection.query('SELECT shape_type FROM quotation_items LIMIT 1');
        console.log('qi shape_type sample:', qItems);

        // Test querying purchase_order_items
        console.log('Querying purchase_order_items...');
        const [poItems] = await connection.query('SELECT shape_type FROM purchase_order_items LIMIT 1');
        console.log('poi shape_type sample:', poItems);

        // Test querying grn_items
        console.log('Querying grn_items...');
        const [grnItems] = await connection.query('SELECT shape_type FROM grn_items LIMIT 1');
        console.log('grn shape_type sample:', grnItems);

        console.log('All schema validation queries passed successfully!');
    } catch (error) {
        console.error('Error during query testing:', error);
    } finally {
        await connection.end();
    }
}

testQueries();
