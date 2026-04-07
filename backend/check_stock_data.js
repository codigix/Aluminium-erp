const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function checkStock() {
    try {
        const config = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: parseInt(process.env.DB_PORT) || 3306
        };

        const connection = await mysql.createConnection(config);
        
        const [rows] = await connection.query(
            "DESCRIBE grn_items"
        );
        console.table(rows);

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkStock();
