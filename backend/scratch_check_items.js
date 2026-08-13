const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function check() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'spTech_dev',
        port: parseInt(process.env.DB_PORT || '3307')
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('=== ITEMS COUNT ===');
        const [itemsCount] = await connection.query('SELECT COUNT(*) as count FROM items');
        console.log(itemsCount[0].count);

        console.log('=== SAMPLE ITEMS ===');
        const [items] = await connection.query('SELECT * FROM items LIMIT 5');
        console.log(JSON.stringify(items, null, 2));

        console.log('=== MATERIALS COUNT ===');
        const [matCount] = await connection.query('SELECT COUNT(*) as count FROM materials');
        console.log(matCount[0].count);

        console.log('=== SAMPLE MATERIALS ===');
        const [mats] = await connection.query('SELECT * FROM materials LIMIT 5');
        console.log(JSON.stringify(mats, null, 2));

        console.log('=== STOCK BALANCE COUNT ===');
        const [sbCount] = await connection.query('SELECT COUNT(*) as count FROM stock_balance');
        console.log(sbCount[0].count);

        console.log('=== SAMPLE STOCK BALANCE ===');
        const [sb] = await connection.query('SELECT id, item_code, material_name, warehouse, current_balance, length, width, thickness FROM stock_balance LIMIT 10');
        console.log(JSON.stringify(sb, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

check();
