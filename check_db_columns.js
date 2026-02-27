const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkColumns() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        const [columns] = await connection.query('DESCRIBE customer_drawings');
        console.log(JSON.stringify(columns, null, 2));
    } catch (error) {
        console.error('Error checking columns:', error);
    } finally {
        await connection.end();
    }
}

checkColumns();
