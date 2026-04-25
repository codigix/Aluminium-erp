const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function migrate() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT) || 3307,
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Adding missing dimension columns to BOM tables...');
        
        const tables = ['sales_order_item_materials', 'sales_order_item_components'];
        const columns = [
            'ADD COLUMN length decimal(12,4) DEFAULT 0.0000',
            'ADD COLUMN width decimal(12,4) DEFAULT 0.0000',
            'ADD COLUMN thickness decimal(12,4) DEFAULT 0.0000',
            'ADD COLUMN diameter decimal(12,4) DEFAULT 0.0000',
            'ADD COLUMN outer_diameter decimal(12,4) DEFAULT 0.0000'
        ];

        for (const table of tables) {
            console.log(`Updating table: ${table}`);
            for (const col of columns) {
                try {
                    await connection.query(`ALTER TABLE ${table} ${col}`);
                    console.log(`  Executed: ALTER TABLE ${table} ${col}`);
                } catch (e) {
                    if (e.code === 'ER_DUP_FIELDNAME') {
                        console.log(`  Column already exists in ${table}`);
                    } else {
                        throw e;
                    }
                }
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
