const pool = require('./backend/src/config/db');

async function truncateBOMCreationSourceData() {
    const tables = [
        'design_orders',
        'design_rejections',
        'sales_order_items',
        'sales_orders',
        'customer_drawings',
        'customer_po_items',
        'customer_pos',
        'quotation_requests',
        'production_plan_items',
        'production_plans',
        'work_orders',
        'job_cards'
    ];

    const connection = await pool.getConnection();

    try {
        console.log('Starting truncation of BOM source data...');
        
        // Disable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');

        for (const table of tables) {
            console.log(`Truncating table: ${table}`);
            await connection.query(`TRUNCATE TABLE ${table}`);
        }

        // Enable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        
        console.log('Successfully truncated BOM creation source data.');
    } catch (error) {
        console.error('Error during truncation:', error);
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
        connection.release();
        process.exit(0);
    }
}

truncateBOMCreationSourceData();
