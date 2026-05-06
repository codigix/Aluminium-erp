const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

(async () => {
    try {
        const config = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'sales_erp'
        };
        const connection = await mysql.createConnection(config);
        
        const [rfqStatuses] = await connection.query('SELECT DISTINCT status FROM procurement_rfqs');
        console.log('RFQ Statuses:', rfqStatuses);
        
        const [poStatuses] = await connection.query('SELECT DISTINCT status FROM purchase_orders');
        console.log('PO Statuses:', poStatuses);
        
        const [recentPO] = await connection.query('SELECT po_number, status, created_at FROM purchase_orders ORDER BY created_at DESC LIMIT 5');
        console.log('Recent POs:', recentPO);
        
        const [recentRFQ] = await connection.query('SELECT rfq_number, status, created_at FROM procurement_rfqs ORDER BY created_at DESC LIMIT 5');
        console.log('Recent RFQs:', recentRFQ);
        
        await connection.end();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
