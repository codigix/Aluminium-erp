const mysql = require('mysql2');
require('dotenv').config({ path: './.env' });

async function checkDuplicates() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: process.env.DB_PORT || 3307
    };

    const connection = await mysql.createConnection(config);
    const promiseConn = connection.promise();

    try {
        console.log('Checking for job card JC-0012-605...');
        const [rows] = await promiseConn.query(
            'SELECT * FROM job_cards WHERE job_card_no = ?',
            ['JC-0012-605']
        );
        console.log('Found JCs:', rows);

        if (rows.length > 0) {
            const woId = rows[0].work_order_id;
            const [wo] = await promiseConn.query('SELECT * FROM work_orders WHERE id = ?', [woId]);
            console.log('Work Order for this JC:', wo);
        }

        console.log('\nChecking for any duplicate job_card_no...');
        const [duplicates] = await promiseConn.query(
            'SELECT job_card_no, COUNT(*) as count FROM job_cards GROUP BY job_card_no HAVING count > 1'
        );
        console.log('Duplicates:', duplicates);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkDuplicates();
