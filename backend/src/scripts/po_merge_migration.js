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
        console.log('Starting PO Merge Schema Alterations...');

        // 1. Modify Status ENUM in purchase_orders table
        console.log('Modifying status column ENUM to include MERGED...');
        await connection.query(`
            ALTER TABLE purchase_orders 
            MODIFY COLUMN status ENUM(
                'DRAFT', 'PO_REQUEST', 'ORDERED', 'SENT', 'ACKNOWLEDGED', 
                'RECEIVED', 'PARTIALLY_RECEIVED', 'CLOSED', 'COMPLETED', 
                'FULFILLED', 'APPROVED', 'PENDING_PAYMENT', 'PAID', 'MERGED'
            ) COLLATE utf8mb4_unicode_ci DEFAULT 'ORDERED'
        `);

        // 2. Add merged_into_po_id column to purchase_orders table
        console.log('Adding merged_into_po_id column...');
        const [poCols] = await connection.query('SHOW COLUMNS FROM purchase_orders LIKE "merged_into_po_id"');
        if (poCols.length === 0) {
            await connection.query('ALTER TABLE purchase_orders ADD COLUMN merged_into_po_id INT DEFAULT NULL');
            await connection.query('ALTER TABLE purchase_orders ADD CONSTRAINT fk_merged_into_po FOREIGN KEY (merged_into_po_id) REFERENCES purchase_orders(id) ON DELETE SET NULL');
            console.log('Added merged_into_po_id and foreign key constraint.');
        } else {
            console.log('merged_into_po_id column already exists.');
        }

        // 3. Add traceability columns to purchase_order_items table
        console.log('Adding traceability columns to purchase_order_items...');
        const addColumns = [
            { name: 'sales_order_id', sql: 'ALTER TABLE purchase_order_items ADD COLUMN sales_order_id INT DEFAULT NULL' },
            { name: 'mr_id', sql: 'ALTER TABLE purchase_order_items ADD COLUMN mr_id INT DEFAULT NULL' },
            { name: 'source_po_id', sql: 'ALTER TABLE purchase_order_items ADD COLUMN source_po_id INT DEFAULT NULL' },
            { name: 'source_po_item_id', sql: 'ALTER TABLE purchase_order_items ADD COLUMN source_po_item_id INT DEFAULT NULL' }
        ];

        for (const col of addColumns) {
            const [existing] = await connection.query(`SHOW COLUMNS FROM purchase_order_items LIKE "${col.name}"`);
            if (existing.length === 0) {
                await connection.query(col.sql);
                console.log(`Added column ${col.name}`);
            } else {
                console.log(`Column ${col.name} already exists.`);
            }
        }

        // 4. Add foreign key constraints to purchase_order_items
        console.log('Adding foreign key constraints to purchase_order_items...');
        const constraints = [
            { name: 'fk_poi_sales_order', sql: 'ALTER TABLE purchase_order_items ADD CONSTRAINT fk_poi_sales_order FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE SET NULL' },
            { name: 'fk_poi_mr', sql: 'ALTER TABLE purchase_order_items ADD CONSTRAINT fk_poi_mr FOREIGN KEY (mr_id) REFERENCES material_requests(id) ON DELETE SET NULL' },
            { name: 'fk_poi_source_po', sql: 'ALTER TABLE purchase_order_items ADD CONSTRAINT fk_poi_source_po FOREIGN KEY (source_po_id) REFERENCES purchase_orders(id) ON DELETE SET NULL' },
            { name: 'fk_poi_source_po_item', sql: 'ALTER TABLE purchase_order_items ADD CONSTRAINT fk_poi_source_po_item FOREIGN KEY (source_po_item_id) REFERENCES purchase_order_items(id) ON DELETE SET NULL' }
        ];

        for (const constraint of constraints) {
            try {
                await connection.query(constraint.sql);
                console.log(`Added constraint ${constraint.name}`);
            } catch (err) {
                if (err.code === 'ER_DUP_KEYNAME' || err.message.includes('Duplicate key') || err.message.includes('already exists')) {
                    console.log(`Constraint ${constraint.name} already exists.`);
                } else {
                    throw err;
                }
            }
        }

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

runMigration();
