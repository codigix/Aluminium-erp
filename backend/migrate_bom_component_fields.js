const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp',
        port: Number(process.env.DB_PORT || 3307)
    });

    try {
        console.log('Adding missing columns to sales_order_item_components...');
        const [columns] = await connection.query('SHOW COLUMNS FROM sales_order_item_components');
        const existing = new Set(columns.map(c => c.Field));

        if (!existing.has('item_group')) {
            await connection.query('ALTER TABLE sales_order_item_components ADD COLUMN item_group VARCHAR(100) AFTER notes');
            console.log('Added item_group');
        }
        if (!existing.has('weight_per_unit')) {
            await connection.query('ALTER TABLE sales_order_item_components ADD COLUMN weight_per_unit DECIMAL(12, 4) DEFAULT 0 AFTER item_group');
            console.log('Added weight_per_unit');
        }
        if (!existing.has('scrap_percent')) {
            await connection.query('ALTER TABLE sales_order_item_components ADD COLUMN scrap_percent DECIMAL(10, 2) DEFAULT 0 AFTER weight_per_unit');
            console.log('Added scrap_percent');
        }

        console.log('Migration successful');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await connection.end();
    }
}

migrate();
