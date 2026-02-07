const mysql = require('mysql2/promise');
const tableName = process.argv[2];

if (!tableName) {
  console.error('Please provide a table name');
  process.exit(1);
}

async function describeTable() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'aluminium_user',
    password: 'C0digix$309',
    database: 'sales_erp'
  });

  try {
    const [rows] = await connection.query(`DESCRIBE ${tableName}`);
    console.table(rows);
  } catch (error) {
    console.error(error);
  } finally {
    await connection.end();
  }
}

describeTable();
