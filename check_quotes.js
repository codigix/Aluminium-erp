const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkQuotes() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        const [rows] = await connection.query('SELECT id, parent_id, version, status, company_id, batch_id FROM quotation_requests ORDER BY id DESC LIMIT 100');
        console.table(rows);
    } catch (error) {
        console.error(error);
    } finally {
        await connection.end();
    }
}

checkQuotes();
