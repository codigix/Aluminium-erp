const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function addColumn() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3307),
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Adding material_name column to material_issue_items...');
        await connection.query('ALTER TABLE material_issue_items ADD COLUMN material_name VARCHAR(255) AFTER issue_id');
        console.log('Column added successfully.');
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('Column already exists.');
        } else {
            console.error('Error:', error);
        }
    } finally {
        await connection.end();
    }
}

addColumn();
