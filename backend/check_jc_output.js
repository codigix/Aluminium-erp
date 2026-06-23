const { listJobCards } = require('./src/services/jobCardService');

async function check() {
  const list = await listJobCards();
  const jc = list.find(j => j.job_card_no === 'JC-0036-117');
  if (!jc) {
    console.error("JC-0036-117 not found");
  } else {
    console.log("=== JC-0036-117 Output ===");
    console.log("planned_qty:", jc.planned_qty);
    console.log("status:", jc.status);
    console.log("assembly_available_qty:", jc.assembly_available_qty);
    console.log("is_assembly_waiting:", jc.is_assembly_waiting);
    console.log("is_first_op:", jc.is_first_op);
    console.log("child_parts:", JSON.stringify(jc.child_parts, null, 2));
  }
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
