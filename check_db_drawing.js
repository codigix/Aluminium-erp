const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'e:/codigix-project/Aluminium-erp/backend/.env' });

async function checkDrawing() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: parseInt(process.env.DB_PORT) || 3306
    };

    try {
        const connection = await mysql.createConnection(config);
        const [rows] = await connection.query('SELECT drawing_no, file_path, file_type FROM customer_drawings WHERE drawing_no = "9000011112"');
        console.log(JSON.stringify(rows, null, 2));
        await connection.end();
    } catch (error) {
        console.error('Database error:', error);
    }
}

checkDrawing();
