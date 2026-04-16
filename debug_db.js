const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

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
        
        const [rows] = await connection.query('SELECT id, job_card_no FROM job_cards LIMIT 5');
        console.log('Job Cards:', rows);

        const [tables] = await connection.query('SHOW TABLES LIKE "job_card_quality_logs"');
        console.log('Table job_card_quality_logs exists:', tables.length > 0);

        if (tables.length > 0) {
            const [columns] = await connection.query('DESCRIBE job_card_quality_logs');
            console.log('Columns of job_card_quality_logs:', columns.map(c => c.Field));
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkDb();
