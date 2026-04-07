const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

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
        console.log('Starting migration to add dimension columns to production_plan_materials...');
        
        const [columns] = await connection.query('SHOW COLUMNS FROM production_plan_materials');
        const existing = new Set(columns.map(col => col.Field));
        
        const required = [
            { name: 'length', definition: 'DECIMAL(12, 4) DEFAULT 0' },
            { name: 'width', definition: 'DECIMAL(12, 4) DEFAULT 0' },
            { name: 'thickness', definition: 'DECIMAL(12, 4) DEFAULT 0' },
            { name: 'diameter', definition: 'DECIMAL(12, 4) DEFAULT 0' },
            { name: 'outer_diameter', definition: 'DECIMAL(12, 4) DEFAULT 0' }
        ];

        for (const col of required) {
            if (!existing.has(col.name)) {
                console.log(`Adding column: ${col.name}`);
                await connection.query(`ALTER TABLE production_plan_materials ADD COLUMN ${col.name} ${col.definition}`);
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
