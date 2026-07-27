const mysql = require('mysql2/promise');
require('dotenv').config();

async function findUuid() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3307'),
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'spTech_dev'
    };

    const connection = await mysql.createConnection(config);
    const uuid = '5e7ab496-edb0-43c8-98db-3ab30cc79349';

    try {
        const [tables] = await connection.query("SHOW TABLES");
        const tableKey = `Tables_in_${config.database}`;

        for (const tRow of tables) {
            const table = tRow[tableKey];
            const [cols] = await connection.query(`SHOW COLUMNS FROM ${table}`);
            
            for (const col of cols) {
                // If column is varchar or char type, search in it
                if (col.Type.includes('varchar') || col.Type.includes('char')) {
                    const [matches] = await connection.query(
                        `SELECT * FROM ${table} WHERE \`${col.Field}\` = ?`,
                        [uuid]
                    );
                    if (matches.length > 0) {
                        console.log(`Found match in table: ${table}, column: ${col.Field}`);
                        console.log(matches);
                    }
                }
            }
        }
        console.log('Search finished.');
    } catch (error) {
        console.error(error);
    } finally {
        await connection.end();
    }
}

findUuid();
