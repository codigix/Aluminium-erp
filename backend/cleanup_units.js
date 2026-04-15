const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function cleanup() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3307),
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);
    try {
        console.log('Starting unit cleanup...');
        
        // Fix job cards where std_time > 5 and unit is 'Hr' (likely minutes)
        // Especially targeting 'Cutting' which was specifically mentioned
        const [result] = await connection.query(`
            UPDATE job_cards jc
            LEFT JOIN operations o ON jc.operation_id = o.id
            SET jc.time_uom = 'Min'
            WHERE (jc.time_uom = 'Hr' OR jc.time_uom IS NULL)
            AND (jc.std_time >= 5 OR o.operation_name LIKE '%Cutting%')
        `);
        
        console.log(`Updated ${result.affectedRows} job cards to 'Min' unit.`);
        
        // Also ensure any NULL time_uom are set to 'Min' as default
        const [result2] = await connection.query(`
            UPDATE job_cards SET time_uom = 'Min' WHERE time_uom IS NULL
        `);
        console.log(`Updated ${result2.affectedRows} NULL units to 'Min'.`);

    } catch (error) {
        console.error('Cleanup failed:', error);
    } finally {
        await connection.end();
    }
}

cleanup();
