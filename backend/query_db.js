const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function query() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT) || 3307,
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);
    try {
        const [tables] = await connection.query("SHOW TABLES");
        console.log("Tables:", tables.map(t => Object.values(t)[0]));

        const [orders] = await connection.query("SELECT id, project_name, status FROM sales_orders LIMIT 20");
        console.log("Orders:", JSON.stringify(orders, null, 2));
        
        const [items] = await connection.query("SELECT id, item_code, drawing_no, item_type, item_group, description, bom_cost, status, sales_order_id, bom_id FROM sales_order_items WHERE sales_order_id IN (?)", [orders.map(o => o.id)]);
        console.log(JSON.stringify(items, null, 2));

        const itemIds = items.map(i => i.id);
        if (itemIds.length > 0) {
            console.log("\nComponents for these order items:");
            const [components] = await connection.query("SELECT * FROM sales_order_item_components WHERE sales_order_item_id IN (?)", [itemIds]);
            console.log(JSON.stringify(components, null, 2));

            console.log("\nMaster BOM Components for these item codes:");
            const codes = items.map(i => i.item_code).filter(Boolean);
            if (codes.length > 0) {
                const [masterComponents] = await connection.query(`
                    SELECT * FROM sales_order_item_components 
                    WHERE sales_order_item_id IN (
                        SELECT id FROM sales_order_items WHERE item_code IN (?) AND sales_order_id IS NULL
                    )
                `, [codes]);
                console.log(JSON.stringify(masterComponents, null, 2));
            }
        }

        // Also check stock_balance for these item codes
        const itemCodes = items.map(i => i.item_code).filter(Boolean);
        if (itemCodes.length > 0) {
            const [stock] = await connection.query("SELECT item_code, material_type, product_type FROM stock_balance WHERE item_code IN (?)", [itemCodes]);
            console.log("\nStock Balance:");
            console.log(JSON.stringify(stock, null, 2));
        }

    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

query();
