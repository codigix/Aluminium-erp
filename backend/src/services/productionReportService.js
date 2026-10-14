const pool = require('../config/db');
const { productionError } = require('../config/productionWorkflow');

const round = (value, places = 2) => {
  const factor = Math.pow(10, places);
  return Math.round((parseFloat(value) || 0) * factor) / factor;
};
const pct = (part, whole) => (parseFloat(whole) > 0 ? round((parseFloat(part) / parseFloat(whole)) * 100, 1) : null);

const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Default range: the last 30 days. Dates are inclusive.
const resolveRange = ({ from, to } = {}) => {
  const end = to ? new Date(`${to}T00:00:00`) : new Date();
  const start = from ? new Date(`${from}T00:00:00`) : new Date(end.getTime() - 29 * 86400000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw productionError('Invalid date range', 400);
  if (start > end) throw productionError('"from" must not be after "to"', 400);
  const days = Math.round((end - start) / 86400000) + 1;
  return { from: isoDate(start), to: isoDate(end), days };
};

// Work order -> sales order id, whether the item link or the direct column is set
const WO_SALES_ORDER = 'COALESCE(soi.sales_order_id, wo.sales_order_id)';

// ---------------------------------------------------------------------------
// 1. Summary
// ---------------------------------------------------------------------------
const getSummary = async (filters) => {
  const range = resolveRange(filters);

  const [woStatus] = await pool.query(
    'SELECT status, COUNT(*) AS cnt FROM work_orders GROUP BY status'
  );
  const [jcStatus] = await pool.query(
    "SELECT status, COUNT(*) AS cnt FROM job_cards WHERE is_rework = 0 GROUP BY status"
  );
  const [[delayed]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM work_orders WHERE end_date < CURDATE() AND status NOT IN ('COMPLETED', 'CANCELLED')) AS late_work_orders,
       (SELECT COUNT(*) FROM job_cards WHERE end_time < NOW() AND status NOT IN ('COMPLETED', 'CANCELLED') AND end_time IS NOT NULL) AS late_job_cards,
       (SELECT COUNT(*) FROM job_cards WHERE status = 'ON_HOLD') AS on_hold_job_cards`
  );
  const [[quality]] = await pool.query(
    `SELECT COALESCE(SUM(inspected_qty), 0) AS inspected, COALESCE(SUM(accepted_qty), 0) AS accepted,
            COALESCE(SUM(rejected_qty), 0) AS rejected, COALESCE(SUM(scrap_qty), 0) AS scrap
     FROM job_card_quality_logs WHERE status = 'APPROVED' AND check_date BETWEEN ? AND ?`,
    [range.from, range.to]
  );
  const [[rework]] = await pool.query(
    `SELECT COALESCE(SUM(planned_qty), 0) AS planned, COALESCE(SUM(accepted_qty), 0) AS done,
            COUNT(CASE WHEN status NOT IN ('COMPLETED', 'CANCELLED') THEN 1 END) AS open_cards
     FROM job_cards WHERE is_rework = 1 AND status != 'CANCELLED'`
  );
  const [[shipped]] = await pool.query(
    `SELECT COALESCE(SUM(quantity), 0) AS qty, COUNT(*) AS shipments
     FROM shipment_orders WHERE status NOT IN ('CANCELLED', 'REJECTED') AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)`,
    [range.from, range.to]
  );

  return {
    range,
    workOrders: Object.fromEntries(woStatus.map(r => [r.status, Number(r.cnt)])),
    jobCards: Object.fromEntries(jcStatus.map(r => [r.status, Number(r.cnt)])),
    delayed: {
      workOrders: Number(delayed.late_work_orders),
      jobCards: Number(delayed.late_job_cards),
      onHoldJobCards: Number(delayed.on_hold_job_cards)
    },
    quality: {
      inspected: round(quality.inspected, 3), accepted: round(quality.accepted, 3),
      rejected: round(quality.rejected, 3), scrap: round(quality.scrap, 3),
      yieldPercent: pct(quality.accepted, quality.inspected),
      rejectionPercent: pct(quality.rejected, quality.inspected)
    },
    rework: { plannedQty: round(rework.planned, 3), reworkedQty: round(rework.done, 3), openCards: Number(rework.open_cards) },
    shipments: { count: Number(shipped.shipments), quantity: round(shipped.qty, 3) }
  };
};

// ---------------------------------------------------------------------------
// 2. Plan vs actual, per work order
// ---------------------------------------------------------------------------
const getPlanVsActual = async (filters) => {
  const range = resolveRange(filters);
  const [rows] = await pool.query(
    `SELECT wo.id, wo.wo_number, wo.item_code, wo.item_name, wo.source_type, wo.status, wo.priority,
            wo.quantity AS planned_qty, wo.start_date, wo.end_date, ${WO_SALES_ORDER} AS sales_order_id,
            pp.plan_code,
            (SELECT MIN(jc.actual_start_date) FROM job_cards jc WHERE jc.work_order_id = wo.id) AS actual_start,
            (SELECT MAX(jc.updated_at) FROM job_cards jc WHERE jc.work_order_id = wo.id AND jc.status = 'COMPLETED') AS last_completed_at,
            (SELECT COUNT(*) FROM job_cards jc WHERE jc.work_order_id = wo.id AND jc.status != 'CANCELLED' AND jc.is_rework = 0) AS operations,
            (SELECT COUNT(*) FROM job_cards jc WHERE jc.work_order_id = wo.id AND jc.status = 'COMPLETED' AND jc.is_rework = 0) AS operations_done,
            (SELECT COALESCE(SUM(jc.accepted_qty), 0) FROM job_cards jc
               WHERE jc.work_order_id = wo.id AND jc.status != 'CANCELLED'
                 AND jc.sequence_no = (SELECT MAX(j2.sequence_no) FROM job_cards j2
                                        WHERE j2.work_order_id = wo.id AND j2.is_rework = 0 AND j2.status != 'CANCELLED'
                                          AND LOWER(TRIM(COALESCE(j2.operation_name, ''))) NOT IN ('shipment', 'dispatch'))) AS accepted_qty,
            (SELECT COALESCE(SUM(jc.dispatch_qty), 0) FROM job_cards jc
               WHERE jc.work_order_id = wo.id AND LOWER(TRIM(COALESCE(jc.operation_name, ''))) IN ('shipment', 'dispatch')) AS dispatched_qty
     FROM work_orders wo
     LEFT JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
     LEFT JOIN production_plans pp ON wo.plan_id = pp.id
     WHERE COALESCE(wo.start_date, DATE(wo.created_at)) <= ? AND (wo.end_date IS NULL OR wo.end_date >= ? OR wo.status NOT IN ('COMPLETED', 'CANCELLED'))
     ORDER BY wo.end_date IS NULL, wo.end_date, wo.id`,
    [range.to, range.from]
  );

  const today = new Date();
  return {
    range,
    rows: rows.map(r => {
      const planned = parseFloat(r.planned_qty) || 0;
      const finishedAt = r.status === 'COMPLETED' && r.last_completed_at ? new Date(r.last_completed_at) : null;
      const due = r.end_date ? new Date(r.end_date) : null;
      const reference = finishedAt || today;
      const delayDays = due && reference > due && r.status !== 'CANCELLED' ? Math.ceil((reference - due) / 86400000) : 0;
      return {
        work_order_id: r.id, wo_number: r.wo_number, plan_code: r.plan_code, sales_order_id: r.sales_order_id,
        item_code: r.item_code, item_name: r.item_name, type: r.source_type, status: r.status, priority: r.priority,
        planned_qty: planned, accepted_qty: round(r.accepted_qty, 3), dispatched_qty: round(r.dispatched_qty, 3),
        completion_percent: pct(r.accepted_qty, planned),
        operations: Number(r.operations), operations_done: Number(r.operations_done),
        planned_start: r.start_date, planned_end: r.end_date, actual_start: r.actual_start, completed_at: finishedAt,
        delay_days: delayDays
      };
    })
  };
};

// ---------------------------------------------------------------------------
// 3. Job card status
// ---------------------------------------------------------------------------
const getJobCardStatus = async (filters) => {
  const params = [];
  const clauses = ["jc.status != 'CANCELLED'"];
  if (filters.status) { clauses.push('jc.status = ?'); params.push(String(filters.status).toUpperCase()); }
  if (filters.workOrderId) { clauses.push('jc.work_order_id = ?'); params.push(filters.workOrderId); }
  if (filters.workstationId) { clauses.push('jc.workstation_id = ?'); params.push(filters.workstationId); }

  const [rows] = await pool.query(
    `SELECT jc.id, jc.job_card_no, jc.operation_name, jc.sequence_no, jc.status, jc.is_rework, jc.hold_reason,
            jc.planned_qty, jc.produced_qty, jc.accepted_qty, jc.rejected_qty, jc.scrap_qty, jc.dispatch_qty,
            jc.start_time, jc.end_time, wo.wo_number, wo.item_code, wo.priority,
            w.workstation_name, u.username AS operator_name
     FROM job_cards jc
     JOIN work_orders wo ON jc.work_order_id = wo.id
     LEFT JOIN workstations w ON jc.workstation_id = w.id
     LEFT JOIN users u ON jc.assigned_to = u.id
     WHERE ${clauses.join(' AND ')}
     ORDER BY wo.id DESC, jc.sequence_no, jc.id
     LIMIT 2000`,
    params
  );
  const now = new Date();
  return {
    rows: rows.map(r => ({
      ...r,
      is_rework: Boolean(r.is_rework),
      remaining_qty: round(Math.max(0, (parseFloat(r.planned_qty) || 0) - (parseFloat(r.produced_qty) || 0)), 3),
      progress_percent: pct(r.produced_qty, r.planned_qty),
      overdue: Boolean(r.end_time && new Date(r.end_time) < now && !['COMPLETED', 'CANCELLED'].includes(r.status))
    }))
  };
};

// ---------------------------------------------------------------------------
// 4. Machine and operator utilisation
// ---------------------------------------------------------------------------
const getUtilisation = async (filters) => {
  const range = resolveRange(filters);
  const hoursPerDay = Math.min(24, Math.max(1, parseFloat(filters.hoursPerDay) || 8));
  const workingDays = filters.includeWeekends === 'true' ? range.days : Math.max(1, Math.round(range.days * 6 / 7));

  const [machines] = await pool.query(
    `SELECT w.id, w.workstation_code, w.workstation_name, IFNULL(w.capacity, 1) AS capacity, IFNULL(w.target_utilization, 80) AS target_utilization,
            COALESCE(t.minutes, 0) AS run_minutes, COALESCE(t.produced, 0) AS produced_qty, COALESCE(t.logs, 0) AS log_count,
            COALESCE(d.minutes, 0) AS downtime_minutes
     FROM workstations w
     LEFT JOIN (
       SELECT workstation_id, SUM(TIMESTAMPDIFF(MINUTE, start_time, end_time)) AS minutes, SUM(produced_qty) AS produced, COUNT(*) AS logs
       FROM job_card_time_logs WHERE log_date BETWEEN ? AND ? AND start_time IS NOT NULL AND end_time IS NOT NULL
       GROUP BY workstation_id
     ) t ON t.workstation_id = w.id
     LEFT JOIN (
       SELECT jc.workstation_id, SUM(TIMESTAMPDIFF(MINUTE, dl.start_time, dl.end_time)) AS minutes
       FROM job_card_downtime_logs dl JOIN job_cards jc ON dl.job_card_id = jc.id
       WHERE dl.downtime_date BETWEEN ? AND ? AND dl.start_time IS NOT NULL AND dl.end_time IS NOT NULL
       GROUP BY jc.workstation_id
     ) d ON d.workstation_id = w.id
     WHERE COALESCE(w.status, 'Active') = 'Active'
     ORDER BY w.workstation_name`,
    [range.from, range.to, range.from, range.to]
  );

  const [operators] = await pool.query(
    `SELECT u.id, u.username, SUM(TIMESTAMPDIFF(MINUTE, tl.start_time, tl.end_time)) AS run_minutes,
            SUM(tl.produced_qty) AS produced_qty, COUNT(DISTINCT tl.job_card_id) AS job_cards
     FROM job_card_time_logs tl JOIN users u ON tl.operator_id = u.id
     WHERE tl.log_date BETWEEN ? AND ? AND tl.start_time IS NOT NULL AND tl.end_time IS NOT NULL
     GROUP BY u.id, u.username ORDER BY run_minutes DESC`,
    [range.from, range.to]
  );

  const availablePerUnit = workingDays * hoursPerDay * 60;
  return {
    range, hoursPerDay, workingDays,
    machines: machines.map(m => {
      const available = availablePerUnit * Number(m.capacity);
      const run = Number(m.run_minutes);
      const down = Number(m.downtime_minutes);
      const utilisation = pct(run, available);
      return {
        workstation_id: m.id, code: m.workstation_code, name: m.workstation_name, capacity: Number(m.capacity),
        available_minutes: available, run_minutes: run, downtime_minutes: down,
        idle_minutes: Math.max(0, available - run - down),
        utilisation_percent: utilisation, target_percent: Number(m.target_utilization),
        below_target: utilisation !== null && utilisation < Number(m.target_utilization),
        produced_qty: round(m.produced_qty, 3), log_count: Number(m.log_count)
      };
    }),
    operators: operators.map(o => ({
      user_id: o.id, name: o.username, run_minutes: Number(o.run_minutes),
      utilisation_percent: pct(o.run_minutes, availablePerUnit),
      produced_qty: round(o.produced_qty, 3), job_cards: Number(o.job_cards)
    }))
  };
};

// ---------------------------------------------------------------------------
// 5. Quality, rework and scrap
// ---------------------------------------------------------------------------
const getQualityRework = async (filters) => {
  const range = resolveRange(filters);

  const [byOperation] = await pool.query(
    `SELECT COALESCE(NULLIF(TRIM(jc.operation_name), ''), 'Unnamed') AS operation,
            SUM(ql.inspected_qty) AS inspected, SUM(ql.accepted_qty) AS accepted,
            SUM(ql.rejected_qty) AS rejected, SUM(ql.scrap_qty) AS scrap, COUNT(*) AS inspections
     FROM job_card_quality_logs ql JOIN job_cards jc ON ql.job_card_id = jc.id
     WHERE ql.status = 'APPROVED' AND ql.check_date BETWEEN ? AND ?
     GROUP BY operation ORDER BY rejected DESC`,
    [range.from, range.to]
  );
  const [byMachine] = await pool.query(
    `SELECT COALESCE(w.workstation_name, 'Unassigned') AS workstation,
            SUM(ql.inspected_qty) AS inspected, SUM(ql.rejected_qty) AS rejected, SUM(ql.scrap_qty) AS scrap
     FROM job_card_quality_logs ql JOIN job_cards jc ON ql.job_card_id = jc.id
     LEFT JOIN workstations w ON jc.workstation_id = w.id
     WHERE ql.status = 'APPROVED' AND ql.check_date BETWEEN ? AND ?
     GROUP BY workstation ORDER BY rejected DESC`,
    [range.from, range.to]
  );
  const [reasons] = await pool.query(
    `SELECT COALESCE(NULLIF(TRIM(ql.rejection_reason), ''), 'No reason given') AS reason,
            SUM(ql.rejected_qty) AS rejected, COUNT(*) AS occurrences
     FROM job_card_quality_logs ql
     WHERE ql.status = 'APPROVED' AND ql.rejected_qty > 0 AND ql.check_date BETWEEN ? AND ?
     GROUP BY reason ORDER BY rejected DESC LIMIT 20`,
    [range.from, range.to]
  );
  const [openRework] = await pool.query(
    `SELECT jc.job_card_no, jc.operation_name, jc.planned_qty, jc.produced_qty, jc.accepted_qty, jc.status,
            src.job_card_no AS source_job_card_no, wo.wo_number, wo.item_code
     FROM job_cards jc
     JOIN work_orders wo ON jc.work_order_id = wo.id
     LEFT JOIN job_cards src ON jc.rework_of_job_card_id = src.id
     WHERE jc.is_rework = 1 AND jc.status NOT IN ('COMPLETED', 'CANCELLED')
     ORDER BY jc.id DESC`
  );

  const withRates = r => ({
    ...r,
    inspected: round(r.inspected, 3), accepted: round(r.accepted, 3), rejected: round(r.rejected, 3), scrap: round(r.scrap, 3),
    yield_percent: pct(r.accepted, r.inspected), rejection_percent: pct(r.rejected, r.inspected)
  });
  return { range, byOperation: byOperation.map(withRates), byMachine: byMachine.map(withRates), topReasons: reasons, openRework };
};

// ---------------------------------------------------------------------------
// 6. Material issued vs consumed vs returned, per work order
// ---------------------------------------------------------------------------
const getMaterialVariance = async (filters) => {
  const params = [];
  let woClause = '';
  if (filters.workOrderId) { woClause = 'WHERE wo.id = ?'; params.push(filters.workOrderId); }

  const [rows] = await pool.query(
    `SELECT wo.id AS work_order_id, wo.wo_number, wo.status, m.item_code, m.material_name, m.uom,
            m.issued,
            COALESCE((SELECT SUM(c.quantity) FROM work_order_material_consumption c WHERE c.work_order_id = wo.id AND c.item_code = m.item_code), 0) AS consumed,
            COALESCE((SELECT SUM(r.quantity) FROM work_order_material_returns r WHERE r.work_order_id = wo.id AND r.item_code = m.item_code AND r.return_type != 'SCRAP'), 0) AS returned,
            COALESCE((SELECT SUM(r.quantity) FROM work_order_material_returns r WHERE r.work_order_id = wo.id AND r.item_code = m.item_code AND r.return_type = 'SCRAP'), 0) AS scrapped
     FROM work_orders wo
     JOIN (
       SELECT mi.work_order_id, mii.item_code, MAX(mii.material_name) AS material_name, MAX(mii.uom) AS uom, SUM(mii.quantity) AS issued
       FROM material_issue_items mii JOIN material_issues mi ON mii.issue_id = mi.id
       GROUP BY mi.work_order_id, mii.item_code
     ) m ON m.work_order_id = wo.id
     ${woClause}
     ORDER BY wo.id DESC, m.material_name
     LIMIT 2000`,
    params
  );

  const items = rows.map(r => {
    const issued = parseFloat(r.issued) || 0;
    const consumed = parseFloat(r.consumed) || 0;
    const returned = parseFloat(r.returned) || 0;
    const scrapped = parseFloat(r.scrapped) || 0;
    const onFloor = round(issued - consumed - returned - scrapped, 3);
    return {
      ...r, issued: round(issued, 3), consumed: round(consumed, 3), returned: round(returned, 3), scrapped: round(scrapped, 3),
      on_floor: onFloor,
      usage_percent: pct(consumed, issued),
      // Unaccounted material on a closed work order is a loss that needs explaining
      unaccounted: ['COMPLETED', 'CANCELLED'].includes(r.status) && onFloor > 0.001 ? onFloor : 0
    };
  });
  return { items, totalUnaccounted: round(items.reduce((s, i) => s + i.unaccounted, 0), 3) };
};

// ---------------------------------------------------------------------------
// 7. Shipments: full vs partial per work order
// ---------------------------------------------------------------------------
const getShipmentStatus = async (filters) => {
  const range = resolveRange(filters);
  const [rows] = await pool.query(
    `SELECT wo.id AS work_order_id, wo.wo_number, wo.item_code, wo.item_name, wo.status AS wo_status,
            wo.quantity AS ordered_qty, ${WO_SALES_ORDER} AS sales_order_id,
            COALESCE(sj.dispatched, 0) AS dispatched_qty, sj.job_card_status AS shipment_operation_status,
            COALESCE(so.shipments, 0) AS shipment_count, so.last_shipment_at, so.statuses
     FROM work_orders wo
     LEFT JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
     LEFT JOIN (
       SELECT work_order_id, SUM(dispatch_qty) AS dispatched, MAX(status) AS job_card_status
       FROM job_cards WHERE LOWER(TRIM(COALESCE(operation_name, ''))) IN ('shipment', 'dispatch') GROUP BY work_order_id
     ) sj ON sj.work_order_id = wo.id
     LEFT JOIN (
       SELECT jc.work_order_id, COUNT(*) AS shipments, MAX(s.created_at) AS last_shipment_at, GROUP_CONCAT(DISTINCT s.status) AS statuses
       FROM shipment_orders s JOIN job_cards jc ON s.job_card_id = jc.id
       WHERE s.status NOT IN ('CANCELLED', 'REJECTED') GROUP BY jc.work_order_id
     ) so ON so.work_order_id = wo.id
     WHERE sj.work_order_id IS NOT NULL AND wo.status != 'CANCELLED'
       AND (COALESCE(sj.dispatched, 0) > 0 OR wo.status != 'COMPLETED' OR COALESCE(wo.end_date, CURDATE()) >= ?)
       AND COALESCE(wo.start_date, DATE(wo.created_at)) <= ?
     ORDER BY wo.id DESC`,
    [range.from, range.to]
  );

  const classified = rows.map(r => {
    const ordered = parseFloat(r.ordered_qty) || 0;
    const dispatched = parseFloat(r.dispatched_qty) || 0;
    const state = dispatched <= 0 ? 'NOT_SHIPPED' : dispatched + 0.001 >= ordered ? 'FULL' : 'PARTIAL';
    return {
      ...r, ordered_qty: ordered, dispatched_qty: round(dispatched, 3), balance_qty: round(Math.max(0, ordered - dispatched), 3),
      shipment_state: state, shipped_percent: pct(dispatched, ordered)
    };
  });
  const count = state => classified.filter(r => r.shipment_state === state).length;
  return {
    range,
    totals: { full: count('FULL'), partial: count('PARTIAL'), notShipped: count('NOT_SHIPPED') },
    rows: classified
  };
};

// ---------------------------------------------------------------------------
// 8. Delayed work
// ---------------------------------------------------------------------------
const getDelayed = async () => {
  const [workOrders] = await pool.query(
    `SELECT wo.id, wo.wo_number, wo.item_code, wo.status, wo.priority, wo.quantity, wo.end_date,
            DATEDIFF(CURDATE(), wo.end_date) AS days_late,
            (SELECT COUNT(*) FROM job_cards jc WHERE jc.work_order_id = wo.id AND jc.status NOT IN ('COMPLETED', 'CANCELLED')) AS open_operations,
            (SELECT GROUP_CONCAT(DISTINCT jc.status) FROM job_cards jc WHERE jc.work_order_id = wo.id AND jc.status = 'ON_HOLD') AS held
     FROM work_orders wo
     WHERE wo.end_date < CURDATE() AND wo.status NOT IN ('COMPLETED', 'CANCELLED')
     ORDER BY days_late DESC LIMIT 500`
  );
  const [jobCards] = await pool.query(
    `SELECT jc.id, jc.job_card_no, jc.operation_name, jc.status, jc.end_time, wo.wo_number, wo.priority, w.workstation_name,
            TIMESTAMPDIFF(HOUR, jc.end_time, NOW()) AS hours_late
     FROM job_cards jc JOIN work_orders wo ON jc.work_order_id = wo.id
     LEFT JOIN workstations w ON jc.workstation_id = w.id
     WHERE jc.end_time < NOW() AND jc.status NOT IN ('COMPLETED', 'CANCELLED')
     ORDER BY hours_late DESC LIMIT 500`
  );
  const [onHold] = await pool.query(
    `SELECT jc.id, jc.job_card_no, jc.operation_name, jc.hold_reason, jc.held_at, wo.wo_number,
            pre.job_card_no AS held_by_job_card_no
     FROM job_cards jc JOIN work_orders wo ON jc.work_order_id = wo.id
     LEFT JOIN job_cards pre ON jc.held_by_job_card_id = pre.id
     WHERE jc.status = 'ON_HOLD' ORDER BY jc.held_at`
  );
  return { workOrders, jobCards, onHold };
};

// ---------------------------------------------------------------------------
// Workspace: where every stage of the workflow stands and what needs doing next
// ---------------------------------------------------------------------------
const ACTIVE_PLAN = "pp.status NOT IN ('CANCELLED', 'COMPLETED', 'DELETED')";
const LIVE_MR = "UPPER(COALESCE(mr.status, '')) NOT IN ('CANCELLED', 'REJECTED')";
const RELEASED_MR = "UPPER(COALESCE(mr.status, '')) IN ('FULFILLED', 'COMPLETED')";
const SHIPMENT_OP = "LOWER(TRIM(COALESCE(jc.operation_name, ''))) IN ('shipment', 'dispatch')";
const ACTIVE_WO = "wo.status NOT IN ('DRAFT', 'CANCELLED', 'COMPLETED', 'ON_HOLD')";

const sampleList = (rows, key, max = 3) => {
  const names = rows.map(r => r[key]).filter(Boolean);
  if (names.length === 0) return '';
  return names.slice(0, max).join(', ') + (names.length > max ? ` +${names.length - max} more` : '');
};

const getWorkspace = async () => {
  const count = async (sql) => Number((await pool.query(sql))[0][0].cnt);

  const [plansNoMr] = await pool.query(
    `SELECT pp.id, pp.plan_code FROM production_plans pp
     WHERE ${ACTIVE_PLAN} AND NOT EXISTS (SELECT 1 FROM material_requests mr WHERE mr.plan_id = pp.id AND ${LIVE_MR})
     ORDER BY pp.id DESC LIMIT 50`
  );
  const [plansAwaitingRelease] = await pool.query(
    `SELECT pp.id, pp.plan_code FROM production_plans pp
     WHERE ${ACTIVE_PLAN}
       AND EXISTS (SELECT 1 FROM material_requests mr WHERE mr.plan_id = pp.id AND ${LIVE_MR})
       AND EXISTS (SELECT 1 FROM material_requests mr WHERE mr.plan_id = pp.id AND ${LIVE_MR} AND NOT (${RELEASED_MR}))
     ORDER BY pp.id DESC LIMIT 50`
  );
  const [plansReadyForWo] = await pool.query(
    `SELECT pp.id, pp.plan_code FROM production_plans pp
     WHERE ${ACTIVE_PLAN}
       AND EXISTS (SELECT 1 FROM material_requests mr WHERE mr.plan_id = pp.id AND ${LIVE_MR})
       AND NOT EXISTS (SELECT 1 FROM material_requests mr WHERE mr.plan_id = pp.id AND ${LIVE_MR} AND NOT (${RELEASED_MR}))
       AND NOT EXISTS (SELECT 1 FROM work_orders wo WHERE wo.plan_id = pp.id)
     ORDER BY pp.id DESC LIMIT 50`
  );
  const [unscheduled] = await pool.query(
    `SELECT jc.id, jc.job_card_no FROM job_cards jc JOIN work_orders wo ON jc.work_order_id = wo.id
     WHERE jc.status IN ('PENDING', 'READY') AND (jc.workstation_id IS NULL OR jc.start_time IS NULL)
       AND ${ACTIVE_WO} AND NOT (${SHIPMENT_OP})
       AND LOWER(COALESCE(jc.execution_mode, 'in-house')) NOT LIKE 'outsourc%' AND LOWER(COALESCE(jc.execution_mode, '')) NOT LIKE 'sub%'
     ORDER BY jc.id LIMIT 200`
  );
  const [onHold] = await pool.query(
    "SELECT jc.id, jc.job_card_no FROM job_cards jc WHERE jc.status = 'ON_HOLD' ORDER BY jc.held_at LIMIT 100"
  );
  const [lateWos] = await pool.query(
    `SELECT wo.id, wo.wo_number FROM work_orders wo
     WHERE wo.end_date < CURDATE() AND wo.status NOT IN ('COMPLETED', 'CANCELLED') ORDER BY wo.end_date LIMIT 100`
  );
  const [pendingQuality] = await pool.query(
    `SELECT ql.id, jc.job_card_no FROM job_card_quality_logs ql JOIN job_cards jc ON ql.job_card_id = jc.id
     WHERE ql.status = 'PENDING' AND jc.status != 'CANCELLED' ORDER BY ql.id LIMIT 200`
  );
  const [openRework] = await pool.query(
    "SELECT jc.id, jc.job_card_no FROM job_cards jc WHERE jc.is_rework = 1 AND jc.status NOT IN ('COMPLETED', 'CANCELLED') ORDER BY jc.id LIMIT 100"
  );
  const [shipReady] = await pool.query(
    `SELECT jc.id, wo.wo_number FROM job_cards jc JOIN work_orders wo ON jc.work_order_id = wo.id
     WHERE ${SHIPMENT_OP} AND jc.status NOT IN ('COMPLETED', 'CANCELLED') AND wo.status IN ('RELEASED', 'IN_PROGRESS')
       AND COALESCE(jc.planned_qty, 0) > COALESCE(jc.dispatch_qty, 0)
       AND EXISTS (SELECT 1 FROM job_cards p WHERE p.work_order_id = jc.work_order_id AND p.sequence_no < jc.sequence_no
                   AND p.is_rework = 0 AND COALESCE(p.accepted_qty, 0) > 0)
     ORDER BY jc.id LIMIT 100`
  );

  const draftPlans = await count("SELECT COUNT(*) AS cnt FROM production_plans WHERE status IN ('DRAFT', 'PENDING')");
  const draftWos = await count("SELECT COUNT(*) AS cnt FROM work_orders WHERE status = 'DRAFT'");
  const running = await count("SELECT COUNT(*) AS cnt FROM job_cards WHERE status = 'IN_PROGRESS'");
  const finalQc = await count("SELECT COUNT(*) AS cnt FROM sales_orders WHERE status IN ('PRODUCTION_COMPLETED', 'QC_IN_PROGRESS', 'QC_REJECTED')");

  const steps = [
    { id: 'plan', number: 1, title: 'Plan', module: 'production-plan', count: draftPlans,
      hint: 'Turn approved sales orders into production plans', countLabel: 'draft plans' },
    { id: 'material', number: 2, title: 'Material', module: 'material-requirements', count: plansNoMr.length + plansAwaitingRelease.length,
      hint: 'Request material and get it released from Stores', countLabel: 'plans waiting on material' },
    { id: 'workorders', number: 3, title: 'Work Orders', module: 'work-order', count: plansReadyForWo.length + draftWos,
      hint: 'Create work orders for parts, sub-assemblies and assemblies', countLabel: 'to create or release' },
    { id: 'schedule', number: 4, title: 'Schedule', module: 'job-card', count: unscheduled.length,
      hint: 'Give every operation a machine, operator and time slot', countLabel: 'unscheduled operations' },
    { id: 'shopfloor', number: 5, title: 'Shop Floor', module: 'shop-floor', count: running + onHold.length,
      hint: 'Start jobs, log output, hold or resume work', countLabel: 'running or held' },
    { id: 'quality', number: 6, title: 'Quality & Rework', module: 'job-card', count: pendingQuality.length + openRework.length,
      hint: 'Inspect output, approve results, finish rework', countLabel: 'inspections / rework open' },
    { id: 'shipment', number: 7, title: 'Shipment', module: 'job-card', count: shipReady.length + finalQc,
      hint: 'Ship full or partial quantities, complete final QC', countLabel: 'ready to ship / final QC' }
  ];

  const actions = [];
  const push = (a) => { if (a.count > 0) actions.push(a); };

  push({ id: 'late-wo', severity: 'critical', count: lateWos.length, module: 'production-report', actionLabel: 'See delays',
    title: `${lateWos.length} work order(s) are past their end date`, detail: sampleList(lateWos, 'wo_number') });
  push({ id: 'held', severity: 'warning', count: onHold.length, module: 'shop-floor', actionLabel: 'Review held jobs',
    title: `${onHold.length} job(s) on hold`, detail: `${sampleList(onHold, 'job_card_no')} — resume them when the machine is free` });
  push({ id: 'quality', severity: 'warning', count: pendingQuality.length, module: 'job-card', actionLabel: 'Approve inspections',
    title: `${pendingQuality.length} inspection(s) waiting for QC approval`, detail: sampleList(pendingQuality, 'job_card_no') });
  push({ id: 'rework', severity: 'warning', count: openRework.length, module: 'job-card', actionLabel: 'Open rework',
    title: `${openRework.length} rework job card(s) open`, detail: sampleList(openRework, 'job_card_no') });
  push({ id: 'no-mr', severity: 'action', count: plansNoMr.length, module: 'production-plan', actionLabel: 'Create material request',
    title: `${plansNoMr.length} plan(s) have no material request`, detail: `${sampleList(plansNoMr, 'plan_code')} — production cannot start without material` });
  push({ id: 'release', severity: 'info', count: plansAwaitingRelease.length, module: 'material-requirements', actionLabel: 'Track material',
    title: `${plansAwaitingRelease.length} plan(s) waiting for Stores to release material`, detail: sampleList(plansAwaitingRelease, 'plan_code') });
  push({ id: 'create-wo', severity: 'action', count: plansReadyForWo.length, module: 'production-plan', actionLabel: 'Create work orders',
    title: `${plansReadyForWo.length} plan(s) have material released but no work orders`, detail: sampleList(plansReadyForWo, 'plan_code') });
  push({ id: 'draft-wo', severity: 'action', count: draftWos, module: 'work-order', actionLabel: 'Release work orders',
    title: `${draftWos} work order(s) still in draft`, detail: 'Release them so job cards become active' });
  push({ id: 'unscheduled', severity: 'action', count: unscheduled.length, module: 'job-card', actionLabel: 'Schedule now',
    title: `${unscheduled.length} operation(s) have no machine or time slot`, detail: sampleList(unscheduled, 'job_card_no') });
  push({ id: 'ship', severity: 'action', count: shipReady.length, module: 'job-card', actionLabel: 'Ship goods',
    title: `${shipReady.length} work order(s) have accepted quantity ready to ship`, detail: sampleList(shipReady, 'wo_number') });
  push({ id: 'final-qc', severity: 'info', count: finalQc, module: 'job-card', actionLabel: 'Open final QC',
    title: `${finalQc} sales order(s) in final QC`, detail: 'Production finished — waiting for the final inspection' });

  const order = { critical: 0, warning: 1, action: 2, info: 3 };
  actions.sort((a, b) => order[a.severity] - order[b.severity]);

  return { generatedAt: new Date().toISOString(), steps, actions, totals: { running, onHold: onHold.length, late: lateWos.length } };
};

// Flat rows -> CSV for the "export" button on any tabular report
const toCsv = (rows) => {
  if (!rows || rows.length === 0) return '';
  const columns = Object.keys(rows[0]);
  const cell = value => {
    if (value === null || value === undefined) return '';
    const text = value instanceof Date ? value.toISOString() : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [columns.join(','), ...rows.map(r => columns.map(c => cell(r[c])).join(','))].join('\n');
};

module.exports = {
  getSummary,
  getPlanVsActual,
  getJobCardStatus,
  getUtilisation,
  getQualityRework,
  getMaterialVariance,
  getShipmentStatus,
  getDelayed,
  getWorkspace,
  toCsv,
  _internal: { resolveRange, pct }
};
