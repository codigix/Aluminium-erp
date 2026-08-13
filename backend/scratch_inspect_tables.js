const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function inspect() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'spTech_dev',
        port: parseInt(process.env.DB_PORT || '3307')
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('=== DESCRIBE items ===');
        try {
            const [cols] = await connection.query('DESCRIBE items');
            console.log(cols.map(c => `${c.Field}: ${c.Type} (${c.Null}, ${c.Key})`).join('\n'));
        } catch (e) {
            console.error('No items table or error:', e.message);
        }

        console.log('\n=== INDEXES of items ===');
        try {
            const [indexes] = await connection.query('SHOW INDEX FROM items');
            console.log(indexes.map(idx => `${idx.Key_name}: Column=${idx.Column_name}, Non_unique=${idx.Non_unique}`).join('\n'));
        } catch (e) {
            console.error('Error fetching indexes of items:', e.message);
        }

        console.log('\n=== DESCRIBE stock_balance ===');
        try {
            const [cols] = await connection.query('DESCRIBE stock_balance');
            console.log(cols.map(c => `${c.Field}: ${c.Type} (${c.Null}, ${c.Key})`).join('\n'));
        } catch (e) {
            console.error('Error DESCRIBE stock_balance:', e.message);
        }

        console.log('\n=== INDEXES of stock_balance ===');
        try {
            const [indexes] = await connection.query('SHOW INDEX FROM stock_balance');
            console.log(indexes.map(idx => `${idx.Key_name}: Column=${idx.Column_name}, Non_unique=${idx.Non_unique}`).join('\n'));
        } catch (e) {
            console.error('Error fetching indexes of stock_balance:', e.message);
        }

        console.log('\n=== DESCRIBE stock_ledger ===');
        try {
            const [cols] = await connection.query('DESCRIBE stock_ledger');
            console.log(cols.map(c => `${c.Field}: ${c.Type} (${c.Null}, ${c.Key})`).join('\n'));
        } catch (e) {
            console.error('Error DESCRIBE stock_ledger:', e.message);
        }

        const [tables] = await connection.query('SHOW TABLES');
        console.log('\n=== TABLES ===');
        console.log(tables.map(t => Object.values(t)[0]).join(', '));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

inspect();
