// One-time repair for rework job cards created before the INSERT fix in
// productionFlowService.syncReworkJobCard. That INSERT shifted its values by one column:
//   rework_of_job_card_id <- setup time of the target operation
//   remarks               <- id of the rejected (source) job card
//   setup_time            <- always 0
// It also resets job_cards.rework_qty, which the old upstream rework sync inflated
// for rejections that already have their own rework job card.
//
// Dry run (default, changes nothing):  node scripts/repairReworkLinks.js
// Apply the changes:                   node scripts/repairReworkLinks.js --apply

require('dotenv').config();
const pool = require('../src/config/db');
const { isShipmentOperation, isSubcontractJobCard } = require('../src/config/productionWorkflow');

const APPLY = process.argv.includes('--apply');

const repairLinks = async (connection) => {
  const [cards] = await connection.query(
    `SELECT rw.id, rw.job_card_no, rw.work_order_id, rw.rework_of_job_card_id, rw.remarks, rw.setup_time,
            src.id AS linked_id, src.work_order_id AS linked_wo
     FROM job_cards rw
     LEFT JOIN job_cards src ON src.id = rw.rework_of_job_card_id
     WHERE rw.is_rework = 1`
  );

  const fixes = [];
  for (const card of cards) {
    const linkOk = card.linked_id && card.linked_wo === card.work_order_id;
    if (linkOk) continue;

    const sourceId = /^\d+$/.test(String(card.remarks || '').trim()) ? parseInt(card.remarks, 10) : null;
    if (!sourceId) {
      fixes.push({ card: card.job_card_no, action: 'SKIPPED – source id not recoverable from remarks' });
      continue;
    }
    const [[source]] = await connection.query(
      'SELECT id, job_card_no, work_order_id, operation_name FROM job_cards WHERE id = ?',
      [sourceId]
    );
    if (!source || source.work_order_id !== card.work_order_id) {
      fixes.push({ card: card.job_card_no, action: `SKIPPED – job card ${sourceId} is not in the same work order` });
      continue;
    }

    const remarks = `Rework of ${source.job_card_no} (rejected, not scrapped)`;
    // The shifted value that landed in rework_of_job_card_id was the target operation's setup time
    const setupTime = parseFloat(card.rework_of_job_card_id) || 0;
    fixes.push({
      card: card.job_card_no,
      action: `rework_of ${card.rework_of_job_card_id} -> ${source.id} (${source.job_card_no}), setup_time ${card.setup_time} -> ${setupTime}`
    });
    if (APPLY) {
      await connection.execute(
        'UPDATE job_cards SET rework_of_job_card_id = ?, remarks = ?, setup_time = ? WHERE id = ?',
        [source.id, remarks, setupTime, card.id]
      );
    }
  }
  return fixes;
};

// Same rule as jobCardService.syncReworkQuantities: only rejections without a rework job card
// (subcontract, shipment, or on a rework card) are pushed back onto upstream operations.
const recomputeReworkQty = async (connection) => {
  const [workOrders] = await connection.query(
    'SELECT DISTINCT work_order_id FROM job_cards WHERE COALESCE(rework_qty, 0) > 0 OR COALESCE(rejected_qty, 0) > 0'
  );
  const changes = [];
  for (const { work_order_id: woId } of workOrders) {
    const [jobCards] = await connection.query(
      `SELECT id, job_card_no, rework_qty, rejected_qty, scrap_qty, is_rework, operation_name, execution_mode, execution_type
       FROM job_cards WHERE work_order_id = ? ORDER BY sequence_no ASC, id ASC`,
      [woId]
    );
    const getsReworkCard = jc => !jc.is_rework && !isShipmentOperation(jc.operation_name) && !isSubcontractJobCard(jc);
    const generated = jobCards.map(jc => (getsReworkCard(jc) ? 0 : Math.max(0, (parseFloat(jc.rejected_qty) || 0) - (parseFloat(jc.scrap_qty) || 0))));

    for (let i = 0; i < jobCards.length; i++) {
      let qty = 0;
      for (let j = i + 1; j < jobCards.length; j++) qty += generated[j];
      if (i === 0) qty += generated[0];
      const current = parseFloat(jobCards[i].rework_qty) || 0;
      if (Math.abs(current - qty) > 0.0005) {
        changes.push({ card: jobCards[i].job_card_no, action: `rework_qty ${current} -> ${qty}` });
        if (APPLY) await connection.execute('UPDATE job_cards SET rework_qty = ? WHERE id = ?', [qty, jobCards[i].id]);
      }
    }
  }
  return changes;
};

(async () => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const linkFixes = await repairLinks(connection);
    const qtyFixes = await recomputeReworkQty(connection);

    console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN (no changes written)'}`);
    console.log('\nRework card links:');
    console.table(linkFixes.length ? linkFixes : [{ card: '-', action: 'nothing to fix' }]);
    console.log('Upstream rework_qty:');
    console.table(qtyFixes.length ? qtyFixes : [{ card: '-', action: 'nothing to fix' }]);

    if (APPLY) {
      await connection.commit();
      console.log('Changes committed.');
    } else {
      await connection.rollback();
      console.log('Run again with --apply to write these changes.');
    }
    process.exit(0);
  } catch (err) {
    await connection.rollback();
    console.error('Repair failed, nothing changed:', err.message);
    process.exit(1);
  } finally {
    connection.release();
  }
})();
