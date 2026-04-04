const pool = require('./backend/src/config/db');

async function runFix() {
    try {
        console.log('Synchronizing BOM material columns...');
        const [columns] = await pool.query('SHOW COLUMNS FROM sales_order_item_materials');
        const existing = new Set(columns.map(column => column.Field));
        
        if (!existing.has('weight_per_unit')) {
            await pool.query('ALTER TABLE sales_order_item_materials ADD COLUMN weight_per_unit DECIMAL(10, 4) DEFAULT 0');
            console.log('Added weight_per_unit');
        }
        if (!existing.has('scrap_percent')) {
            await pool.query('ALTER TABLE sales_order_item_materials ADD COLUMN scrap_percent DECIMAL(10, 2) DEFAULT 0');
            console.log('Added scrap_percent');
        }
        console.log('Synchronization complete');
    } catch (err) {
        console.error('Failed to sync:', err);
    } finally {
        await pool.end();
    }
}

runFix();
