const pool = require('./src/config/db');

async function describeTable(tableName) {
  try {
    const [rows] = await pool.query(`DESCRIBE ${tableName}`);
    console.table(rows);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

const table = process.argv[2];
if (!table) {
  console.error('Please provide a table name');
  process.exit(1);
}

describeTable(table);
