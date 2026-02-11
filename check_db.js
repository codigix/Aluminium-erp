const mysql = require('mysql2/promise');

async function checkStockEntries() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'backend', // Updated with correct password from db.js
    database: 'sales_erp'
  });

  try {
    const [rows] = await connection.execute('SELECT * FROM stock_entries ORDER BY created_at DESC LIMIT 5');
    console.log('Last 5 Stock Entries:');
    console.table(rows);
    
    const [counts] = await connection.execute('SELECT COUNT(*) as total FROM stock_entries');
    console.log('Total Stock Entries:', counts[0].total);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await connection.end();
  }
}

checkStockEntries();
