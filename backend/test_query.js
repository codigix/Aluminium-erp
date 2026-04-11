const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function test() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: parseInt(process.env.DB_PORT) || 3307
    };

    try {
        const connection = await mysql.createConnection(config);
        const [rows] = await connection.query(`
            SELECT o.*, c.company_name AS client,
                   COALESCE(NULLIF(o.project_name, ''), NULLIF(cp.project_name, '')) as project_name
            FROM orders o
            JOIN companies c ON c.id = o.client_id
            LEFT JOIN customer_pos cp ON cp.id = o.quotation_id AND o.source_type = 'DIRECT'
            ORDER BY o.created_at DESC
        `);
        console.log('Query success, rows found:', rows.length);
        if (rows.length > 0) {
            console.table(rows.slice(0, 5).map(r => ({
                id: r.id,
                order_no: r.order_no,
                project_name: r.project_name
            })));
        }
        await connection.end();
    } catch (error) {
        console.error('Error:', error.message);
    }
}

test();
