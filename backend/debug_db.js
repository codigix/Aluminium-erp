const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

async function checkDb() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp',
        port: process.env.DB_PORT || 3306
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Connected to database.');
        
        const [rows] = await connection.query('SELECT * FROM job_cards WHERE job_card_no = "JC-0001-667"');
        console.log('Job Card JC-0001-667:', rows);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkDb();
