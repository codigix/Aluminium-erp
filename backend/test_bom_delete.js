const mysql = require('mysql2/promise');
require('dotenv').config();

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
        console.log("=== STEP 1: Inspecting current state before test ===");
        const [originalItems] = await connection.query(
            "SELECT id, drawing_no, item_code, item_group, description, bom_cost, parent_bom_id, status FROM sales_order_items WHERE id IN (574, 575, 576, 577)"
        );
        console.table(originalItems);

        const targetItem = originalItems.find(i => i.id === 577);
        if (!targetItem) {
            console.error("Test item 577 not found. Cannot proceed with automatic test.");
            return;
        }

        // We will start a transaction, execute our logic, inspect the results, and then ROLLBACK so we do not actually commit any changes yet!
        console.log("\n=== STEP 2: Running deleteBOM (simulated inside a transaction with rollback) ===");
        await connection.beginTransaction();

        const itemId = 577;

        // Fetch sales_order_id, drawing_no, and item_code before deletion
        const [itemRows] = await connection.query('SELECT sales_order_id, drawing_no, item_code FROM sales_order_items WHERE id = ?', [itemId]);
        const salesOrderId = itemRows.length > 0 ? itemRows[0].sales_order_id : null;
        const drawingNo = itemRows.length > 0 ? itemRows[0].drawing_no : null;
        const itemCode = itemRows.length > 0 ? itemRows[0].item_code : null;

        // Find an alternative parent item in sales_order_items (e.g., the original sales order item representation)
        let altParentId = null;
        if (itemRows.length > 0) {
            let altQuery = '';
            let altParams = [];
            if (salesOrderId) {
                altQuery = `
                  SELECT id FROM sales_order_items 
                  WHERE sales_order_id = ? 
                    AND (
                      (drawing_no = ? AND drawing_no IS NOT NULL AND drawing_no != '' AND drawing_no != '—' AND drawing_no != 'N/A' AND drawing_no != 'NA')
                      OR (item_code = ? AND item_code IS NOT NULL AND item_code != '')
                    )
                    AND id != ? 
                  ORDER BY id ASC LIMIT 1
                `;
                altParams = [salesOrderId, drawingNo, itemCode, itemId];
            } else {
                altQuery = `
                  SELECT id FROM sales_order_items 
                  WHERE sales_order_id IS NULL 
                    AND (
                      (drawing_no = ? AND drawing_no IS NOT NULL AND drawing_no != '' AND drawing_no != '—' AND drawing_no != 'N/A' AND drawing_no != 'NA')
                      OR (item_code = ? AND item_code IS NOT NULL AND item_code != '')
                    )
                    AND id != ? 
                  ORDER BY id ASC LIMIT 1
                `;
                altParams = [drawingNo, itemCode, itemId];
            }
            const [altRows] = await connection.query(altQuery, altParams);
            if (altRows.length > 0) {
                altParentId = altRows[0].id;
            }
        }

        console.log("Alternative parent found:", altParentId);

        // Handle references in other tables (redirect to altParentId if available, otherwise set to NULL)
        if (altParentId) {
            console.log(`Redirecting child parent_bom_id and references to ID ${altParentId}...`);
            await connection.execute('UPDATE sales_order_items SET parent_bom_id = ? WHERE parent_bom_id = ?', [altParentId, itemId]);
            await connection.execute('UPDATE quotation_requests SET sales_order_item_id = ? WHERE sales_order_item_id = ?', [altParentId, itemId]);
            await connection.execute('UPDATE production_plan_items SET sales_order_item_id = ? WHERE sales_order_item_id = ?', [altParentId, itemId]);
            await connection.execute('UPDATE work_orders SET sales_order_item_id = ? WHERE sales_order_item_id = ?', [altParentId, itemId]);
        } else {
            console.log("No alternative parent found. Setting references to NULL...");
            await connection.execute('UPDATE sales_order_items SET parent_bom_id = NULL WHERE parent_bom_id = ?', [itemId]);
            await connection.execute('UPDATE quotation_requests SET sales_order_item_id = NULL WHERE sales_order_item_id = ?', [itemId]);
            await connection.execute('UPDATE production_plan_items SET sales_order_item_id = NULL WHERE sales_order_item_id = ?', [itemId]);
            await connection.execute('UPDATE work_orders SET sales_order_item_id = NULL WHERE sales_order_item_id = ?', [itemId]);
        }

        // Delete item-specific BOM entries
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
        await connection.execute('DELETE FROM sales_order_item_materials WHERE sales_order_item_id = ?', [itemId]);
        await connection.execute('DELETE FROM sales_order_item_components WHERE sales_order_item_id = ?', [itemId]);
        await connection.execute('DELETE FROM sales_order_item_operations WHERE sales_order_item_id = ?', [itemId]);
        await connection.execute('DELETE FROM sales_order_item_scrap WHERE sales_order_item_id = ?', [itemId]);

        // Delete the version record itself from sales_order_items
        await connection.execute('DELETE FROM sales_order_items WHERE id = ?', [itemId]);
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

        console.log("\n=== STEP 3: Inspecting state after deletion ===");
        const [afterItems] = await connection.query(
            "SELECT id, drawing_no, item_code, item_group, description, bom_cost, parent_bom_id, status FROM sales_order_items WHERE id IN (574, 575, 576, 577)"
        );
        console.table(afterItems);

        // Verification checks
        const deletedItem = afterItems.find(i => i.id === 577);
        const child1 = afterItems.find(i => i.id === 574);
        const child2 = afterItems.find(i => i.id === 576);

        if (!deletedItem && child1 && child1.parent_bom_id === 575 && child2 && child2.parent_bom_id === 575) {
            console.log("\n✅ SUCCESS: Deletion test passed! Assembly (577) was deleted, and child parts (574, 576) correctly point to original parent (575).");
        } else {
            console.error("\n❌ FAILED: Verification check failed.");
            console.log("deletedItem (should be undefined):", deletedItem);
            console.log("child1 parent_bom_id (should be 575):", child1?.parent_bom_id);
            console.log("child2 parent_bom_id (should be 575):", child2?.parent_bom_id);
        }

        console.log("\n=== STEP 4: Rolling back transaction ===");
        await connection.rollback();
        console.log("Transaction successfully rolled back. Database is clean.");

    } catch (error) {
        console.error('Error during test execution:', error);
        await connection.rollback();
    } finally {
        await connection.end();
    }
}

run();
