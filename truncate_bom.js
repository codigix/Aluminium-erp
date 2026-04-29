const pool = require('./backend/src/config/db');

async function truncateBOMTables() {
    const tables = [
        'sales_order_item_materials',
        'sales_order_item_components',
        'sales_order_item_operations',
        'sales_order_item_scrap',
        'bom_approval_history'
    ];

    const connection = await pool.getConnection();

    try {
        console.log('Starting BOM tables truncation...');
        
        // Disable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');

        for (const table of tables) {
            console.log(`Truncating table: ${table}`);
            await connection.query(`TRUNCATE TABLE ${table}`);
        }

        // Reset bom_cost in sales_order_items
        console.log('Resetting bom_cost in sales_order_items...');
        await connection.query('UPDATE sales_order_items SET bom_cost = 0, bom_id = NULL');

        // Enable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        
        console.log('Successfully truncated BOM creation data.');
    } catch (error) {
        console.error('Error during truncation:', error);
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
        connection.release();
        process.exit(0);
    }
}

truncateBOMTables();
