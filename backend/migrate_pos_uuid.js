const mysql = require('mysql2');
const crypto = require('crypto');
require('dotenv').config({ path: 'backend/.env' });

async function migrate() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    try {
        const pool = mysql.createPool(config).promise();
        console.log('Connected to DB');
        
        // 1. Add public_id column if not exists
        const [columns] = await pool.query('SHOW COLUMNS FROM purchase_orders LIKE "public_id"');
        if (columns.length === 0) {
            console.log('Adding column public_id to purchase_orders...');
            await pool.query('ALTER TABLE purchase_orders ADD COLUMN public_id VARCHAR(100) UNIQUE');
            console.log('Column added successfully');
        } else {
            console.log('Column public_id already exists');
        }

        // 2. Populate public_id for existing records
        const [rows] = await pool.query('SELECT id FROM purchase_orders WHERE public_id IS NULL');
        console.log(`Found ${rows.length} records to update in purchase_orders`);
        
        for (const row of rows) {
            const publicId = crypto.randomUUID();
            await pool.query('UPDATE purchase_orders SET public_id = ? WHERE id = ?', [publicId, row.id]);
        }
        
        console.log('Migration completed successfully');
        await pool.end();
    } catch (error) {
        console.error('Migration failed:', error);
    }
}

migrate();
