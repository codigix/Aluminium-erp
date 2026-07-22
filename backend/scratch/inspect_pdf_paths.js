const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'e:/codigix-project/Aluminium-erp/backend/.env' });

async function inspectPaths() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp',
        port: parseInt(process.env.DB_PORT) || 3306
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Querying po_receipts...');
        const [receipts] = await connection.query('SELECT id, po_number, pdf_path FROM po_receipts ORDER BY id DESC LIMIT 5');
        console.log('Latest receipts:', receipts);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

inspectPaths();
