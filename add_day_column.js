const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function runMigrations() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Adding "day" column to log tables...');
        
        await connection.query('ALTER TABLE job_card_time_logs ADD COLUMN day INT AFTER job_card_id');
        console.log('Added "day" to job_card_time_logs');

        await connection.query('ALTER TABLE job_card_quality_logs ADD COLUMN day INT AFTER job_card_id');
        console.log('Added "day" to job_card_quality_logs');

        await connection.query('ALTER TABLE job_card_downtime_logs ADD COLUMN day INT AFTER job_card_id');
        console.log('Added "day" to job_card_downtime_logs');

        console.log('Successfully completed migrations.');
    } catch (error) {
        console.error('Error during migrations:', error.message);
    } finally {
        await connection.end();
    }
}

runMigrations();
