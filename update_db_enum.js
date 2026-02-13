const mysql = require('mysql2');
require('dotenv').config({ path: './backend/.env' });

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'psgrciqnkzpxylme',
        database: process.env.DB_NAME || 'sales_erp'
    }).promise();

    try {
        console.log('Updating quotations status enum...');
        await connection.execute(`
            ALTER TABLE quotations 
            MODIFY status ENUM('DRAFT', 'SENT', 'EMAIL_RECEIVED', 'RECEIVED', 'REVIEWED', 'CLOSED', 'PENDING') 
            DEFAULT 'DRAFT'
        `);
        console.log('Success!');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await connection.end();
    }
}

run();
