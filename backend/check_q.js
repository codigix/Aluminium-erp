const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkQuotes() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        const [rows] = await connection.query(`
            SELECT id, drawing_no, item_group, batch_id, status 
            FROM quotation_requests 
            WHERE id IN (61, 62) 
               OR batch_id IN (SELECT batch_id FROM quotation_requests WHERE id IN (61, 62))
        `);
        console.log('Quotation Items:');
        console.table(rows);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkQuotes();
