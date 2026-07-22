const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function migrate() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: Number(process.env.DB_PORT || 3307)
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Starting migration to add shape_type to item tables...');

        const tables = [
            'material_request_items',
            'procurement_rfq_items',
            'quotation_items',
            'purchase_order_items',
            'grn_items'
        ];

        for (const table of tables) {
            const [columns] = await connection.query(`SHOW COLUMNS FROM ${table}`);
            const existing = new Set(columns.map(col => col.Field));

            if (!existing.has('shape_type')) {
                console.log(`Adding shape_type to ${table}...`);
                await connection.query(`ALTER TABLE ${table} ADD COLUMN shape_type VARCHAR(100) DEFAULT NULL`);
            } else {
                console.log(`shape_type already exists in ${table}.`);
            }
        }

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();
