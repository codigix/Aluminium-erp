const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function showCreate() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: process.env.DB_PORT || 3307
    };

    const connection = await mysql.createConnection(config);

    try {
        const [rows] = await connection.query('SHOW CREATE TABLE quotations');
        console.log(rows[0]['Create Table']);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

showCreate();
