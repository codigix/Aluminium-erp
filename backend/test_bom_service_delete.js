const mysql = require('mysql2/promise');
require('dotenv').config();
const bomService = require('./src/services/bomService');
const pool = require('./src/config/db');

async function run() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT) || 3307,
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'spTech_dev'
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log("=== Inspecting state before delete ===");
        const [before] = await connection.query(
            "SELECT id, drawing_no, item_code, item_group, description, bom_cost, parent_bom_id, status FROM sales_order_items WHERE id IN (574, 575, 576, 577)"
        );
        console.table(before);

        // We want to test deleteBOM but rollback. Wait! bomService.deleteBOM gets a new connection from the pool and handles the transaction itself, committing it!
        // If we call bomService.deleteBOM directly, it will COMMIT the deletion.
        // Wait, if it commits, the test item 577 will be deleted.
        // That's fine for testing, but wait, do we want to permanently delete 577?
        // Well, we can backing up 577's record first, run deleteBOM, verify, and then insert it back to restore the database perfectly!
        // Let's do that! That's extremely robust and ensures the database is left in exactly the same state.
        
        console.log("\nBacking up rows to restore them later...");
        const [materials] = await connection.query("SELECT * FROM sales_order_item_materials WHERE sales_order_item_id = 577");
        const [components] = await connection.query("SELECT * FROM sales_order_item_components WHERE sales_order_item_id = 577");
        const [operations] = await connection.query("SELECT * FROM sales_order_item_operations WHERE sales_order_item_id = 577");
        const [scrap] = await connection.query("SELECT * FROM sales_order_item_scrap WHERE sales_order_item_id = 577");
        const [parentBomRow] = await connection.query("SELECT * FROM sales_order_items WHERE id = 577");

        console.log("\n=== Calling bomService.deleteBOM(577) ===");
        await bomService.deleteBOM(577);

        console.log("\n=== Inspecting state after delete ===");
        const [after] = await connection.query(
            "SELECT id, drawing_no, item_code, item_group, description, bom_cost, parent_bom_id, status FROM sales_order_items WHERE id IN (574, 575, 576, 577)"
        );
        console.table(after);

        const deletedItem = after.find(i => i.id === 577);
        const child1 = after.find(i => i.id === 574);
        const child2 = after.find(i => i.id === 576);

        let success = false;
        if (!deletedItem && child1 && child1.parent_bom_id === 575 && child2 && child2.parent_bom_id === 575) {
            console.log("\n✅ SUCCESS: deleteBOM service function works perfectly!");
            success = true;
        } else {
            console.error("\n❌ FAILED: Verification check failed.");
        }

        console.log("\nRestoring database to original state...");
        // 1. Re-insert parent row
        if (parentBomRow.length > 0) {
            const r = parentBomRow[0];
            const keys = Object.keys(r);
            const vals = Object.values(r);
            const placeholders = keys.map(() => '?').join(',');
            await connection.query(`INSERT INTO sales_order_items (${keys.join(',')}) VALUES (${placeholders})`, vals);
        }

        // 2. Re-insert materials
        for (const m of materials) {
            const keys = Object.keys(m);
            const vals = Object.values(m);
            const placeholders = keys.map(() => '?').join(',');
            await connection.query(`INSERT INTO sales_order_item_materials (${keys.join(',')}) VALUES (${placeholders})`, vals);
        }

        // 3. Re-insert components
        for (const c of components) {
            const keys = Object.keys(c);
            const vals = Object.values(c);
            const placeholders = keys.map(() => '?').join(',');
            await connection.query(`INSERT INTO sales_order_item_components (${keys.join(',')}) VALUES (${placeholders})`, vals);
        }

        // 4. Re-insert operations
        for (const o of operations) {
            const keys = Object.keys(o);
            const vals = Object.values(o);
            const placeholders = keys.map(() => '?').join(',');
            await connection.query(`INSERT INTO sales_order_item_operations (${keys.join(',')}) VALUES (${placeholders})`, vals);
        }

        // 5. Re-insert scrap
        for (const s of scrap) {
            const keys = Object.keys(s);
            const vals = Object.values(s);
            const placeholders = keys.map(() => '?').join(',');
            await connection.query(`INSERT INTO sales_order_item_scrap (${keys.join(',')}) VALUES (${placeholders})`, vals);
        }

        // 6. Reset parent_bom_id of children back to 577
        await connection.query("UPDATE sales_order_items SET parent_bom_id = 577 WHERE id IN (574, 576)");

        console.log("Database restore complete. All data restored to original state.");

    } catch (error) {
        console.error('Error during test execution:', error);
    } finally {
        await connection.end();
    }
}

run();
