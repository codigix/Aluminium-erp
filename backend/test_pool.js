const pool = require('./src/config/db');

async function testPool() {
  try {
    const connection = await pool.getConnection();
    console.log('Successfully obtained connection from pool!');
    
    const [dbResult] = await connection.query('SELECT DATABASE() as db');
    console.log('Pool is connected to database:', dbResult[0].db);

    const [rows] = await connection.query('SELECT item_code, material_name FROM stock_balance LIMIT 5');
    console.log('Sample stock_balance items:', rows);
    
    connection.release();
  } catch (err) {
    console.error('Pool connection failed:', err);
  } finally {
    process.exit(0);
  }
}

testPool();
