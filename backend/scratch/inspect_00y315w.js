const pool = require('../src/config/db');

async function test() {
  try {
    const [wos] = await pool.query("SELECT id, wo_number, plan_id, item_code, item_name, bom_no, source_type, source_fg FROM work_orders ORDER BY id DESC LIMIT 15");
    console.log('work_orders:', JSON.stringify(wos, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

test();
