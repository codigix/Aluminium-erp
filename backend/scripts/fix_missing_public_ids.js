const pool = require('../src/config/db');
const crypto = require('crypto');

async function fix() {
  try {
    const tables = ['sales_orders', 'customer_drawings', 'quotation_requests'];
    
    for (const table of tables) {
      const [rows] = await pool.query(`SELECT id FROM ${table} WHERE public_id IS NULL`);
      console.log(`Found ${rows.length} rows missing public_id in ${table}`);
      
      for (const row of rows) {
        const publicId = crypto.randomUUID();
        await pool.query(`UPDATE ${table} SET public_id = ? WHERE id = ?`, [publicId, row.id]);
      }
      console.log(`Finished fixing missing public_ids in ${table}`);
    }
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

fix();
