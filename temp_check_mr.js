const pool = require('./backend/src/config/db');
async function run() {
  try {
    const [mr] = await pool.query('SELECT * FROM material_requests WHERE id = 20');
    console.log('Material Request:', JSON.stringify(mr[0], null, 2));
    const [items] = await pool.query('SELECT * FROM material_request_items WHERE mr_id = 20');
    console.log('MR Items:', JSON.stringify(items, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
