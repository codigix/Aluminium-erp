const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function runQuery() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 3307,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);
    const query = process.argv.slice(2).join(' ');

    try {
        const [results] = await connection.query(query);
        console.log(JSON.stringify(results, null, 2));
    } catch (error) {
        console.error(error);
    } finally {
        await connection.end();
    }
}

runQuery();
