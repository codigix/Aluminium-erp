const mysql = require('mysql2');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function checkColumns() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'backend',
        database: process.env.DB_NAME || 'sales_erp'
    }).promise();

    try {
        const [rows] = await connection.query('DESCRIBE quotation_requests');
        console.log(JSON.stringify(rows, null, 2));
    } catch (error) {
        console.error(error);
    } finally {
        await connection.end();
    }
}

checkColumns();
