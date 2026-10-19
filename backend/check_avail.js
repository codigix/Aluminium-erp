const { pool } = require('./src/config/db');
const pfs = require('./src/services/productionFlowService');

async function test() {
  const p = pool.promise();
  const conn = await p.getConnection();
  try {
    const [[jc]] = await conn.query('SELECT * FROM job_cards WHERE id = 9037');
    console.log('Target JC (QC Inspection):', jc.job_card_no, jc.sequence_no);
    const avail = await pfs.getOperationAvailability(conn, 9037);
    console.log('QC INSPECTION AVAILABILITY:', avail);
    const so = await pfs.stepOutput(conn, jc.work_order_id, 2);
    console.log('STEP OUTPUT OF SEQ 2:', so);
  } catch (err) {
    console.error(err);
  } finally {
    conn.release();
    process.exit();
  }
}

test();
