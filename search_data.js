const pool = require('./backend/src/config/db');

async function searchAbhijit() {
  try {
    const [tables] = await pool.query('SHOW TABLES');
    for (const row of tables) {
      const tableName = Object.values(row)[0];
      try {
        const [columns] = await pool.query(`SHOW COLUMNS FROM ${tableName}`);
        const textCols = columns.filter(c => c.Type.includes('char') || c.Type.includes('text')).map(c => c.Field);
        if (textCols.length > 0) {
          const whereClause = textCols.map(c => `\`${c}\` LIKE '%abhijit%'`).join(' OR ');
          const [results] = await pool.query(`SELECT * FROM ${tableName} WHERE ${whereClause}`);
          if (results.length > 0) {
            console.log(`Found 'abhijit' in table: ${tableName}`);
            console.log(results);
          }
        }
      } catch (err) {
        // Skip tables with issues
      }
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

searchAbhijit();
