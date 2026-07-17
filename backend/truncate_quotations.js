const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function truncateQuotationTables() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3307'),
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'spTech_prod'
    };

    console.log('Connecting to database...');
    const connection = await mysql.createConnection(config);

    try {
        console.log('Starting quotation & RFQ tables truncation...');
        
        // 1. Disable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');

        const tablesToTruncate = [
            'quotations',
            'quotation_items',
            'quotation_communications',
            'quotation_requests',
            'procurement_rfqs',
            'procurement_rfq_items',
            'procurement_rfq_vendor_assignments'
        ];

        for (const tableName of tablesToTruncate) {
            console.log(`Truncating table: ${tableName}`);
            await connection.query(`TRUNCATE TABLE \`${tableName}\``);
        }

        // 3. Enable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        
        console.log('Successfully truncated quotation & RFQ tables.');
    } catch (error) {
        console.error('Error during truncation:', error);
        try {
            await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        } catch (e) {}
    } finally {
        await connection.end();
    }
}

truncateQuotationTables();
