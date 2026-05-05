const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkPoItemsByDrawing() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: process.env.DB_PORT || 3307
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Checking Customer PO Items for Drawing 900001105...');
        const [items] = await connection.query('SELECT * FROM customer_po_items WHERE drawing_no = "900001105"');
        console.log('PO Items:', JSON.stringify(items, null, 2));

        if (items.length > 0) {
            const poIds = [...new Set(items.map(item => item.customer_po_id))];
            const [pos] = await connection.query('SELECT * FROM customer_pos WHERE id IN (?)', [poIds]);
            console.log('Related Customer POs:', JSON.stringify(pos, null, 2));
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkPoItemsByDrawing();
