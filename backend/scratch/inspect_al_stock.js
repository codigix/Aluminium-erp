const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'e:/codigix-project/Aluminium-erp/backend/.env' });

async function inspectAlStock() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp',
        port: parseInt(process.env.DB_PORT) || 3306
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Querying stock_balance matching ALIUMNINUM PLATE...');
        const [sb] = await connection.query(
            "SELECT sb.item_code, sb.material_name, sb.length, sb.width, sb.thickness, sb.diameter, sb.outer_diameter, sb.current_balance, s.name as shape_name FROM stock_balance sb LEFT JOIN shapes s ON sb.shape_id = s.id WHERE sb.material_name LIKE '%ALIUMNINUM PLATE%'"
        );
        console.log('Stock Balance:', sb);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

inspectAlStock();
