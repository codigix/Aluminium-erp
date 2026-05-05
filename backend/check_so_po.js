const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkSoPo() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: process.env.DB_PORT || 3307
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Checking Sales Order 35...');
        const [so] = await connection.query('SELECT * FROM sales_orders WHERE id = 35');
        console.log('Sales Order 35:', JSON.stringify(so, null, 2));

        if (so.length > 0 && so[0].customer_po_id) {
            const [po] = await connection.query('SELECT * FROM customer_pos WHERE id = ?', [so[0].customer_po_id]);
            console.log('Customer PO:', JSON.stringify(po, null, 2));
        } else {
            console.log('No customer_po_id found for SO 35');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkSoPo();
