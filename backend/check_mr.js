const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkMR() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: parseInt(process.env.DB_PORT) || 3307
    };

    const connection = await mysql.createConnection(config);

    try {
        const [columns] = await connection.query('DESCRIBE material_requests');
        console.log('Material Requests Columns:', columns.map(c => c.Field));

        const [rows] = await connection.query('SELECT * FROM material_requests WHERE id = 10');
        console.log('MR 10 Full Details:', rows[0]);
        
        const [rfqs] = await connection.query('SELECT * FROM procurement_rfqs WHERE mr_id = 10');
        console.log('RFQs for MR 10:', rfqs);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkMR();
