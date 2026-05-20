const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function inspect() {
  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USER || 'aluminium_user',
    password: process.env.DB_PASSWORD || 'C0digix$309',
  };

  const connection = await mysql.createConnection(config);
  try {
    const [dbs] = await connection.query('SHOW DATABASES');
    
    for (const dbRow of dbs) {
      const dbName = dbRow.Database || dbRow.database;
      if (['information_schema', 'mysql', 'performance_schema', 'sys'].includes(dbName)) continue;
      
      try {
        await connection.query(`USE \`${dbName}\``);
        const [rows] = await connection.query('SELECT item_code, material_name FROM stock_balance');
        console.log(`--- Items in database: ${dbName} ---`);
        for (const r of rows) {
          if (r.item_code.includes('MSSHEET') || r.material_name.includes('MS Sheet') || r.item_code.includes('LOADER') || r.material_name.includes('loader')) {
            console.log(`FOUND: ${r.item_code} | ${r.material_name}`);
          }
        }
      } catch (e) {
        // console.log(`Could not read database ${dbName}:`, e.message);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}
inspect();
