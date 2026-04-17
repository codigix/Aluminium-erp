const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function migrate() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Starting quotation_requests migration...');

        const [columns] = await connection.query('SHOW COLUMNS FROM quotation_requests');
        const existing = new Set(columns.map(c => c.Field));

        const requiredColumns = [
            { name: 'total_amount', definition: 'DECIMAL(14, 2) DEFAULT 0' },
            { name: 'received_amount', definition: 'DECIMAL(14, 2) DEFAULT 0' },
            { name: 'notes', definition: 'TEXT NULL' },
            { name: 'sales_order_item_id', definition: 'INT NULL' },
            { name: 'rejection_reason', definition: 'TEXT NULL' },
            { name: 'project_name', definition: 'VARCHAR(255) NULL' },
            { name: 'version', definition: 'INT DEFAULT 1' },
            { name: 'parent_id', definition: 'INT NULL' },
            { name: 'drawing_no', definition: 'VARCHAR(255) NULL' },
            { name: 'description', definition: 'TEXT NULL' },
            { name: 'item_unit', definition: 'VARCHAR(50) DEFAULT "Nos"' },
            { name: 'batch_id', definition: 'VARCHAR(100) NULL' }
        ];

        for (const col of requiredColumns) {
            if (!existing.has(col.name)) {
                console.log(`Adding column: ${col.name}`);
                await connection.query(`ALTER TABLE quotation_requests ADD COLUMN \`${col.name}\` ${col.definition}`);
            }
        }

        // Update status enum
        console.log('Updating status enum...');
        await connection.query(`
            ALTER TABLE quotation_requests 
            MODIFY COLUMN status ENUM('PENDING', 'APPROVAL', 'Approved', 'REJECTED', 'COMPLETED', 'ACCEPTED', 'DRAFT', 'SENT', 'REVISED') DEFAULT 'PENDING'
        `);

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();
