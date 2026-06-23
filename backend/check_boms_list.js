const pool = require('./src/config/db');

async function check() {
  const [boms] = await pool.query("SELECT * FROM bom LIMIT 10");
  console.log("=== BOMs ===");
  console.table(boms);

  const [planSub] = await pool.query("SELECT * FROM production_plan_sub_assemblies WHERE plan_id = 47");
  console.log("\n=== Plan 47 Sub-assemblies ===");
  console.table(planSub);

  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
