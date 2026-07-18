const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function checkStockBalance() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        port: parseInt(process.env.DB_PORT || '3307'),
        database: 'spTech_dev'
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Querying stock_balance columns...');
        const [cols] = await connection.query('DESCRIBE stock_balance');
        console.log(cols.map(c => `${c.Field} (${c.Type})`));

        console.log('\nQuerying one row from stock_balance...');
        const [rows] = await connection.query('SELECT * FROM stock_balance LIMIT 1');
        console.log(JSON.stringify(rows[0], null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkStockBalance();
