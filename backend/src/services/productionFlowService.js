const { logProductionEvent } = require('./productionAuditService');
const { productionError, isShipmentOperation, isSubcontractJobCard } = require('../config/productionWorkflow');

const num = v => {
  const n = parseFloat(v);
  return Number.isNaN(n) ? 0 : n;
};

// ---------------------------------------------------------------------------
// Dependencies: a sub-assembly / part work order feeds an assembly work order.
// Work orders with no row here are independent and can run in parallel.
// ---------------------------------------------------------------------------

// Idempotent: derives dependency rows from parent_wo_id for one plan (or all plans)
const syncDependencies = async (connection, planId = null) => {
  const where = planId ? 'AND child.plan_id = ?' : '';
  const params = planId ? [planId] : [];
  const [result] = await connection.query(
    `INSERT INTO work_order_dependencies (predecessor_wo_id, successor_wo_id, qty_per_unit)
     SELECT child.id, parent.id, CASE WHEN parent.quantity > 0 THEN child.quantity / parent.quantity ELSE 1 END
     FROM work_orders child
     JOIN work_orders parent ON child.parent_wo_id = parent.id
     WHERE child.parent_wo_id IS NOT NULL ${where}
     ON DUPLICATE KEY UPDATE qty_per_unit = VALUES(qty_per_unit)`,
    params
  );
  return result.affectedRows;
};

// Pieces an operation has handed on: approved output of that step plus any rework done on it.
const stepOutput = async (connection, workOrderId, sequenceNo) => {
  const [rows] = await connection.query(
    `SELECT status, is_rework, planned_qty, accepted_qty, transferred_qty
     FROM job_cards WHERE work_order_id = ? AND sequence_no = ? AND status != 'CANCELLED'`,
    [workOrderId, sequenceNo]
  );
  if (rows.length === 0) return 0;

  const normal = rows.filter(r => !r.is_rework);
  const accepted = rows.reduce((sum, r) => sum + num(r.accepted_qty), 0);
  const transferred = normal.reduce((sum, r) => sum + num(r.transferred_qty), 0);
  let output = Math.max(accepted, transferred);

  // Older completed operations never recorded accepted quantity: trust their planned quantity
  const allDone = rows.every(r => r.status === 'COMPLETED');
  if (allDone && output === 0) output = normal.reduce((sum, r) => sum + num(r.planned_qty), 0);
  return output;
};

const lastProducingSequence = async (connection, workOrderId) => {
  const [rows] = await connection.query(
    `SELECT sequence_no, operation_name FROM job_cards
     WHERE work_order_id = ? AND is_rework = 0 AND status != 'CANCELLED'
     ORDER BY sequence_no DESC`,
    [workOrderId]
  );
  const last = rows.find(r => !isShipmentOperation(r.operation_name));
  return last ? last.sequence_no : null;
};

// Assemblies that can be started now, given what each component work order has delivered
const getDependencyLimit = async (connection, workOrderId) => {
  const [deps] = await connection.query(
    `SELECT d.predecessor_wo_id, d.qty_per_unit, wo.wo_number, wo.item_code
     FROM work_order_dependencies d JOIN work_orders wo ON d.predecessor_wo_id = wo.id
     WHERE d.successor_wo_id = ? AND wo.status != 'CANCELLED'`,
    [workOrderId]
  );
  if (deps.length === 0) return { dependent: false, limit: null, components: [] };

  let limit = Infinity;
  const components = [];
  for (const dep of deps) {
    const seq = await lastProducingSequence(connection, dep.predecessor_wo_id);
    const delivered = seq === null ? 0 : await stepOutput(connection, dep.predecessor_wo_id, seq);
    const perUnit = num(dep.qty_per_unit) || 1;
    const buildable = delivered / perUnit;
    limit = Math.min(limit, buildable);
    components.push({ workOrderId: dep.predecessor_wo_id, woNumber: dep.wo_number, itemCode: dep.item_code, delivered, perUnit, buildable });
  }
  return { dependent: true, limit: Number.isFinite(limit) ? limit : 0, components };
};

// How many pieces this job card may work on / ship right now (partial-release aware)
const getOperationAvailability = async (connection, jobCardId) => {
  const [rows] = await connection.query(
    `SELECT jc.id, jc.work_order_id, jc.sequence_no, jc.operation_name, jc.is_rework, jc.planned_qty,
            jc.produced_qty, jc.dispatch_qty, wo.quantity AS wo_quantity
     FROM job_cards jc JOIN work_orders wo ON jc.work_order_id = wo.id WHERE jc.id = ?`,
    [jobCardId]
  );
  if (rows.length === 0) throw productionError('Job Card not found', 404);
  const jc = rows[0];
  const isShipment = isShipmentOperation(jc.operation_name);

  if (jc.is_rework) {
    // Rework is bounded by the quantity that was rejected into it
    const planned = num(jc.planned_qty);
    return { available: planned, used: num(jc.produced_qty), remaining: Math.max(0, planned - num(jc.produced_qty)), basis: 'REWORK', components: [] };
  }

  const [[prev]] = await connection.query(
    `SELECT MAX(sequence_no) AS seq FROM job_cards
     WHERE work_order_id = ? AND sequence_no < ? AND is_rework = 0 AND status != 'CANCELLED'`,
    [jc.work_order_id, jc.sequence_no]
  );

  let available;
  let basis;
  let components = [];
  if (prev && prev.seq !== null) {
    available = await stepOutput(connection, jc.work_order_id, prev.seq);
    basis = 'PREVIOUS_OPERATION';
  } else {
    available = num(jc.wo_quantity);
    basis = 'WORK_ORDER_QTY';
    const dependency = await getDependencyLimit(connection, jc.work_order_id);
    if (dependency.dependent) {
      available = Math.min(available, dependency.limit);
      basis = 'COMPONENTS';
      components = dependency.components;
    }
  }

  const used = isShipment ? num(jc.dispatch_qty) : num(jc.produced_qty);
  return { available, used, remaining: Math.max(0, available - used), basis, components };
};

// ---------------------------------------------------------------------------
// Rework: approved rejections that are not scrap become a rework job card.
// ---------------------------------------------------------------------------

const syncReworkJobCard = async (connection, sourceJobCardId, userId = null) => {
  const [[source]] = await connection.query(
    `SELECT jc.*, wo.status AS wo_status FROM job_cards jc JOIN work_orders wo ON jc.work_order_id = wo.id WHERE jc.id = ?`,
    [sourceJobCardId]
  );
  if (!source || source.is_rework || isShipmentOperation(source.operation_name) || isSubcontractJobCard(source)) return null;
  if (['CANCELLED', 'COMPLETED'].includes(source.wo_status)) return null;

  const [[approved]] = await connection.query(
    `SELECT COALESCE(SUM(GREATEST(rejected_qty - scrap_qty, 0)), 0) AS reworkable,
            SUBSTRING_INDEX(GROUP_CONCAT(rework_routing_type ORDER BY id DESC), ',', 1) AS rework_routing_type,
            SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(rework_target_job_card_id, '') ORDER BY id DESC), ',', 1) AS rework_target_job_card_id
     FROM job_card_quality_logs WHERE job_card_id = ? AND status = 'APPROVED'`,
    [sourceJobCardId]
  );
  const [existing] = await connection.query(
    "SELECT id, status, planned_qty, produced_qty FROM job_cards WHERE rework_of_job_card_id = ? AND status != 'CANCELLED' ORDER BY id",
    [sourceJobCardId]
  );

  const targetQty = num(approved.reworkable);
  const covered = existing.reduce((sum, r) => sum + num(r.planned_qty), 0);
  const delta = targetQty - covered;
  if (Math.abs(delta) < 0.001) return null;

  // Determine target operation for rework (First Op by default, Same Op, or Custom Target Op).
  // Business rule: a rejected piece is reworked at the first operation of the routing only;
  // later operations are not repeated automatically (they only get capacity for it).
  let target = source;
  const routingType = approved.rework_routing_type || 'FIRST_OPERATION';
  const targetJcId = approved.rework_target_job_card_id ? parseInt(approved.rework_target_job_card_id, 10) : null;

  if (targetJcId) {
    const [[customTarget]] = await connection.query(
      'SELECT * FROM job_cards WHERE id = ? AND work_order_id = ? AND status != "CANCELLED"',
      [targetJcId, source.work_order_id]
    );
    if (customTarget) target = customTarget;
  } else if (routingType === 'FIRST_OPERATION') {
    const [[firstOp]] = await connection.query(
      `SELECT * FROM job_cards
       WHERE work_order_id = ? AND is_rework = 0 AND status != 'CANCELLED'
       ORDER BY sequence_no ASC, id ASC LIMIT 1`,
      [source.work_order_id]
    );
    if (firstOp) target = firstOp;
  }

  const isSameOp = target.id === source.id;
  const reworkOpName = isSameOp 
    ? `Rework: ${source.operation_name || 'Operation'}` 
    : `Rework: ${target.operation_name || 'Operation'} (for ${source.operation_name || 'Op'})`;
  const reworkRemarks = isSameOp 
    ? `Rework of ${source.job_card_no} (rejected, not scrapped)` 
    : `Rework of ${source.job_card_no} (rejected at ${source.operation_name || 'Op'}, routed to ${target.operation_name})`;

  const openCard = existing.find(r => r.status === 'PENDING' && num(r.produced_qty) === 0);

  if (delta > 0) {
    if (openCard) {
      await connection.execute(
        `UPDATE job_cards SET
           planned_qty = planned_qty + ?,
           operation_id = ?,
           workstation_id = ?,
           operation_name = ?,
           sequence_no = ?,
           cycle_time = ?,
           std_time = ?,
           time_uom = ?,
           hourly_rate = ?,
           remarks = ?
         WHERE id = ?`,
        [
          delta,
          target.operation_id,
          target.workstation_id,
          reworkOpName,
          target.sequence_no,
          target.cycle_time,
          target.std_time,
          target.time_uom,
          target.hourly_rate,
          reworkRemarks,
          openCard.id
        ]
      );
      return openCard.id;
    }
    const { nextDocumentNumber } = require('../utils/documentNumber');
    const jobCardNo = await nextDocumentNumber(connection, 'JOB_CARD');
    const [result] = await connection.execute(
      `INSERT INTO job_cards
       (job_card_no, work_order_id, operation_id, workstation_id, planned_qty, status, std_time, time_uom, hourly_rate,
        operation_name, execution_type, execution_mode, sequence_no, cycle_time, setup_time, is_rework, rework_of_job_card_id, remarks)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        jobCardNo, source.work_order_id, target.operation_id, target.workstation_id, delta,
        target.std_time, target.time_uom, target.hourly_rate, reworkOpName,
        target.execution_type, target.execution_mode, target.sequence_no, target.cycle_time, target.setup_time,
        source.id, reworkRemarks
      ]
    );
    await logProductionEvent(connection, {
      entityType: 'JOB_CARD', entityId: result.insertId, action: 'REWORK_CREATED',
      newValue: `${delta} pcs from ${source.job_card_no} to ${target.operation_name}`, userId
    });
    return result.insertId;
  }

  // Rejection was reduced or reclassified as scrap: shrink an untouched rework card
  if (openCard) {
    const reduced = num(openCard.planned_qty) + delta;
    if (reduced <= 0) {
      await connection.execute("UPDATE job_cards SET status = 'CANCELLED', planned_qty = 0 WHERE id = ?", [openCard.id]);
    } else {
      await connection.execute('UPDATE job_cards SET planned_qty = ? WHERE id = ?', [reduced, openCard.id]);
    }
  }
  return openCard ? openCard.id : null;
};

module.exports = {
  syncDependencies,
  stepOutput,
  getDependencyLimit,
  getOperationAvailability,
  syncReworkJobCard
};
