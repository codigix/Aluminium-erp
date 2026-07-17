const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function showCreateTables() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        port: parseInt(process.env.DB_PORT || '3307')
    };

    const connection = await mysql.createConnection(config);

    try {
        const targets = [
            { table: 'orders', dbs: ['spTech_dev', 'spTech_prod'] },
            { table: 'procurement_rfq_items', dbs: ['spTech_dev', 'spTech_prod'] },
            { table: 'procurement_rfqs', dbs: ['spTech_dev', 'spTech_prod'] },
            { table: 'procurement_rfq_vendor_assignments', dbs: ['spTech_prod'] }
        ];

        for (const target of targets) {
            console.log(`\n==================== TABLE: ${target.table} ====================`);
            for (const db of target.dbs) {
                try {
                    await connection.query(`USE \`${db}\``);
                    const [res] = await connection.query(`SHOW CREATE TABLE \`${target.table}\``);
                    console.log(`\n--- DB: ${db} ---`);
                    console.log(res[0]['Create Table']);
                } catch (e) {
                    console.log(`\n--- DB: ${db} ---`);
                    console.log(`Error: ${e.message}`);
                }
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

showCreateTables();
