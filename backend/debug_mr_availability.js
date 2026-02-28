const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function debugMR() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: process.env.DB_PORT || 3307
    };

    const connection = await mysql.createConnection(config);

    try {
        const mrNumber = 'MR-20260228-001';
        console.log(`Checking MR: ${mrNumber}`);

        const [mrs] = await connection.query('SELECT id, mr_number FROM material_requests WHERE mr_number = ?', [mrNumber]);
        if (mrs.length === 0) {
            console.log('MR not found');
            return;
        }
        const mrId = mrs[0].id;

        const [items] = await connection.query(`
            SELECT mri.item_code, mri.design_qty, mri.quantity, mri.item_type,
            (SELECT SUM(current_balance) FROM stock_balance WHERE item_code = mri.item_code) as total_stock
            FROM material_request_items mri
            WHERE mri.mr_id = ?
        `, [mrId]);

        console.log('Items for MR:');
        items.forEach(item => {
            const required = item.quantity || item.design_qty || 0;
            const available = item.total_stock || 0;
            const isAvailable = parseFloat(available) >= parseFloat(required);
            console.log(`Item: ${item.item_code}, Req(qty): ${required}, Stock: ${available}, IsAvailable: ${isAvailable}`);
        });

        const [availCheck] = await connection.query(`
            SELECT CASE 
                WHEN COUNT(*) = 0 THEN 'available'
                WHEN COUNT(*) = SUM(CASE WHEN (SELECT SUM(current_balance) FROM stock_balance WHERE item_code = mri.item_code) >= COALESCE(NULLIF(mri.quantity, 0), mri.design_qty, 0) THEN 1 ELSE 0 END) THEN 'available'
                ELSE 'unavailable'
            END as availability
            FROM material_request_items mri
            WHERE mri.mr_id = ?
            AND UPPER(COALESCE(mri.item_type, '')) NOT IN ('FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY')
        `, [mrId]);

        console.log('Availability calculation result:', availCheck[0].availability);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

debugMR();
