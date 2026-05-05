const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkQuoPo() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: process.env.DB_PORT || 3307
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Checking Quotation 145...');
        const [quo] = await connection.query('SELECT * FROM quotations WHERE id = 145');
        console.log('Quotation 145:', JSON.stringify(quo, null, 2));

        if (quo.length > 0 && quo[0].customer_po_id) {
            const [po] = await connection.query('SELECT * FROM customer_pos WHERE id = ?', [quo[0].customer_po_id]);
            console.log('Customer PO via Quotation:', JSON.stringify(po, null, 2));
        }

        console.log('Checking all Customer POs for company 43...');
        const [companyPos] = await connection.query('SELECT * FROM customer_pos WHERE company_id = 43');
        console.log('Company 43 POs:', JSON.stringify(companyPos, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkQuoPo();
