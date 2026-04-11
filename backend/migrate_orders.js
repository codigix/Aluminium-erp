const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function migrate() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: parseInt(process.env.DB_PORT) || 3307
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Adding project_name column to orders table...');
        await connection.query('ALTER TABLE orders ADD COLUMN project_name VARCHAR(255) AFTER quotation_id');
        console.log('Success.');
    } catch (error) {
        if (error.code === 'ER_DUP_COLUMN_NAME') {
            console.log('Column already exists.');
        } else {
            console.error('Migration failed:', error);
        }
    } finally {
        await connection.end();
    }
}

migrate();
