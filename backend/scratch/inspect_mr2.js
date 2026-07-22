const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'e:/codigix-project/Aluminium-erp/backend/.env' });

async function inspectMR2() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp',
        port: parseInt(process.env.DB_PORT) || 3306
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Querying material_request_items for MR-20260722-002...');
        const [items] = await connection.query(
            "SELECT id, mr_id, item_code, item_name, shape_type, length, width, thickness, diameter, outer_diameter, quantity, design_qty, allocated_quantity FROM material_request_items WHERE mr_id = (SELECT id FROM material_requests WHERE mr_number = 'MR-20260722-002')"
        );
        console.log('MR Items:', items);
        
        console.log('Querying stock_balance matching SS304 Seamless Pipe...');
        const [sb] = await connection.query(
            "SELECT sb.item_code, sb.material_name, sb.length, sb.width, sb.thickness, sb.diameter, sb.outer_diameter, sb.current_balance, s.name as shape_name FROM stock_balance sb LEFT JOIN shapes s ON sb.shape_id = s.id WHERE sb.material_name LIKE '%SS304 Seamless Pipe%'"
        );
        console.log('Stock Balance:', sb);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

inspectMR2();
