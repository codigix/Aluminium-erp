const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function runMigration() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3307'),
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'spTech_prod'
    };

    console.log('Connecting to database:', config.database);
    const connection = await mysql.createConnection(config);

    try {
        console.log('Starting RFQ Merge Schema Alterations...');

        // 1. Add is_merged column to procurement_rfqs table
        const [isMergedCols] = await connection.query('SHOW COLUMNS FROM procurement_rfqs LIKE "is_merged"');
        if (isMergedCols.length === 0) {
            await connection.query('ALTER TABLE procurement_rfqs ADD COLUMN is_merged TINYINT(1) DEFAULT 0');
            console.log('Added is_merged to procurement_rfqs.');
        } else {
            console.log('is_merged already exists on procurement_rfqs.');
        }

        // 2. Add merged_into_rfq_id column to procurement_rfqs table
        const [mergedIntoCols] = await connection.query('SHOW COLUMNS FROM procurement_rfqs LIKE "merged_into_rfq_id"');
        if (mergedIntoCols.length === 0) {
            await connection.query('ALTER TABLE procurement_rfqs ADD COLUMN merged_into_rfq_id INT DEFAULT NULL');
            await connection.query('ALTER TABLE procurement_rfqs ADD CONSTRAINT fk_merged_into_rfq FOREIGN KEY (merged_into_rfq_id) REFERENCES procurement_rfqs(id) ON DELETE SET NULL');
            console.log('Added merged_into_rfq_id and foreign key constraint.');
        } else {
            console.log('merged_into_rfq_id already exists on procurement_rfqs.');
        }

        // 3. Add traceability columns to procurement_rfq_items table
        const addColumns = [
            { name: 'source_rfq_id', sql: 'ALTER TABLE procurement_rfq_items ADD COLUMN source_rfq_id INT DEFAULT NULL' },
            { name: 'source_rfq_item_id', sql: 'ALTER TABLE procurement_rfq_items ADD COLUMN source_rfq_item_id INT DEFAULT NULL' },
            { name: 'source_rfq_number', sql: 'ALTER TABLE procurement_rfq_items ADD COLUMN source_rfq_number VARCHAR(50) DEFAULT NULL' },
            { name: 'project_name', sql: 'ALTER TABLE procurement_rfq_items ADD COLUMN project_name VARCHAR(255) DEFAULT NULL' }
        ];

        for (const col of addColumns) {
            const [existing] = await connection.query(`SHOW COLUMNS FROM procurement_rfq_items LIKE "${col.name}"`);
            if (existing.length === 0) {
                await connection.query(col.sql);
                console.log(`Added column ${col.name} to procurement_rfq_items.`);
            } else {
                console.log(`Column ${col.name} already exists on procurement_rfq_items.`);
            }
        }

        console.log('RFQ Merge migration finished successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

if (require.main === module) {
    runMigration().catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = runMigration;
