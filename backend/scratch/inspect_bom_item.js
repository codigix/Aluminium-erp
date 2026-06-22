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
        console.log("=== Inspecting sales_order_items for ID 585 ===");
        const [rows] = await connection.query(
            "SELECT id, sales_order_id, parent_bom_id, item_code, drawing_no, item_group, bom_cost, drawing_type, item_type FROM sales_order_items WHERE id = 585"
        );
        console.log(JSON.stringify(rows, null, 2));

        if (rows.length > 0) {
            const itemCode = rows[0].item_code;
            const drawingNo = rows[0].drawing_no;
            console.log(`=== Inspecting other items with item_code=${itemCode} or drawing_no=${drawingNo} ===`);
            const [others] = await connection.query(
                "SELECT id, sales_order_id, parent_bom_id, item_code, drawing_no, item_group, bom_cost, drawing_type, item_type FROM sales_order_items WHERE item_code = ? OR drawing_no = ?",
                [itemCode, drawingNo]
            );
            console.table(others);
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

run();
