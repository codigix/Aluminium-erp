const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });

  try {
    const [dbs] = await conn.query('SHOW DATABASES');
    console.log('All databases on MySQL server:', dbs.map(d => d.Database));

    for (const db of dbs.map(d => d.Database)) {
      if (['information_schema', 'mysql', 'performance_schema', 'sys'].includes(db)) continue;
      const connDb = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: db
      });

      try {
        const [tables] = await connDb.query('SHOW TABLES');
        const tableNames = tables.map(r => Object.values(r)[0]);
        if (tableNames.includes('stock_balance')) {
          const [[{ count }]] = await connDb.query('SELECT COUNT(*) as count FROM stock_balance');
          const [matches] = await connDb.query("SELECT item_code, material_name FROM stock_balance WHERE item_code LIKE '%043%' OR material_name LIKE '%sanika%'");
          console.log(`Database: ${db} - stock_balance count: ${count}, matches:`, matches);
        }
      } catch (e) {
        console.error(`Error checking DB ${db}:`, e.message);
      } finally {
        await connDb.end();
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await conn.end();
  }
}
run();
