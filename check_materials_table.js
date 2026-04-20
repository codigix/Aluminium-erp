const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkMaterialsTable() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3307),
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Checking columns for materials...');
        const [columns] = await connection.query('SHOW COLUMNS FROM materials');
        console.log(JSON.stringify(columns, null, 2));

        console.log('Checking contents for 900001104...');
        const [rows] = await connection.query('SELECT * FROM materials WHERE item_code = ? OR drawing_no = ?', ['900001104', '900001104']);
        console.log(JSON.stringify(rows, null, 2));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkMaterialsTable();
