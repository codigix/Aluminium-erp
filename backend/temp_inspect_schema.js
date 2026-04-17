const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

(async () => {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });
    const [dbResult] = await conn.query('SELECT DATABASE() as db');
    console.log(`Connected to database: ${dbResult[0].db}`);

    const [crows] = await conn.query('DESCRIBE sales_order_item_components');
    console.log('--- sales_order_item_components columns ---');
    crows.forEach(r => console.log(`${r.Field} (${r.Type})` ));
    
    const [srows] = await conn.query('DESCRIBE sales_order_item_scrap');
    console.log('\n--- sales_order_item_scrap columns ---');
    srows.forEach(r => console.log(`${r.Field} (${r.Type})` ));

    const [qirows] = await conn.query('DESCRIBE quotation_items');
    console.log('\n--- quotation_items columns ---');
    qirows.forEach(r => console.log(`${r.Field} (${r.Type})` ));

    const [qrows] = await conn.query('DESCRIBE quotation_requests');
    console.log('\n--- quotation_requests columns ---');
    qrows.forEach(r => console.log(`${r.Field} (${r.Type})` ));

    const [mrows] = await conn.query('DESCRIBE sales_order_item_materials');
    console.log('\n--- sales_order_item_materials columns ---');
    mrows.forEach(r => console.log(`${r.Field} (${r.Type})` ));

  } catch (err) {
    console.error(err);
  } finally {
    if (conn) await conn.end();
  }
})();
