const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

async function describeTable() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        const [cols] = await connection.query('DESCRIBE quotation_requests');
        console.log('quotation_requests columns:', cols);
        
        const [rows] = await connection.query('SELECT COUNT(*) as count FROM material_requests');
        console.log('material_requests row count:', rows[0].count);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

describeTable();
