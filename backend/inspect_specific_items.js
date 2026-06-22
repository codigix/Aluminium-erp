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
        const itemIds = [574, 575, 576, 577];

        console.log("=== Quotation Requests referencing these items ===");
        const [qrs] = await connection.query(
            "SELECT id, sales_order_item_id, status, drawing_no, description, bom_cost FROM quotation_requests WHERE sales_order_item_id IN (?)",
            [itemIds]
        );
        console.table(qrs);

        console.log("=== Production Plan Items referencing these items ===");
        const [ppColumns] = await connection.query("SHOW COLUMNS FROM production_plan_items LIKE 'sales_order_item_id'");
        if (ppColumns.length > 0) {
            const [ppItems] = await connection.query(
                "SELECT id, sales_order_item_id, plan_id, item_code, description FROM production_plan_items WHERE sales_order_item_id IN (?)",
                [itemIds]
            );
            console.table(ppItems);
        } else {
            console.log("production_plan_items does not have sales_order_item_id column");
        }

        console.log("=== Work Orders referencing these items ===");
        const [woRows] = await connection.query(
            "SELECT id, sales_order_item_id, status FROM work_orders WHERE sales_order_item_id IN (?)",
            [itemIds]
        );
        console.table(woRows);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

run();
