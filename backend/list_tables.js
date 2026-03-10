const mysql = require('mysql2/promise');
require('dotenv').config();

async function listTables() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp',
        port: process.env.DB_PORT || 3306
    };

    try {
        const connection = await mysql.createConnection(config);
        const [rows] = await connection.query('SHOW TABLES');
        console.log('Tables:', rows.map(r => Object.values(r)[0]));
        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

listTables();
