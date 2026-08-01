const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function findMissingInProd() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        port: parseInt(process.env.DB_PORT || '3307')
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Comparing spTech_dev (DEV) vs spTech_prod (PROD)...');
        console.log('Finding: columns/tables that exist in DEV but are MISSING in PROD\n');

        const [prodTablesRes] = await connection.query(`SHOW TABLES FROM spTech_prod`);
        const prodTables = prodTablesRes.map(r => Object.values(r)[0]);

        const [devTablesRes] = await connection.query(`SHOW TABLES FROM spTech_dev`);
        const devTables = devTablesRes.map(r => Object.values(r)[0]);

        // Tables missing in prod
        const missingTablesInProd = devTables.filter(t => !prodTables.includes(t));
        // Tables extra in prod (not in dev)
        const extraTablesInProd = prodTables.filter(t => !devTables.includes(t));

        console.log('=== TABLE COMPARISON ===');
        console.log('Total tables in spTech_prod:', prodTables.length);
        console.log('Total tables in spTech_dev:', devTables.length);

        if (missingTablesInProd.length > 0) {
            console.log('\n[TABLES MISSING IN PROD (exist in DEV but NOT in PROD)]:');
            missingTablesInProd.forEach(t => console.log('  - ' + t));
        } else {
            console.log('\n✅ No missing tables in PROD.');
        }

        if (extraTablesInProd.length > 0) {
            console.log('\n[TABLES EXTRA IN PROD (exist in PROD but NOT in DEV)]:');
            extraTablesInProd.forEach(t => console.log('  - ' + t));
        }

        // Compare columns for common tables
        const commonTables = devTables.filter(t => prodTables.includes(t));
        const missingColumnsInProd = [];
        const extraColumnsInProd = [];
        const differentSpecs = [];

        for (const table of commonTables) {
            const [prodCols] = await connection.query(`
                SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = 'spTech_prod' AND TABLE_NAME = ?
                ORDER BY ORDINAL_POSITION
            `, [table]);

            const [devCols] = await connection.query(`
                SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = 'spTech_dev' AND TABLE_NAME = ?
                ORDER BY ORDINAL_POSITION
            `, [table]);

            const prodColNames = new Set(prodCols.map(c => c.COLUMN_NAME));
            const devColNames = new Set(devCols.map(c => c.COLUMN_NAME));
            const prodColMap = new Map(prodCols.map(c => [c.COLUMN_NAME, c]));
            const devColMap = new Map(devCols.map(c => [c.COLUMN_NAME, c]));

            // Columns in DEV but missing in PROD
            for (const colName of devColNames) {
                if (!prodColNames.has(colName)) {
                    const devSpec = devColMap.get(colName);
                    missingColumnsInProd.push({
                        table,
                        column: colName,
                        devType: devSpec.COLUMN_TYPE,
                        devNullable: devSpec.IS_NULLABLE,
                        devDefault: devSpec.COLUMN_DEFAULT,
                        devExtra: devSpec.EXTRA
                    });
                }
            }

            // Columns in PROD but missing in DEV
            for (const colName of prodColNames) {
                if (!devColNames.has(colName)) {
                    const prodSpec = prodColMap.get(colName);
                    extraColumnsInProd.push({
                        table,
                        column: colName,
                        prodType: prodSpec.COLUMN_TYPE,
                    });
                }
            }

            // Different specs for common columns
            for (const colName of devColNames) {
                if (prodColNames.has(colName)) {
                    const prodSpec = prodColMap.get(colName);
                    const devSpec = devColMap.get(colName);
                    if (prodSpec.COLUMN_TYPE !== devSpec.COLUMN_TYPE) {
                        differentSpecs.push({
                            table,
                            column: colName,
                            prodType: prodSpec.COLUMN_TYPE,
                            devType: devSpec.COLUMN_TYPE
                        });
                    }
                }
            }
        }

        console.log('\n=== COLUMN COMPARISON ===');

        if (missingColumnsInProd.length > 0) {
            console.log('\n🔴 COLUMNS MISSING IN PROD (exist in DEV but NOT in PROD):');
            console.log('   These columns need to be added to production!\n');
            
            // Group by table
            const grouped = {};
            missingColumnsInProd.forEach(item => {
                if (!grouped[item.table]) grouped[item.table] = [];
                grouped[item.table].push(item);
            });

            for (const [table, cols] of Object.entries(grouped)) {
                console.log(`  Table: ${table}`);
                cols.forEach(c => {
                    const defaultStr = c.devDefault !== null ? ` DEFAULT '${c.devDefault}'` : '';
                    const nullStr = c.devNullable === 'YES' ? ' NULL' : ' NOT NULL';
                    const extraStr = c.devExtra ? ' ' + c.devExtra.toUpperCase() : '';
                    console.log(`    + ${c.column}  [${c.devType}${nullStr}${defaultStr}${extraStr}]`);
                });
                console.log('');
            }

            console.log('\n--- SQL STATEMENTS TO RUN ON PRODUCTION ---\n');
            const grouped2 = {};
            missingColumnsInProd.forEach(item => {
                if (!grouped2[item.table]) grouped2[item.table] = [];
                grouped2[item.table].push(item);
            });
            for (const [table, cols] of Object.entries(grouped2)) {
                cols.forEach(c => {
                    const nullStr = c.devNullable === 'YES' ? 'NULL' : 'NOT NULL';
                    const defaultStr = c.devDefault !== null ? ` DEFAULT '${c.devDefault}'` : '';
                    const extraStr = c.devExtra ? ' ' + c.devExtra.toUpperCase() : '';
                    console.log(`ALTER TABLE \`${table}\` ADD COLUMN \`${c.column}\` ${c.devType} ${nullStr}${defaultStr}${extraStr};`);
                });
            }
        } else {
            console.log('\n✅ No columns missing in PROD — all DEV columns are present.');
        }

        if (extraColumnsInProd.length > 0) {
            console.log('\n🟡 COLUMNS EXTRA IN PROD (exist in PROD but NOT in DEV):');
            const grouped = {};
            extraColumnsInProd.forEach(item => {
                if (!grouped[item.table]) grouped[item.table] = [];
                grouped[item.table].push(item);
            });
            for (const [table, cols] of Object.entries(grouped)) {
                console.log(`  Table: ${table}`);
                cols.forEach(c => console.log(`    - ${c.column}  [${c.prodType}]`));
            }
        }

        if (differentSpecs.length > 0) {
            console.log('\n🟠 COLUMNS WITH DIFFERENT TYPE (same name, different type):');
            differentSpecs.forEach(d => {
                console.log(`  ${d.table}.${d.column}: PROD=${d.prodType} | DEV=${d.devType}`);
            });
        }

        if (missingColumnsInProd.length === 0 && extraColumnsInProd.length === 0 && differentSpecs.length === 0) {
            console.log('\n✅ All schemas match perfectly!');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

findMissingInProd();
