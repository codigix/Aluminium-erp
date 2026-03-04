const mysql = require('mysql2');

async function showTables() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 3307,
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp'
    };

    try {
        const connection = await mysql.createConnection(config);
        const [tables] = await connection.promise().query('SHOW TABLES');
        console.log(JSON.stringify(tables, null, 2));
        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

showTables();
