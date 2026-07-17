const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function syncDevToProd() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        port: parseInt(process.env.DB_PORT || '3307')
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Connecting to database spTech_dev...');
        await connection.query('USE `spTech_dev`');

        // 1. Drop extra columns in orders
        console.log('Dropping extra columns in orders table...');
        try {
            await connection.query('ALTER TABLE `orders` DROP COLUMN `sales_order_id`');
            console.log('Dropped sales_order_id');
        } catch (e) {
            console.log('sales_order_id already dropped or error:', e.message);
        }

        try {
            await connection.query('ALTER TABLE `orders` DROP COLUMN `shipment_id`');
            console.log('Dropped shipment_id');
        } catch (e) {
            console.log('shipment_id already dropped or error:', e.message);
        }

        // 2. Add vendor_ids to procurement_rfq_items
        console.log('Adding vendor_ids to procurement_rfq_items table...');
        try {
            await connection.query('ALTER TABLE `procurement_rfq_items` ADD COLUMN `vendor_ids` varchar(255) DEFAULT NULL');
            console.log('Added vendor_ids');
        } catch (e) {
            console.log('vendor_ids already exists or error:', e.message);
        }

        // 3. Handle PENDING_ITEMS status in procurement_rfqs
        console.log('Updating procurement_rfqs with PENDING_ITEMS status to DRAFT...');
        await connection.query('UPDATE `procurement_rfqs` SET `status` = "DRAFT" WHERE `status` = "PENDING_ITEMS"');

        // 4. Modify procurement_rfqs status enum
        console.log('Altering status enum in procurement_rfqs table...');
        await connection.query("ALTER TABLE `procurement_rfqs` MODIFY COLUMN `status` enum('DRAFT','SENT','RECEIVED','CLOSED') DEFAULT 'DRAFT'");
        console.log('Altered status enum');

        // 5. Create procurement_rfq_vendor_assignments table
        console.log('Creating procurement_rfq_vendor_assignments table if not exists...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`procurement_rfq_vendor_assignments\` (
              \`id\` int NOT NULL AUTO_INCREMENT,
              \`rfq_id\` int NOT NULL,
              \`rfq_item_id\` int NOT NULL,
              \`vendor_id\` int NOT NULL,
              \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (\`id\`),
              UNIQUE KEY \`unique_assignment\` (\`rfq_id\`,\`rfq_item_id\`,\`vendor_id\`),
              KEY \`rfq_item_id\` (\`rfq_item_id\`),
              KEY \`vendor_id\` (\`vendor_id\`),
              CONSTRAINT \`procurement_rfq_vendor_assignments_ibfk_1\` FOREIGN KEY (\`rfq_id\`) REFERENCES \`procurement_rfqs\` (\`id\`) ON DELETE CASCADE,
              CONSTRAINT \`procurement_rfq_vendor_assignments_ibfk_2\` FOREIGN KEY (\`rfq_item_id\`) REFERENCES \`procurement_rfq_items\` (\`id\`) ON DELETE CASCADE,
              CONSTRAINT \`procurement_rfq_vendor_assignments_ibfk_3\` FOREIGN KEY (\`vendor_id\`) REFERENCES \`vendors\` (\`id\`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('Table procurement_rfq_vendor_assignments created successfully.');

        console.log('\nMigration completed successfully!');

    } catch (error) {
        console.error('Error during migration:', error);
    } finally {
        await connection.end();
    }
}

syncDevToProd();
