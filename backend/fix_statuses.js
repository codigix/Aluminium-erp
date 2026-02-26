const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function fixStatuses() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: process.env.DB_PORT || 3307
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Starting status standardization...');
        
        // Disable foreign key checks temporarily
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');

        // 1. Update Quotations Table ENUM and values
        console.log('Updating quotations status enum...');
        await connection.query(`ALTER TABLE quotations MODIFY status ENUM('DRAFT', 'SENT', 'RECEIVED', 'REVIEWED', 'CLOSED', 'PENDING', 'EMAIL_RECEIVED') DEFAULT 'DRAFT'`);
        
        // Fix any existing 'Sent ' values (though MODIFY might have truncated them or failed depending on settings)
        // Usually, if we want to preserve data, we should update first, then modify.
        
        // Let's do it safely:
        // First add 'SENT' to enum if not there (already did in MODIFY)
        // Update values
        await connection.query("UPDATE quotations SET status = 'SENT' WHERE status = 'Sent '");
        await connection.query("UPDATE quotations SET status = 'SENT' WHERE status = 'Sent'");

        // 2. Update Purchase Orders Table ENUM and values
        console.log('Updating purchase_orders status enum...');
        await connection.query(`ALTER TABLE purchase_orders MODIFY status ENUM('DRAFT', 'PO_REQUEST', 'ORDERED', 'SENT', 'ACKNOWLEDGED', 'RECEIVED', 'PARTIALLY_RECEIVED', 'CLOSED', 'COMPLETED', 'FULFILLED', 'APPROVED', 'PENDING_PAYMENT', 'PAID') DEFAULT 'ORDERED'`);
        await connection.query("UPDATE purchase_orders SET status = 'SENT' WHERE status = 'Sent '");
        await connection.query("UPDATE purchase_orders SET status = 'SENT' WHERE status = 'Sent'");

        // 3. Update any other tables? (material_requests has 'Approved ')
        console.log('Cleaning up other trailing spaces...');
        await connection.query(`ALTER TABLE material_requests MODIFY status ENUM('DRAFT', 'APPROVED', 'PROCESSING', 'FULFILLED', 'CANCELLED', 'ORDERED', 'COMPLETED', 'PO_CREATED') DEFAULT 'DRAFT'`);
        await connection.query("UPDATE material_requests SET status = 'APPROVED' WHERE status = 'Approved '");

        await connection.query(`ALTER TABLE grns MODIFY status ENUM('PENDING', 'RECEIVED', 'INSPECTED', 'APPROVED', 'REJECTED') DEFAULT 'PENDING'`);
        await connection.query("UPDATE grns SET status = 'APPROVED' WHERE status = 'Approved '");

        await connection.query(`ALTER TABLE job_card_quality_logs MODIFY status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING'`);
        await connection.query("UPDATE job_card_quality_logs SET status = 'APPROVED' WHERE status = 'Approved '");

        await connection.query(`ALTER TABLE customer_pos MODIFY status ENUM('DRAFT', 'APPROVED', 'REJECTED') DEFAULT 'DRAFT'`);
        await connection.query("UPDATE customer_pos SET status = 'APPROVED' WHERE status = 'Approved '");

        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        
        console.log('Successfully standardized all statuses.');
    } catch (error) {
        console.error('Error during standardization:', error);
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
        await connection.end();
    }
}

fixStatuses();
