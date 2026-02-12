const pool = require('./backend/src/config/db');

async function checkItems() {
  try {
    const mrId = 22;
    const [items] = await pool.query('SELECT item_code, item_type FROM material_request_items WHERE mr_id = ?', [mrId]);
    console.log(items);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkItems();
