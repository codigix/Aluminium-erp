const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function compareSchemas() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        port: parseInt(process.env.DB_PORT || '3307')
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Comparing spTech_prod (source/prod) vs spTech_dev (target/dev)...');
        
        // Get tables for both
        const [prodTablesRes] = await connection.query(`SHOW TABLES FROM spTech_prod`);
        const prodTables = prodTablesRes.map(r => Object.values(r)[0]);

        const [devTablesRes] = await connection.query(`SHOW TABLES FROM spTech_dev`);
        const devTables = devTablesRes.map(r => Object.values(r)[0]);

        const missingTablesInDev = prodTables.filter(t => !devTables.includes(t));
        const extraTablesInDev = devTables.filter(t => !prodTables.includes(t));

        if (missingTablesInDev.length > 0) {
            console.log('\n[MISSING TABLES IN DEV]:');
            console.log(missingTablesInDev);
        }

        if (extraTablesInDev.length > 0) {
            console.log('\n[EXTRA TABLES IN DEV (exist in dev but not prod)] :');
            console.log(extraTablesInDev);
        }

        // Compare columns for common tables
        const commonTables = prodTables.filter(t => devTables.includes(t));
        const columnDiffs = [];
        const indexDiffs = [];

        for (const table of commonTables) {
            // Get columns for prod
            const [prodCols] = await connection.query(`
                SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = 'spTech_prod' AND TABLE_NAME = ?
                ORDER BY COLUMN_NAME
            `, [table]);

            // Get columns for dev
            const [devCols] = await connection.query(`
                SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = 'spTech_dev' AND TABLE_NAME = ?
                ORDER BY COLUMN_NAME
            `, [table]);

            const prodColMap = new Map(prodCols.map(c => [c.COLUMN_NAME, c]));
            const devColMap = new Map(devCols.map(c => [c.COLUMN_NAME, c]));

            // Check missing columns in dev
            for (const colName of prodColMap.keys()) {
                if (!devColMap.has(colName)) {
                    columnDiffs.push({
                        table,
                        column: colName,
                        type: 'MISSING_IN_DEV',
                        prodSpec: prodColMap.get(colName)
                    });
                }
            }

            // Check extra columns in dev
            for (const colName of devColMap.keys()) {
                if (!prodColMap.has(colName)) {
                    columnDiffs.push({
                        table,
                        column: colName,
                        type: 'EXTRA_IN_DEV',
                        devSpec: devColMap.get(colName)
                    });
                }
            }

            // Check modified columns (common names but different specifications)
            for (const colName of prodColMap.keys()) {
                if (devColMap.has(colName)) {
                    const prodSpec = prodColMap.get(colName);
                    const devSpec = devColMap.get(colName);

                    const typeDiff = prodSpec.COLUMN_TYPE !== devSpec.COLUMN_TYPE;
                    const nullDiff = prodSpec.IS_NULLABLE !== devSpec.IS_NULLABLE;
                    const defaultDiff = prodSpec.COLUMN_DEFAULT !== devSpec.COLUMN_DEFAULT;
                    const extraDiff = prodSpec.EXTRA !== devSpec.EXTRA;

                    if (typeDiff || nullDiff || defaultDiff || extraDiff) {
                        columnDiffs.push({
                            table,
                            column: colName,
                            type: 'DIFFERENT_SPEC',
                            prodSpec,
                            devSpec
                        });
                    }
                }
            }
        }

        if (columnDiffs.length > 0) {
            console.log('\n[COLUMN DIFFERENCES]:');
            console.log(JSON.stringify(columnDiffs, null, 2));
        } else {
            console.log('\nNo column differences found in common tables.');
        }

    } catch (error) {
        console.error('Error comparing databases:', error);
    } finally {
        await connection.end();
    }
}

compareSchemas();
