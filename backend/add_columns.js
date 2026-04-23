const mysql = require('mysql2');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function addColumns() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'backend',
        database: process.env.DB_NAME || 'sales_erp'
    }).promise();

    try {
        console.log('Adding bom_id and created_by to sales_order_items...');
        await connection.query('ALTER TABLE sales_order_items ADD COLUMN bom_id INT NULL AFTER id');
        await connection.query('ALTER TABLE sales_order_items ADD COLUMN created_by INT NULL');
        console.log('Columns added successfully.');
    } catch (error) {
        console.error('Error adding columns:', error.message);
    } finally {
        await connection.end();
    }
}

addColumns();
