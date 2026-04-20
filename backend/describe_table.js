const mysql = require('mysql2/promise');

async function runQuery(sql, params = []) {
  try {
    const conn = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3307,
      user: 'aluminium_user',
      password: 'C0digix$309',
      database: 'sales_erp'
    });
    
    console.log(`--- Running Query: ${sql} ---`);
    const [rows] = await conn.query(sql, params);
    console.table(rows);
    
    await conn.end();
  } catch (err) {
    console.error(err);
  }
}

const table = process.argv[2];
if (table && table.includes(' ')) {
    runQuery(table);
} else {
    runQuery(`DESCRIBE ${table || 'production_plan_operations'}`);
}

