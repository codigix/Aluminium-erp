const mysql = require('mysql2/promise');

async function run() {
    const config = {
        host: '127.0.0.1',
        port: 3307,
        user: 'aluminium_user',
        password: 'C0digix$309',
        database: 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log("Searching for 'loader setup part no 2-4vECO ASSEMBLY'...");
        const [items] = await connection.query(
            "SELECT id, drawing_no, item_code, item_group, description, bom_cost, sales_order_id, parent_bom_id, status FROM sales_order_items WHERE description LIKE '%loader setup part no%'"
        );
        console.table(items);

        for (const item of items) {
            console.log(`\n=== Inspection for Item ID ${item.id} (${item.description}) ===`);
            
            // Query components
            const [components] = await connection.query(
                "SELECT id, component_code, item_group, quantity, rate, description, drawing_no FROM sales_order_item_components WHERE sales_order_item_id = ?",
                [item.id]
            );
            console.log("Components:");
            console.table(components);

            // Query child items in sales_order_items
            const [children] = await connection.query(
                "SELECT id, drawing_no, item_code, item_group, description, bom_cost, parent_bom_id, status FROM sales_order_items WHERE parent_bom_id = ?",
                [item.id]
            );
            console.log("Child sales_order_items (referencing via parent_bom_id):");
            console.table(children);
        }

        // Search for 'PART LOADER' in sales_order_items
        const [partLoaders] = await connection.query(
            "SELECT id, drawing_no, item_code, item_group, description, bom_cost, parent_bom_id, status FROM sales_order_items WHERE description LIKE '%PART LOADER%' OR item_code LIKE '%PART LOADER%'"
        );
        console.log("\n=== PART LOADER records in sales_order_items ===");
        console.table(partLoaders);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

run();
