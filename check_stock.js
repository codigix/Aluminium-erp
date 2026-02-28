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
        const itemCodes = ['CON-INDUSTRIAL-0001', 'MRO-MRO-0001', 'BOU-PREMOLDEDP-0001', 'RM-STAINLESSS-0002', 'CON-WELDINGROD-0002', 'RM-POWDERCOAT-0001'];
        const [rows] = await connection.query(
            'SELECT item_code, material_name, current_balance, warehouse FROM stock_balance WHERE item_code IN (?)',
            [itemCodes]
        );
        console.log(JSON.stringify(rows, null, 2));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkStock();
