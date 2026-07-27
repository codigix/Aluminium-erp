const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDwg() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3307'),
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'spTech_dev'
    };

    const connection = await mysql.createConnection(config);

    try {
        const [rows] = await connection.query("SELECT id, client_name, project_name, drawing_no FROM customer_drawings WHERE id = 322");
        console.log('Drawing 322:', rows[0]);
    } catch (error) {
        console.error(error);
    } finally {
        await connection.end();
    }
}

checkDwg();
