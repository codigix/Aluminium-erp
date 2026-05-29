const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3307,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        const [companies] = await connection.query('SELECT id, company_name, status FROM company_master');
        console.log('--- company_master ---');
        console.log(companies);

        const [pos] = await connection.query('SELECT id, po_number, quotation_id FROM purchase_orders ORDER BY id DESC LIMIT 5');
        console.log('--- purchase_orders (latest 5) ---');
        console.log(pos);

        for (const po of pos) {
            if (po.quotation_id) {
                const [quotes] = await connection.query('SELECT id, quote_number, host_company_id FROM quotations WHERE id = ?', [po.quotation_id]);
                console.log(`--- quotation for PO ${po.po_number} ---`);
                console.log(quotes);
            }
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

main();
