const pool = require('./backend/src/config/db');

async function migrateStatusEnum() {
    try {
        console.log('Migrating sales_orders status ENUM...');
        await pool.execute(`
            ALTER TABLE sales_orders MODIFY COLUMN status ENUM(
                'CREATED', 'DESIGN_IN_REVIEW', 'DESIGN_APPROVED', 'DESIGN_QUERY', 
                'BOM_SUBMITTED', 'BOM_APPROVED', 'PROCUREMENT_IN_PROGRESS', 
                'MATERIAL_PURCHASE_IN_PROGRESS', 'MATERIAL_READY', 'IN_PRODUCTION', 
                'PRODUCTION_COMPLETED', 'QC_APPROVED', 'QC_REJECTED', 
                'READY_FOR_SHIPMENT', 'SHIPPED', 'CLOSED'
            ) DEFAULT 'CREATED'
        `);
        console.log('Migration successful!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrateStatusEnum();
