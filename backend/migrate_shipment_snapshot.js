const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
};

async function migrate() {
    const connection = await mysql.createConnection(dbConfig);
    try {
        console.log('Adding snapshot columns to shipment_orders...');
        
        const columnsToAdd = [
            'ALTER TABLE shipment_orders ADD COLUMN customer_name VARCHAR(255) AFTER customer_id',
            'ALTER TABLE shipment_orders ADD COLUMN customer_phone VARCHAR(50) AFTER customer_name',
            'ALTER TABLE shipment_orders ADD COLUMN customer_email VARCHAR(255) AFTER customer_phone',
            'ALTER TABLE shipment_orders ADD COLUMN shipping_address TEXT AFTER customer_email',
            'ALTER TABLE shipment_orders ADD COLUMN billing_address TEXT AFTER shipping_address'
        ];

        for (const sql of columnsToAdd) {
            try {
                await connection.query(sql);
                console.log(`Executed: ${sql}`);
            } catch (err) {
                if (err.code === 'ER_DUP_COLUMN_NAME' || err.message.includes('Duplicate column name')) {
                    console.log(`Column already exists, skipping: ${sql.split(' ').pop()}`);
                } else {
                    console.error(`Error executing ${sql}:`, err.message);
                }
            }
        }

        console.log('Migration completed successfully');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await connection.end();
    }
}

migrate();
