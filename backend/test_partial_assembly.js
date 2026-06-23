const mysql = require('mysql2/promise');
require('dotenv').config();
const { listJobCards, getJobCardById } = require('./src/services/jobCardService');
const pool = require('./src/config/db');

async function test() {
  console.log("Starting Partial Assembly Logic integration tests...");

  // Clean up any stale test records first
  await pool.query("DELETE FROM job_cards WHERE job_card_no LIKE 'TEST-%'");
  await pool.query("DELETE FROM work_orders WHERE wo_number LIKE 'TEST-%'");

  // Step 1: Create parent work order & job card
  const [parentWoResult] = await pool.query(
    `INSERT INTO work_orders (wo_number, plan_id, quantity, item_code, item_name, source_type, status)
     VALUES ('TEST-PARENT-WO', 999999, 2, 'TEST-ASM-FG', 'TEST-ASM-FG', 'FG', 'RELEASED')`
  );
  const parentWoId = parentWoResult.insertId;

  const [parentJcResult] = await pool.query(
    `INSERT INTO job_cards (job_card_no, work_order_id, planned_qty, status, sequence_no, operation_name)
     VALUES ('TEST-PARENT-JC', ?, 2, 'PENDING', 1, 'ASSEMBLY')`,
    [parentWoId]
  );
  const parentJcId = parentJcResult.insertId;

  // Step 2: Create child work orders & job cards
  const [childWo1Result] = await pool.query(
    `INSERT INTO work_orders (wo_number, plan_id, parent_wo_id, quantity, item_code, item_name, source_type, status)
     VALUES ('TEST-CHILD-1', 999999, ?, 2, 'TEST-PART-1', 'TEST-PART-1', 'SA', 'RELEASED')`,
    [parentWoId]
  );
  const childWo1Id = childWo1Result.insertId;
  await pool.query(
    `INSERT INTO job_cards (job_card_no, work_order_id, planned_qty, transferred_qty, status, sequence_no)
     VALUES ('TEST-CHILD-JC-1', ?, 2, 2, 'COMPLETED', 1)`,
    [childWo1Id]
  );

  const [childWo2Result] = await pool.query(
    `INSERT INTO work_orders (wo_number, plan_id, parent_wo_id, quantity, item_code, item_name, source_type, status)
     VALUES ('TEST-CHILD-2', 999999, ?, 2, 'TEST-PART-2', 'TEST-PART-2', 'SA', 'RELEASED')`,
    [parentWoId]
  );
  const childWo2Id = childWo2Result.insertId;
  await pool.query(
    `INSERT INTO job_cards (job_card_no, work_order_id, planned_qty, transferred_qty, status, sequence_no)
     VALUES ('TEST-CHILD-JC-2', ?, 2, 2, 'COMPLETED', 1)`,
    [childWo2Id]
  );

  const [childWo3Result] = await pool.query(
    `INSERT INTO work_orders (wo_number, plan_id, parent_wo_id, quantity, item_code, item_name, source_type, status)
     VALUES ('TEST-CHILD-3', 999999, ?, 2, 'TEST-PART-4', 'TEST-PART-4', 'SA', 'RELEASED')`,
    [parentWoId]
  );
  const childWo3Id = childWo3Result.insertId;
  const [childJc3Result] = await pool.query(
    `INSERT INTO job_cards (job_card_no, work_order_id, planned_qty, transferred_qty, status, sequence_no)
     VALUES ('TEST-CHILD-JC-3', ?, 2, 1, 'COMPLETED', 1)`,
    [childWo3Id]
  );
  const childJc3Id = childJc3Result.insertId;

  console.log("Test setup complete. Parent JC ID:", parentJcId);

  try {
    // ----------------------------------------------------
    // CASE 1: Partial component available (PART 4 = 1/2)
    // ----------------------------------------------------
    console.log("\n=== Testing CASE 1: Partial component available ===");
    
    // Test listJobCards
    const jobCardsList = await listJobCards();
    const parentJcList = jobCardsList.find(jc => jc.id === parentJcId);
    
    if (!parentJcList) {
      throw new Error("Parent Job Card not found in listJobCards output!");
    }

    console.log("listJobCards results for Case 1:");
    console.log(" - assembly_available_qty:", parentJcList.assembly_available_qty);
    console.log(" - is_assembly_waiting:", parentJcList.is_assembly_waiting);

    if (parseFloat(parentJcList.assembly_available_qty) !== 1) {
      throw new Error(`Expected assembly_available_qty to be 1, got ${parentJcList.assembly_available_qty}`);
    }
    if (parentJcList.is_assembly_waiting !== false && parentJcList.is_assembly_waiting !== 0) {
      throw new Error(`Expected is_assembly_waiting to be false/0, got ${parentJcList.is_assembly_waiting}`);
    }
    console.log("✅ listJobCards Case 1 passed!");

    // Test getJobCardById
    const parentJcDetail = await getJobCardById(parentJcId);
    console.log("getJobCardById results for Case 1:");
    console.log(" - assembly_available_qty:", parentJcDetail.assembly_available_qty);
    console.log(" - is_assembly_waiting:", parentJcDetail.is_assembly_waiting);

    if (parseFloat(parentJcDetail.assembly_available_qty) !== 1) {
      throw new Error(`Expected assembly_available_qty to be 1, got ${parentJcDetail.assembly_available_qty}`);
    }
    if (parentJcDetail.is_assembly_waiting !== false && parentJcDetail.is_assembly_waiting !== 0) {
      throw new Error(`Expected is_assembly_waiting to be false/0, got ${parentJcDetail.is_assembly_waiting}`);
    }
    console.log("✅ getJobCardById Case 1 passed!");


    // ----------------------------------------------------
    // CASE 2: One component missing completely (PART 4 = 0/2)
    // ----------------------------------------------------
    console.log("\n=== Testing CASE 2: One component missing completely ===");
    
    // Update PART 4 to 0 available
    await pool.query("UPDATE job_cards SET transferred_qty = 0 WHERE id = ?", [childJc3Id]);

    // Test listJobCards
    const jobCardsList2 = await listJobCards();
    const parentJcList2 = jobCardsList2.find(jc => jc.id === parentJcId);

    console.log("listJobCards results for Case 2:");
    console.log(" - assembly_available_qty:", parentJcList2.assembly_available_qty);
    console.log(" - is_assembly_waiting:", parentJcList2.is_assembly_waiting);

    if (parseFloat(parentJcList2.assembly_available_qty) !== 0) {
      throw new Error(`Expected assembly_available_qty to be 0, got ${parentJcList2.assembly_available_qty}`);
    }
    if (!parentJcList2.is_assembly_waiting) {
      throw new Error(`Expected is_assembly_waiting to be true/1, got ${parentJcList2.is_assembly_waiting}`);
    }
    console.log("✅ listJobCards Case 2 passed!");

    // Test getJobCardById
    const parentJcDetail2 = await getJobCardById(parentJcId);
    console.log("getJobCardById results for Case 2:");
    console.log(" - assembly_available_qty:", parentJcDetail2.assembly_available_qty);
    console.log(" - is_assembly_waiting:", parentJcDetail2.is_assembly_waiting);

    if (parseFloat(parentJcDetail2.assembly_available_qty) !== 0) {
      throw new Error(`Expected assembly_available_qty to be 0, got ${parentJcDetail2.assembly_available_qty}`);
    }
    if (!parentJcDetail2.is_assembly_waiting) {
      throw new Error(`Expected is_assembly_waiting to be true/1, got ${parentJcDetail2.is_assembly_waiting}`);
    }
    console.log("✅ getJobCardById Case 2 passed!");

    console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉");

  } finally {
    // Clean up
    console.log("Cleaning up test records...");
    await pool.query("DELETE FROM job_cards WHERE job_card_no LIKE 'TEST-%'");
    await pool.query("DELETE FROM work_orders WHERE wo_number LIKE 'TEST-%'");
    await pool.end();
  }
}

test().catch(err => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
