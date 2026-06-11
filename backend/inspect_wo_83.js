const mysql = require('mysql2/promise');
require('dotenv').config();

async function inspect() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3307'),
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'spTech_prod'
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Querying work_orders for id = 83...');
        const [wo] = await connection.query(
            "SELECT * FROM work_orders WHERE id = 83"
        );
        console.log(wo);

        if (wo.length > 0) {
            const salesOrderId = wo[0].sales_order_id;
            const salesOrderItemId = wo[0].sales_order_item_id;
            console.log('Querying sales_order_item_operations for sales_order_item_id:', salesOrderItemId);
            const [soOps] = await connection.query(
                "SELECT * FROM sales_order_item_operations WHERE sales_order_item_id = ?",
                [salesOrderItemId]
            );
            console.log(soOps);
        }

    } catch (error) {
        console.error('Error during query:', error);
    } finally {
        await connection.end();
    }
}

inspect();
