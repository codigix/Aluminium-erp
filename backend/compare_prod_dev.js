const mysql = require('mysql2/promise');

async function main() {
  const config = {
    host: '127.0.0.1',
    user: 'aluminium_user',
    password: 'C0digix$309',
    port: 3307
  };

  const connection = await mysql.createConnection(config);

  try {
    // Get all tables in dev
    const [tablesDevRows] = await connection.query("SHOW TABLES FROM spTech_dev");
    const tablesDev = tablesDevRows.map(row => Object.values(row)[0]);

    // Get all tables in prod
    const [tablesProdRows] = await connection.query("SHOW TABLES FROM spTech_prod");
    const tablesProd = tablesProdRows.map(row => Object.values(row)[0]);

    console.log(`spTech_dev has ${tablesDev.length} tables.`);
    console.log(`spTech_prod has ${tablesProd.length} tables.`);

    console.log("=== MISSING TABLES IN spTech_prod ===");
    const missingTablesInProd = tablesDev.filter(t => !tablesProd.includes(t));
    console.log(JSON.stringify(missingTablesInProd, null, 2));

    console.log("=== EXTRA TABLES IN spTech_prod (not in dev) ===");
    const extraTablesInProd = tablesProd.filter(t => !tablesDev.includes(t));
    console.log(JSON.stringify(extraTablesInProd, null, 2));

    console.log("\n=== MISSING COLUMNS IN spTech_prod ===");
    const commonTables = tablesDev.filter(t => tablesProd.includes(t));

    for (const table of commonTables) {
      const [colsDevRows] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'spTech_dev' AND TABLE_NAME = ?
      `, [table]);
      const colsDev = colsDevRows.map(row => row.COLUMN_NAME);

      const [colsProdRows] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'spTech_prod' AND TABLE_NAME = ?
      `, [table]);
      const colsProd = colsProdRows.map(row => row.COLUMN_NAME);

      const missingCols = colsDev.filter(c => !colsProd.includes(c));

      if (missingCols.length > 0) {
        console.log(`Table: ${table}`);
        console.log(`  Missing columns:`, JSON.stringify(missingCols));
      }
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await connection.end();
  }
}

main();
