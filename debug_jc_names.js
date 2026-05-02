const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function debugJc() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);
    try {
        const [jc] = await connection.query(`
            SELECT jc.id, wo.wo_number, wo.item_name, wo.source_fg, wo.parent_wo_id, wo.sales_order_item_id, wo.item_code, wo.bom_no
            FROM job_cards jc
            JOIN work_orders wo ON jc.work_order_id = wo.id
            WHERE jc.job_card_no = 'JC-0176-911'
        `);
        console.log('Job Card & WO:', JSON.stringify(jc, null, 2));

        if (jc.length > 0) {
            const row = jc[0];
            
            // Check Parent WO
            if (row.parent_wo_id) {
                const [parent] = await connection.query('SELECT * FROM work_orders WHERE id = ?', [row.parent_wo_id]);
                console.log('Parent WO:', JSON.stringify(parent, null, 2));
            }

            // Check Sales Order Item
            if (row.sales_order_item_id) {
                const [soi] = await connection.query('SELECT id, description, item_code, drawing_no FROM sales_order_items WHERE id = ?', [row.sales_order_item_id]);
                console.log('SOI:', JSON.stringify(soi, null, 2));
            }

            // Check Master item by code
            const [master] = await connection.query('SELECT id, description, item_code, drawing_no FROM sales_order_items WHERE (item_code = ? OR drawing_no = ?) AND sales_order_id IS NULL', [row.source_fg, row.source_fg]);
            console.log('Master matches for source_fg:', JSON.stringify(master, null, 2));
        }
    } catch (error) {
        console.error(error);
    } finally {
        await connection.end();
    }
}

debugJc();
