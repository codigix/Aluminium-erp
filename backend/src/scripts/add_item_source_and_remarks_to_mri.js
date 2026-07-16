const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function runMigration() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3307'),
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'spTech_dev'
    };

    console.log('Connecting to database:', config.database);
    const connection = await mysql.createConnection(config);

    try {
        console.log('Altering material_request_items table...');

        // Check if item_source column already exists
        const [columns] = await connection.query('SHOW COLUMNS FROM material_request_items LIKE "item_source"');
        if (columns.length === 0) {
            console.log('Adding column: item_source');
            await connection.query(`
                ALTER TABLE material_request_items 
                ADD COLUMN item_source VARCHAR(20) DEFAULT 'BOM'
            `);
        } else {
            console.log('Column item_source already exists.');
        }

        // Check if remarks column already exists
        const [remarksCols] = await connection.query('SHOW COLUMNS FROM material_request_items LIKE "remarks"');
        if (remarksCols.length === 0) {
            console.log('Adding column: remarks');
            await connection.query(`
                ALTER TABLE material_request_items 
                ADD COLUMN remarks TEXT NULL
            `);
        } else {
            console.log('Column remarks already exists.');
        }

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

runMigration();
