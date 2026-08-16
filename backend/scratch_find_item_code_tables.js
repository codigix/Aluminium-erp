const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function find() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'spTech_dev',
        port: parseInt(process.env.DB_PORT || '3307')
    };

    const connection = await mysql.createConnection(config);

    try {
        const [rows] = await connection.query(`
            SELECT TABLE_NAME, COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE COLUMN_NAME = 'item_code' AND TABLE_SCHEMA = ?
        `, [config.database]);
        
        console.log('=== Tables with item_code ===');
        console.log(rows.map(r => r.TABLE_NAME).join('\n'));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

find();
