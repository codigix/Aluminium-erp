const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function runQuotationMergeMigration() {
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
        console.log('Starting Quotation Merge Schema Alterations...');

        // 1. Extend quotations status ENUM to include 'MERGED'
        try {
            await connection.query(`
                ALTER TABLE quotations 
                MODIFY COLUMN status ENUM('DRAFT','SENT','RECEIVED','REVIEWED','CLOSED','PENDING','EMAIL_RECEIVED','SUPERSEDED','REJECTED','MERGED') DEFAULT 'DRAFT'
            `);
            console.log("Updated quotations status ENUM to include 'MERGED'.");
        } catch (err) {
            console.error('Error updating quotations status ENUM:', err.message);
        }

        // 2. Add is_merged column to quotations table
        const [isMergedCols] = await connection.query('SHOW COLUMNS FROM quotations LIKE "is_merged"');
        if (isMergedCols.length === 0) {
            await connection.query('ALTER TABLE quotations ADD COLUMN is_merged TINYINT(1) DEFAULT 0');
            console.log('Added is_merged to quotations.');
        } else {
            console.log('is_merged already exists on quotations.');
        }

        // 3. Add merged_into_quotation_id column to quotations table
        const [mergedIntoCols] = await connection.query('SHOW COLUMNS FROM quotations LIKE "merged_into_quotation_id"');
        if (mergedIntoCols.length === 0) {
            await connection.query('ALTER TABLE quotations ADD COLUMN merged_into_quotation_id INT DEFAULT NULL');
            try {
                await connection.query('ALTER TABLE quotations ADD CONSTRAINT fk_merged_into_quotation FOREIGN KEY (merged_into_quotation_id) REFERENCES quotations(id) ON DELETE SET NULL');
                console.log('Added merged_into_quotation_id and FK constraint.');
            } catch (fkErr) {
                console.log('Added merged_into_quotation_id (FK skipped: ' + fkErr.message + ')');
            }
        } else {
            console.log('merged_into_quotation_id already exists on quotations.');
        }

        // 4. Add project_name column to quotations table
        const [projNameCols] = await connection.query('SHOW COLUMNS FROM quotations LIKE "project_name"');
        if (projNameCols.length === 0) {
            await connection.query('ALTER TABLE quotations ADD COLUMN project_name VARCHAR(255) DEFAULT NULL');
            console.log('Added project_name to quotations.');
        } else {
            console.log('project_name already exists on quotations.');
        }

        // 5. Add traceability columns to quotation_items table
        const itemColumns = [
            { name: 'source_quotation_id', sql: 'ALTER TABLE quotation_items ADD COLUMN source_quotation_id INT DEFAULT NULL' },
            { name: 'source_quotation_item_id', sql: 'ALTER TABLE quotation_items ADD COLUMN source_quotation_item_id INT DEFAULT NULL' },
            { name: 'source_quotation_number', sql: 'ALTER TABLE quotation_items ADD COLUMN source_quotation_number VARCHAR(100) DEFAULT NULL' },
            { name: 'source_rfq_id', sql: 'ALTER TABLE quotation_items ADD COLUMN source_rfq_id INT DEFAULT NULL' },
            { name: 'source_rfq_number', sql: 'ALTER TABLE quotation_items ADD COLUMN source_rfq_number VARCHAR(100) DEFAULT NULL' },
            { name: 'project_name', sql: 'ALTER TABLE quotation_items ADD COLUMN project_name VARCHAR(255) DEFAULT NULL' }
        ];

        for (const col of itemColumns) {
            const [existing] = await connection.query(`SHOW COLUMNS FROM quotation_items LIKE "${col.name}"`);
            if (existing.length === 0) {
                await connection.query(col.sql);
                console.log(`Added column ${col.name} to quotation_items.`);
            } else {
                console.log(`Column ${col.name} already exists on quotation_items.`);
            }
        }

        console.log('Quotation Merge migration finished successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

if (require.main === module) {
    runQuotationMergeMigration().catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = runQuotationMergeMigration;
