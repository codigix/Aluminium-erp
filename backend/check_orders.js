const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function check() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: parseInt(process.env.DB_PORT) || 3307
    };

    try {
        const connection = await mysql.createConnection(config);
        const [columns] = await connection.query('SHOW COLUMNS FROM orders');
        console.table(columns);
        await connection.end();
    } catch (error) {
        console.error('Error:', error.message);
    }
}

check();
