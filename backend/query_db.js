const mysql = require('mysql2');
require('dotenv').config();

async function query() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: parseInt(process.env.DB_PORT || '3307')
    };

    const connection = mysql.createConnection(config).promise();

    try {
        console.log('--- Quotation Request ID 5 ---');
        const [q] = await connection.query('SELECT * FROM quotation_requests WHERE id = 5');
        console.log(JSON.stringify(q, null, 2));

        console.log('\n--- Communications for ID 5 ---');
        const [comm] = await connection.query('SELECT * FROM quotation_communications WHERE quotation_id = 5');
        console.log(JSON.stringify(comm, null, 2));

        console.log('\n--- Recent 5 Communications ---');
        const [recent] = await connection.query('SELECT * FROM quotation_communications ORDER BY id DESC LIMIT 5');
        console.log(JSON.stringify(recent, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

query();
