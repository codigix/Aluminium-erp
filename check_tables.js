const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkTables() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3307),
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        const [tables] = await connection.query("SHOW TABLES");
        console.log('Tables:', JSON.stringify(tables, null, 2));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkTables();
