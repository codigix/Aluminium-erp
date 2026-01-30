const mysql = require('mysql2/promise');

async function describeTable() {
  const tableName = process.argv[2] || 'sales_orders';
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'aluminium_user',
    password: 'C0digix$309',
    database: 'sales_erp',
    port: 3307
  });

  try {
    const [rows] = await connection.query(`SHOW FULL COLUMNS FROM ${tableName}`);
    console.log(`Columns for ${tableName}:`);
    console.log(rows.map(r => r.Field));
    console.table(rows);
  } catch (error) {
    console.error(error);
  } finally {
    await connection.end();
  }
}

describeTable();
