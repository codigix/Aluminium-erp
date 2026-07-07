const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkStock() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: process.env.DB_PORT || 3307
    };

    const connection = await mysql.createConnection(config);

    try {
        const [rows] = await connection.query(
            "SELECT item_code, material_name, material_type, drawing_no, current_balance, warehouse FROM stock_balance WHERE material_name LIKE '%aluminum%' OR material_name LIKE '%tube%' OR item_code LIKE '%aluminum%'"
        );
        console.log(JSON.stringify(rows, null, 2));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkStock();
