const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

(async () => {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT) || 3307,
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp'
    };

    console.log('Migrating database on port:', config.port);

    const connection = await mysql.createConnection(config);
    try {
        console.log('Adding bom_id column...');
        await connection.query('ALTER TABLE sales_order_items ADD COLUMN bom_id INT NULL AFTER id');
        
        console.log('Adding created_by column...');
        await connection.query('ALTER TABLE sales_order_items ADD COLUMN created_by INT NULL');
        
        // Initialize bom_id to point to self for existing records
        console.log('Initializing bom_id for existing records...');
        await connection.query('UPDATE sales_order_items SET bom_id = id WHERE bom_id IS NULL');

        console.log('Migration successful.');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('Columns already exist.');
        } else {
            console.error('Migration failed:', err);
        }
    } finally {
        await connection.end();
    }
})();
