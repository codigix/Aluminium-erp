const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function updateDb() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3307,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Adding columns to production_plan_operations...');
        
        // Add process_type column
        try {
            await connection.query('ALTER TABLE production_plan_operations ADD COLUMN process_type VARCHAR(50) DEFAULT "In-House" AFTER operation_name');
            console.log('Added process_type column');
        } catch (e) {
            if (e.code === 'ER_DUP_COLUMN_NAME') console.log('process_type column already exists');
            else throw e;
        }

        // Add net_time column
        try {
            await connection.query('ALTER TABLE production_plan_operations ADD COLUMN net_time DECIMAL(10,2) DEFAULT 0.00 AFTER base_time');
            console.log('Added net_time column');
        } catch (e) {
            if (e.code === 'ER_DUP_COLUMN_NAME') console.log('net_time column already exists');
            else throw e;
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

updateDb();
