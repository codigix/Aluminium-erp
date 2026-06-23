const pool = require('./src/config/db');
const { getJobCardById } = require('./src/services/jobCardService');

async function check() {
  const [woRows] = await pool.query("SELECT * FROM work_orders WHERE wo_number = 'WO-00017-209'");
  if (woRows.length === 0) {
    console.error("WO-00017-209 not found");
    process.exit(1);
  }
  const wo = woRows[0];
  console.log("=== Parent Work Order ===");
  console.log("ID:", wo.id);
  console.log("WO Number:", wo.wo_number);
  console.log("Item Code:", wo.item_code);
  console.log("Quantity:", wo.quantity);
  console.log("Plan ID:", wo.plan_id);

  const [childWos] = await pool.query(
    "SELECT id, wo_number, item_code, item_name, quantity, status FROM work_orders WHERE plan_id = ? AND (parent_wo_id = ? OR source_fg = ?) AND id != ?",
    [wo.plan_id, wo.id, wo.item_code, wo.id]
  );
  console.log("\n=== Child Work Orders under the plan/parent ===");
  console.table(childWos);

  for (const childWo of childWos) {
    const [finalJc] = await pool.query(
      'SELECT id, job_card_no, status, COALESCE(transferred_qty, 0) as transferred_qty FROM job_cards WHERE work_order_id = ? ORDER BY sequence_no DESC, id DESC LIMIT 1',
      [childWo.id]
    );
    console.log(`\n=== Last Job Card for child ${childWo.wo_number} (${childWo.item_name}) ===`);
    console.table(finalJc);
  }

  const [parentJcRows] = await pool.query("SELECT id FROM job_cards WHERE work_order_id = ?", [wo.id]);
  const parentJcId = parentJcRows[0]?.id;
  if (parentJcId) {
    const details = await getJobCardById(parentJcId);
    console.log("\n=== getJobCardById details ===");
    console.log("assembly_available_qty:", details.assembly_available_qty);
    console.log("is_assembly_waiting:", details.is_assembly_waiting);
    console.log("child_parts:", JSON.stringify(details.child_parts, null, 2));
  }

  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
