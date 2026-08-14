const pool = require('../src/config/db');

async function main() {
  try {
    const [payments] = await pool.query('SELECT * FROM payments');
    console.log('Payments rows count:', payments.length);
    console.log('Payments rows:', payments);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

main();
