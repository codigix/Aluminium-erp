const pool = require('./backend/src/config/db');
async function run() {
  try {
    for (const db of ['spTech_dev', 'spTech_prod', 'sales_erp']) {
      console.log(`--- Checking ${db} ---`);
      await pool.query(`USE ${db}`);
      const [rows] = await pool.query('SELECT id, so_number, project_name FROM sales_orders').catch(e => [[], []]);
      console.log(`Count: ${rows.length}`);
      if (rows.length > 0) {
        console.log('Sample IDs:', rows.map(r => r.id).slice(0, 5));
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
