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

    console.log("Connecting to Database:", config.database);
    const connection = await mysql.createConnection(config);

    try {
        console.log("Searching for 'loader setup'...");
        const [items] = await connection.query(
            "SELECT id, drawing_no, item_code, item_group, description, bom_cost, sales_order_id, parent_bom_id, status FROM sales_order_items WHERE description LIKE '%loader setup%'"
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
