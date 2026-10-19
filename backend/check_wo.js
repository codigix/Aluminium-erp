const { pool } = require('./src/config/db');

async function check() {
  const p = pool.promise();
  try {
    const [jcs] = await p.query(
      `SELECT id, job_card_no, operation_name, sequence_no, status, planned_qty, produced_qty, accepted_qty, rejected_qty, is_rework, rework_of_job_card_id, remarks 
       FROM job_cards 
       WHERE work_order_id = (SELECT id FROM work_orders WHERE wo_number = 'WO-2026-00003') 
       ORDER BY sequence_no, id`
    );
    console.log('JOB CARDS:', JSON.stringify(jcs, null, 2));

    const [logs] = await p.query(
      `SELECT q.id, q.job_card_id, jc.job_card_no, jc.operation_name, q.inspected_qty, q.accepted_qty, q.rejected_qty, q.scrap_qty, q.status, q.rework_routing_type, q.rework_target_job_card_id 
       FROM job_card_quality_logs q 
       JOIN job_cards jc ON q.job_card_id = jc.id 
       WHERE jc.work_order_id = (SELECT id FROM work_orders WHERE wo_number = 'WO-2026-00003')`
    );
    console.log('QUALITY LOGS:', JSON.stringify(logs, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

check();
