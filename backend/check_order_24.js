const pool = require('./src/config/db');

async function check() {
  const [orders] = await pool.query("SELECT * FROM orders WHERE id = 24");
  console.log("=== Order 24 ===");
  console.table(orders);

  const [allOrders] = await pool.query("SELECT id, order_no, client_id FROM orders LIMIT 10");
  console.log("\n=== Existing Orders ===");
  console.table(allOrders);

  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
