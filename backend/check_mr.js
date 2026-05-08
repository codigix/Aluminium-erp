const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function checkMR() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'backend',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Listing all RFQs and their linked MRs:');
        const [rfqs] = await connection.query(`
            SELECT r.id as rfq_id, r.rfq_number, r.mr_id, mr.mr_number, mr.status as mr_status
            FROM procurement_rfqs r
            LEFT JOIN material_requests mr ON r.mr_id = mr.id
            ORDER BY r.id DESC
        `);
        console.table(rfqs);

        if (rfqs.length > 0) {
            for (const rfq of rfqs.slice(0, 3)) {
                console.log(`\nItems for RFQ ${rfq.rfq_number} (ID ${rfq.rfq_id}):`);
                const [items] = await connection.query('SELECT * FROM procurement_rfq_items WHERE rfq_id = ?', [rfq.rfq_id]);
                console.table(items.map(i => ({ code: i.item_code, name: i.material_name, qty: i.quantity })));
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkMR();
