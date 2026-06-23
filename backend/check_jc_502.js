const pool = require('./src/config/db');

async function check() {
  const [jcRows] = await pool.query("SELECT * FROM job_cards WHERE id = 502");
  console.log("=== Job Card 502 ===");
  console.log(JSON.stringify(jcRows[0], null, 2));

  if (jcRows.length > 0) {
    const workOrderId = jcRows[0].work_order_id;
    const [woRows] = await pool.query("SELECT * FROM work_orders WHERE id = ?", [workOrderId]);
    console.log("\n=== Work Order ===");
    console.log(JSON.stringify(woRows[0], null, 2));
  }

  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
