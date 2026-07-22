const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function check() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: Number(process.env.DB_PORT || 3307)
    };

    const connection = await mysql.createConnection(config);
    try {
        const tables = [
            'bom_items',
            'sales_order_item_materials',
            'material_request_items',
            'procurement_rfq_items',
            'quotation_items',
            'purchase_order_items',
            'grn_items'
        ];
        for (const table of tables) {
            try {
                const [columns] = await connection.query(`SHOW COLUMNS FROM ${table}`);
                console.log(`\nTable: ${table}`);
                columns.forEach(col => {
                    console.log(`  - ${col.Field}: ${col.Type}`);
                });
            } catch (err) {
                console.log(`Table ${table} not found or failed to describe: ${err.message}`);
            }
        }
    } finally {
        await connection.end();
    }
}
check();
