const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkData() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: parseInt(process.env.DB_PORT) || 3307
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('\n--- Sales Orders with PO Project Name ---');
        const [orders] = await connection.query(`
            SELECT so.id, so.customer_po_id, so.project_name as so_project, 
                   cp.project_name as po_project,
                   COALESCE(NULLIF(so.project_name, ''), NULLIF(cp.project_name, '')) as merged_project
            FROM sales_orders so
            LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
            ORDER BY so.id DESC LIMIT 10
        `);
        console.table(orders);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkData();
