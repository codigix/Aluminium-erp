const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkData() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: process.env.DB_PORT || 3307
    };

    const connection = await mysql.createConnection(config);

    try {
        const [cols] = await connection.query('DESC order_items');
        console.log('--- order_items ---');
        console.log(cols.map(c => c.Field));
        
        const [cols2] = await connection.query('DESC sales_order_items');
        console.log('--- sales_order_items ---');
        console.log(cols2.map(c => c.Field));

        const [cols3] = await connection.query('DESC quotation_requests');
        console.log('--- quotation_requests ---');
        console.log(cols3.map(c => c.Field));

        const [cols4] = await connection.query('DESC orders');
        console.log('--- orders ---');
        console.log(cols4.map(c => c.Field));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkData();
