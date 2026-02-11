const db = require('./src/config/db');

async function migrate() {
    try {
        await db.query('ALTER TABLE production_plan_items ADD COLUMN description TEXT AFTER item_code');
        await db.query('ALTER TABLE production_plan_sub_assemblies ADD COLUMN description TEXT AFTER item_code');
        console.log('Columns added successfully');
    } catch (error) {
        console.error('Migration Error:', error);
    } finally {
        process.exit();
    }
}

migrate();
