const pool = require('./src/config/db');

async function check() {
  const [so] = await pool.query("SELECT * FROM sales_orders WHERE id = 24");
  console.log("=== Sales Order 24 ===");
  console.table(so);

  const [allSo] = await pool.query("SELECT id, so_number, project_name FROM sales_orders LIMIT 10");
  console.log("\n=== Existing Sales Orders ===");
  console.table(allSo);

  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
