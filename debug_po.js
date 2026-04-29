const mysql = require('./backend/node_modules/mysql2/promise');
require('./backend/node_modules/dotenv').config({ path: './backend/.env' });

async function debug() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: parseInt(process.env.DB_PORT) || 3307
    };

    const connection = await mysql.createConnection(config);
    try {
        console.log('--- PO Info ---');
        const [pos] = await connection.query("SELECT id, po_number FROM customer_pos WHERE po_number = 'PO-2026-001'");
        console.log('PO:', pos);
        
        if (pos.length > 0) {
            const [items] = await connection.query("SELECT id, drawing_no, item_code FROM customer_po_items WHERE customer_po_id = ?", [pos[0].id]);
            console.log('PO Items:', items);
            
            for (const item of items) {
                const [sa] = await connection.query("SELECT * FROM customer_po_item_subassemblies WHERE po_item_id = ?", [item.id]);
                console.log(`Stored SA for Item ${item.id}:`, sa.length);
            }
        }

        console.log('\n--- SOI Info for 865544343 ---');
        const [sois] = await connection.query("SELECT id, item_code, drawing_no, sales_order_id, bom_cost FROM sales_order_items WHERE drawing_no = '865544343'");
        for (const soi of sois) {
            const [comps] = await connection.query("SELECT count(*) as count FROM sales_order_item_components WHERE sales_order_item_id = ?", [soi.id]);
            console.log(`SOI ID ${soi.id} (${soi.item_code}): sales_order_id=${soi.sales_order_id}, bom_cost=${soi.bom_cost}, components=${comps[0].count}`);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

debug();
