const mysql = require('mysql2/promise');
(async () => {
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'aluminium_user',
      password: 'aluminium_password',
      database: 'sales_erp',
      port: 3307
    });
    const [rows] = await conn.query('DESCRIBE sales_order_item_materials');
    console.log('Materials Columns:', rows.map(r => r.Field));
    const [crows] = await conn.query('DESCRIBE sales_order_item_components');
    console.log('Components Columns:', crows.map(r => r.Field));
    await conn.end();
  } catch (err) {
    console.error(err);
  }
})();
