const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    });

    try {
        console.log('Adding weight_per_unit and scrap_percent to sales_order_item_materials...');
        await connection.query('ALTER TABLE sales_order_item_materials ADD COLUMN weight_per_unit DECIMAL(10, 4) DEFAULT 0');
        await connection.query('ALTER TABLE sales_order_item_materials ADD COLUMN scrap_percent DECIMAL(10, 2) DEFAULT 0');
        console.log('Migration successful');
    } catch (err) {
        if (err.code === 'ER_DUP_COLUMN_NAME') {
            console.log('Columns already exist');
        } else {
            console.error('Migration failed:', err);
        }
    } finally {
        await connection.end();
    }
}

migrate();
