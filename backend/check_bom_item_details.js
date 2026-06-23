const pool = require('./src/config/db');

async function check() {
  const [bom] = await pool.query("SELECT * FROM bom WHERE id = 600 OR item_code = 'KLLL345'");
  console.log("=== BOM ===");
  console.table(bom);

  if (bom.length > 0) {
    const [bomItems] = await pool.query("SELECT * FROM bom_items WHERE bom_id = ?", [bom[0].id]);
    console.log("\n=== BOM Items ===");
    console.table(bomItems);
  }

  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
