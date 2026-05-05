const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkQuotations() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: process.env.DB_PORT || 3307
    };

    const connection = await mysql.createConnection(config);

    try {
        const [quos] = await connection.query('SELECT id, quotation_number FROM quotations LIMIT 10');
        console.log('Quotations:', quos);

        const [so] = await connection.query('SELECT id, quotation_id FROM sales_orders WHERE id = 35');
        console.log('SO 35:', so);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkQuotations();
