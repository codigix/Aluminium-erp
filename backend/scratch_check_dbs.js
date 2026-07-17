const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function checkDatabases() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        port: parseInt(process.env.DB_PORT || '3307')
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Fetching databases list...');
        const [dbs] = await connection.query('SHOW DATABASES');
        console.log('Databases:', dbs.map(d => d.Database));

        for (const dbName of ['spTech_dev', 'spTech_prod', 'pTech_prod']) {
            if (dbs.find(d => d.Database === dbName)) {
                console.log(`\n--- Tables in ${dbName} ---`);
                await connection.query(`USE \`${dbName}\``);
                const [tables] = await connection.query('SHOW TABLES');
                const key = `Tables_in_${dbName}`;
                console.log(tables.map(t => t[key]));
            } else {
                console.log(`\nDatabase ${dbName} does not exist.`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkDatabases();
