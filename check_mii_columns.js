const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkColumns() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Checking columns for material_issue_items...');
        const [columns] = await connection.query('SHOW COLUMNS FROM material_issue_items');
        console.log(JSON.stringify(columns, null, 2));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkColumns();
