const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkItems() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        const [rows] = await connection.query('SELECT id, item_code, material_name, material_type FROM stock_balance');
        console.log('Stock Balance items:');
        console.log(JSON.stringify(rows, null, 2));
        
        const [groups] = await connection.query('SELECT * FROM item_groups');
        console.log('\nItem Groups:');
        console.log(JSON.stringify(groups, null, 2));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkItems();
