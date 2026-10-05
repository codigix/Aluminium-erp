const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

async function runMigration() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'hrm_local'
    };

    console.log('Connecting to database:', config.database);
    let connection;
    try {
        connection = await mysql.createConnection(config);
    } catch (err) {
        console.error('Database connection failed:', err.message);
        return;
    }

    try {
        console.log('Checking items table for hsn_code column...');
        const [itemsCols] = await connection.query('SHOW COLUMNS FROM items LIKE "hsn_code"');
        if (itemsCols.length === 0) {
            console.log('Adding column hsn_code to items table...');
            await connection.query('ALTER TABLE items ADD COLUMN hsn_code VARCHAR(50) NULL AFTER item_group');
            console.log('Added hsn_code column to items successfully.');
        } else {
            console.log('Column hsn_code already exists on items table.');
        }

        console.log('Checking quotation_requests table for hsn_code column...');
        const [qrCols] = await connection.query('SHOW COLUMNS FROM quotation_requests LIKE "hsn_code"');
        if (qrCols.length === 0) {
            console.log('Adding column hsn_code to quotation_requests table...');
            await connection.query('ALTER TABLE quotation_requests ADD COLUMN hsn_code VARCHAR(50) NULL AFTER item_group');
            console.log('Added hsn_code column to quotation_requests successfully.');
        } else {
            console.log('Column hsn_code already exists on quotation_requests table.');
        }

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

runMigration();
