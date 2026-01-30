const mysql = require('mysql2/promise');

(async () => {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'aluminium_user',
    password: 'C0digix$309',
    database: 'sales_erp'
  });
  
  try {
    const [rows] = await connection.query("SELECT * FROM quotation_requests LIMIT 5");
    console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
    process.exit(0);
  }
})();
