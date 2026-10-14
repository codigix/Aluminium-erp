const pool = require('../config/db');
const { logProductionEvent } = require('./productionAuditService');
const { productionError, JOB_CARD_CLOSED, isSubcontractJobCard } = require('../config/productionWorkflow');

const PRIORITY_RANK = { LOW: 0, NORMAL: 1, HIGH: 2, URGENT: 3 };
const priorityRank = p => PRIORITY_RANK[String(p || 'NORMAL').toUpperCase()] ?? 1;

// Cards in these states occupy their machine / operator slot
const BOOKING_STATUSES = ['DRAFT', 'PENDING', 'READY', 'IN_PROGRESS', 'PAUSED'];
const HOLDABLE_STATUSES = ['PENDING', 'READY', 'IN_PROGRESS', 'PAUSED'];
const DEFAULT_DURATION_MIN = 60;
const MAX_SLOT_SEARCH_STEPS = 200;

const pad = n => String(n).padStart(2, '0');
const toSql = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const toDate = v => {
  if (v instanceof Date) return v;
  const d = new Date(String(v).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
};
const addMinutes = (d, mins) => new Date(d.getTime() + mins * 60000);

// Minutes needed for the remaining quantity: setup + cycle time per piece
const estimateDurationMin = jc => {
  const remaining = Math.max(0, parseFloat(jc.planned_qty || 0) - parseFloat(jc.produced_qty || 0));
  const cycle = parseFloat(jc.cycle_time || 0);
  const setup = parseFloat(jc.setup_time || 0);
  const estimate = setup + cycle * remaining;
  return estimate > 0 ? Math.ceil(estimate) : DEFAULT_DURATION_MIN;
};

const loadJobCard = async (connection, id, lock = false) => {
  const [rows] = await connection.query(
    `SELECT jc.*, wo.priority AS wo_priority, wo.status AS wo_status, wo.wo_number
     FROM job_cards jc JOIN work_orders wo ON jc.work_order_id = wo.id
     WHERE jc.id = ? ${lock ? 'FOR UPDATE' : ''}`,
    [id]
  );
  if (rows.length === 0) throw productionError('Job Card not found', 404);
  return rows[0];
};

// Booked intervals on a resource (machine or operator), excluding one card.
const loadBookings = async (connection, { workstationId, operatorId }, excludeId) => {
  const clauses = [];
  const params = [];
  if (workstationId) { clauses.push('jc.workstation_id = ?'); params.push(workstationId); }
  if (operatorId) { clauses.push('jc.assigned_to = ?'); params.push(operatorId); }
  if (clauses.length === 0) return [];

  const [rows] = await connection.query(
    `SELECT jc.id, jc.job_card_no, jc.operation_name, jc.status, jc.workstation_id, jc.assigned_to,
            jc.start_time, jc.end_time, jc.execution_mode, jc.execution_type, wo.priority AS wo_priority
     FROM job_cards jc JOIN work_orders wo ON jc.work_order_id = wo.id
     WHERE (${clauses.join(' OR ')})
       AND jc.status IN (${BOOKING_STATUSES.map(() => '?').join(',')})
       AND jc.start_time IS NOT NULL AND jc.end_time IS NOT NULL
       AND jc.id != ?`,
    [...params, ...BOOKING_STATUSES, excludeId || 0]
  );
  return rows
    .filter(r => !isSubcontractJobCard(r))
    .map(r => ({ ...r, start: toDate(r.start_time), end: toDate(r.end_time) }))
    .filter(r => r.start && r.end);
};

const overlaps = (aStart, aEnd, b) => aStart < b.end && aEnd > b.start;

// Which bookings clash with [start, end) on the machine (up to its capacity) or the operator
const findConflicts = (bookings, { workstationId, operatorId, capacity }, start, end) => {
  const machine = workstationId
    ? bookings.filter(b => b.workstation_id === Number(workstationId) && overlaps(start, end, b))
    : [];
  const operator = operatorId
    ? bookings.filter(b => b.assigned_to === Number(operatorId) && overlaps(start, end, b))
    : [];
  return {
    machine: machine.length >= capacity ? machine : [],
    machineAll: machine,
    operator
  };
};

// Earliest start >= `from` where both machine and operator are free for the duration
const findNextFreeSlot = (bookings, resource, from, durationMin) => {
  let start = from;
  for (let step = 0; step < MAX_SLOT_SEARCH_STEPS; step++) {
    const end = addMinutes(start, durationMin);
    const conflicts = findConflicts(bookings, resource, start, end);
    const blocking = [...conflicts.machine, ...conflicts.operator];
    if (blocking.length === 0) return { start, end };
    start = new Date(Math.min(...blocking.map(b => b.end.getTime())));
  }
  return null;
};

const suggestSlots = (bookings, resource, from, durationMin, count = 3) => {
  const slots = [];
  let cursor = from;
  for (let i = 0; i < count; i++) {
    const slot = findNextFreeSlot(bookings, resource, cursor, durationMin);
    if (!slot) break;
    slots.push({ start: toSql(slot.start), end: toSql(slot.end) });
    cursor = slot.end;
  }
  return slots;
};

// An operation cannot be scheduled to start before the previous operation of the same work order ends
const earliestAllowedStart = async (connection, jc) => {
  const [rows] = await connection.query(
    `SELECT MAX(end_time) AS prev_end FROM job_cards
     WHERE work_order_id = ? AND sequence_no < ? AND status != 'CANCELLED' AND end_time IS NOT NULL`,
    [jc.work_order_id, jc.sequence_no || 0]
  );
  return rows[0]?.prev_end ? toDate(rows[0].prev_end) : null;
};

const resolveRequest = async (connection, jc, input) => {
  const workstationId = input.workstationId ? Number(input.workstationId) : jc.workstation_id;
  const operatorId = input.assignedTo || input.operatorId ? Number(input.assignedTo || input.operatorId) : jc.assigned_to;
  if (!workstationId) throw productionError('Select a workstation to check availability', 400);

  let capacity = 1;
  const [[ws]] = await connection.query(
    "SELECT IFNULL(capacity, 1) AS capacity, status, workstation_name FROM workstations WHERE id = ?",
    [workstationId]
  );
  if (!ws) throw productionError('Workstation not found', 404);
  if (String(ws.status || 'Active').toLowerCase() !== 'active') {
    throw productionError(`Workstation "${ws.workstation_name}" is ${ws.status} and cannot be scheduled`);
  }
  capacity = Math.max(1, Number(ws.capacity) || 1);

  const durationMin = Math.max(1, parseInt(input.durationMin, 10) || estimateDurationMin(jc));
  const requestedStart = input.start ? toDate(input.start) : new Date();
  if (!requestedStart) throw productionError('Invalid start date/time', 400);

  const prevEnd = await earliestAllowedStart(connection, jc);
  const start = prevEnd && prevEnd > requestedStart ? prevEnd : requestedStart;

  return { resource: { workstationId, operatorId, capacity }, durationMin, start, shiftedForSequence: start !== requestedStart, workstationName: ws.workstation_name };
};

const describeConflict = b => ({
  jobCardId: b.id, jobCardNo: b.job_card_no, operation: b.operation_name, status: b.status,
  priority: b.wo_priority, start: toSql(b.start), end: toSql(b.end)
});

// Read-only availability check with suggestions
const checkAvailability = async (jobCardId, input) => {
  const connection = await pool.getConnection();
  try {
    const jc = await loadJobCard(connection, jobCardId);
    if (JOB_CARD_CLOSED.includes(jc.status)) throw productionError(`Job Card is ${jc.status}`);
    const req = await resolveRequest(connection, jc, input);
    const end = addMinutes(req.start, req.durationMin);
    const bookings = await loadBookings(connection, req.resource, jc.id);
    const conflicts = findConflicts(bookings, req.resource, req.start, end);
    const available = conflicts.machine.length === 0 && conflicts.operator.length === 0;

    return {
      available,
      start: toSql(req.start),
      end: toSql(end),
      durationMin: req.durationMin,
      shiftedForSequence: req.shiftedForSequence,
      priority: jc.wo_priority,
      conflicts: {
        machine: conflicts.machine.map(describeConflict),
        operator: conflicts.operator.map(describeConflict)
      },
      canPreempt: !available && conflicts.operator.length === 0 && conflicts.machine.length > 0 &&
        conflicts.machine.every(b => priorityRank(b.wo_priority) < priorityRank(jc.wo_priority)),
      suggestions: available ? [] : suggestSlots(bookings, req.resource, req.start, req.durationMin)
    };
  } finally {
    connection.release();
  }
};

const holdWithin = async (connection, held, { heldBy, reason, userId }) => {
  await connection.execute(
    `UPDATE job_cards SET status = 'ON_HOLD', status_before_hold = ?, held_by_job_card_id = ?, held_at = NOW(), hold_reason = ? WHERE id = ?`,
    [held.status, heldBy || null, reason ? String(reason).slice(0, 500) : null, held.id]
  );
  await logProductionEvent(connection, {
    entityType: 'JOB_CARD', entityId: held.id, action: 'HOLD',
    oldValue: held.status, newValue: 'ON_HOLD', reason, userId
  });
};

// Book a slot. If the machine is busy: reject with suggestions, or (preempt=true) hold lower-priority jobs.
const scheduleJobCard = async (jobCardId, input, userId = null) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const jc = await loadJobCard(connection, jobCardId, true);
    if (JOB_CARD_CLOSED.includes(jc.status)) throw productionError(`Job Card is ${jc.status} and cannot be scheduled`);
    if (jc.status === 'ON_HOLD') throw productionError('Job Card is ON_HOLD; resume it before scheduling');
    if (['CANCELLED', 'ON_HOLD', 'COMPLETED'].includes(jc.wo_status)) {
      throw productionError(`Work Order ${jc.wo_number} is ${jc.wo_status}; its job cards cannot be scheduled`);
    }
    if (isSubcontractJobCard(jc)) throw productionError('Subcontracted operations are scheduled through the vendor challan, not a machine');

    const req = await resolveRequest(connection, jc, input);

    // Serialise all bookings on this machine so two planners cannot take the same slot
    await connection.query('SELECT id FROM workstations WHERE id = ? FOR UPDATE', [req.resource.workstationId]);

    const end = addMinutes(req.start, req.durationMin);
    const bookings = await loadBookings(connection, req.resource, jc.id);
    const conflicts = findConflicts(bookings, req.resource, req.start, end);
    const preempted = [];

    if (conflicts.machine.length > 0 || conflicts.operator.length > 0) {
      const myRank = priorityRank(jc.wo_priority);
      const canPreempt = input.preempt && conflicts.operator.length === 0 &&
        conflicts.machine.every(b => priorityRank(b.wo_priority) < myRank);

      if (!canPreempt) {
        const suggestions = suggestSlots(bookings, req.resource, req.start, req.durationMin);
        const error = productionError(
          input.preempt
            ? 'Cannot pre-empt: the conflicting job is not lower priority or the operator is busy.'
            : `${req.workstationName} or the operator is not available in that slot.`
        );
        error.details = { available: false, suggestions, conflicts: {
          machine: conflicts.machine.map(describeConflict), operator: conflicts.operator.map(describeConflict)
        } };
        throw error;
      }
      if (!input.reason || !String(input.reason).trim()) {
        throw productionError('A reason is required to pre-empt a running job', 400);
      }

      // Hold every lower-priority job overlapping the slot; each is re-queued behind this one
      let queueFrom = end;
      for (const victim of conflicts.machineAll.sort((a, b) => a.start - b.start)) {
        if (!HOLDABLE_STATUSES.includes(victim.status) && victim.status !== 'DRAFT') continue;
        const duration = Math.max(1, Math.round((victim.end - victim.start) / 60000));
        await holdWithin(connection, { id: victim.id, status: victim.status === 'DRAFT' ? 'PENDING' : victim.status },
          { heldBy: jc.id, reason: input.reason, userId });
        const requeue = findNextFreeSlot(
          [...bookings.filter(b => b.id !== victim.id), { id: jc.id, workstation_id: req.resource.workstationId, assigned_to: req.resource.operatorId, start: req.start, end }],
          { workstationId: req.resource.workstationId, operatorId: null, capacity: req.resource.capacity },
          queueFrom, duration
        );
        if (requeue) {
          await connection.execute('UPDATE job_cards SET start_time = ?, end_time = ? WHERE id = ?', [toSql(requeue.start), toSql(requeue.end), victim.id]);
          queueFrom = requeue.end;
        }
        preempted.push({ jobCardId: victim.id, jobCardNo: victim.job_card_no, rescheduledStart: requeue ? toSql(requeue.start) : null });
      }
    }

    await connection.execute(
      'UPDATE job_cards SET workstation_id = ?, assigned_to = ?, start_time = ?, end_time = ? WHERE id = ?',
      [req.resource.workstationId, req.resource.operatorId || null, toSql(req.start), toSql(end), jc.id]
    );
    await logProductionEvent(connection, {
      entityType: 'JOB_CARD', entityId: jc.id, action: preempted.length ? 'SCHEDULE_PREEMPT' : 'SCHEDULE',
      newValue: { workstationId: req.resource.workstationId, start: toSql(req.start), end: toSql(end), preempted: preempted.map(p => p.jobCardNo) },
      reason: input.reason || null, userId
    });

    await connection.commit();
    return { scheduled: true, start: toSql(req.start), end: toSql(end), shiftedForSequence: req.shiftedForSequence, preempted };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const holdJobCard = async (jobCardId, { reason }, userId = null) => {
  if (!reason || !String(reason).trim()) throw productionError('A reason is required to put a job on hold', 400);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const jc = await loadJobCard(connection, jobCardId, true);
    if (!HOLDABLE_STATUSES.includes(jc.status)) throw productionError(`A ${jc.status} Job Card cannot be put on hold`);
    await holdWithin(connection, jc, { heldBy: null, reason, userId });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const restoreHeldCard = async (connection, held, userId, reason) => {
  const restored = held.status_before_hold || 'PENDING';
  await connection.execute(
    `UPDATE job_cards SET status = ?, status_before_hold = NULL, held_by_job_card_id = NULL, held_at = NULL, hold_reason = NULL WHERE id = ?`,
    [restored, held.id]
  );
  await logProductionEvent(connection, {
    entityType: 'JOB_CARD', entityId: held.id, action: 'RESUME', oldValue: 'ON_HOLD', newValue: restored, reason, userId
  });
};

const resumeJobCard = async (jobCardId, userId = null) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const jc = await loadJobCard(connection, jobCardId, true);
    if (jc.status !== 'ON_HOLD') throw productionError('Only an ON_HOLD Job Card can be resumed');

    if (jc.held_by_job_card_id) {
      const [[blocker]] = await connection.query('SELECT job_card_no, status FROM job_cards WHERE id = ?', [jc.held_by_job_card_id]);
      if (blocker && !JOB_CARD_CLOSED.includes(blocker.status)) {
        throw productionError(`Job Card ${blocker.job_card_no} (which pre-empted this one) is still ${blocker.status}. Resume after it completes.`);
      }
    }
    if (jc.workstation_id && jc.status_before_hold === 'IN_PROGRESS') {
      const [[ws]] = await connection.query('SELECT IFNULL(capacity, 1) AS capacity FROM workstations WHERE id = ?', [jc.workstation_id]);
      const [[busy]] = await connection.query(
        "SELECT COUNT(*) AS cnt FROM job_cards WHERE workstation_id = ? AND status = 'IN_PROGRESS' AND id != ?",
        [jc.workstation_id, jc.id]
      );
      if (Number(busy.cnt) >= Number(ws?.capacity || 1)) throw productionError('The machine is busy with another running job; resume when it frees up');
    }

    await restoreHeldCard(connection, jc, userId, 'Manual resume');
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Called when a job card closes: whatever it had pre-empted goes back into the queue
const resumeJobCardsHeldBy = async (connection, preemptorId, userId = null) => {
  const [held] = await connection.query(
    "SELECT * FROM job_cards WHERE held_by_job_card_id = ? AND status = 'ON_HOLD' FOR UPDATE",
    [preemptorId]
  );
  for (const jc of held) {
    await restoreHeldCard(connection, jc, userId, 'Pre-empting job card completed');
  }
  return held.length;
};

// Machine timeline for planners: bookings per workstation in a date range
const getScheduleBoard = async ({ from, to, workstationId } = {}) => {
  const start = from ? toDate(from) : new Date();
  const end = to ? toDate(to) : addMinutes(start, 7 * 24 * 60);
  if (!start || !end) throw productionError('Invalid date range', 400);

  const params = [toSql(end), toSql(start)];
  let wsClause = '';
  if (workstationId) { wsClause = 'AND jc.workstation_id = ?'; params.push(workstationId); }

  const [rows] = await pool.query(
    `SELECT jc.id, jc.job_card_no, jc.operation_name, jc.status, jc.workstation_id, w.workstation_name,
            jc.assigned_to, u.username AS operator_name, jc.start_time, jc.end_time, jc.hold_reason,
            wo.wo_number, wo.item_code, wo.priority
     FROM job_cards jc
     JOIN work_orders wo ON jc.work_order_id = wo.id
     JOIN workstations w ON jc.workstation_id = w.id
     LEFT JOIN users u ON jc.assigned_to = u.id
     WHERE jc.start_time < ? AND jc.end_time > ? AND jc.status != 'CANCELLED' ${wsClause}
     ORDER BY w.workstation_name, jc.start_time`,
    params
  );
  return rows;
};

const MAINTENANCE_INTERVAL_DAYS = { Daily: 1, Weekly: 7, Monthly: 30, Quarterly: 90, 'Half-Yearly': 182, Yearly: 365 };

const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const withHour = (day, hour) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(hour), Math.round((hour % 1) * 60), 0);
const minutesBetween = (a, b) => Math.max(0, Math.round((b - a) / 60000));

// Intervals in [from, to) where fewer than `capacity` bookings overlap
const computeFreeWindows = (blocking, capacity, from, to) => {
  const events = [];
  for (const b of blocking) {
    const s = b.start < from ? from : b.start;
    const e = b.end > to ? to : b.end;
    if (e > s) { events.push([s.getTime(), 1]); events.push([e.getTime(), -1]); }
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const windows = [];
  let load = 0;
  let cursor = from.getTime();
  let freeSince = capacity > 0 ? cursor : null;
  for (const [time, delta] of events) {
    const wasFree = load < capacity;
    load += delta;
    const isFree = load < capacity;
    if (wasFree && !isFree && freeSince !== null && time > freeSince) {
      windows.push({ start: new Date(freeSince), end: new Date(time) });
      freeSince = null;
    } else if (!wasFree && isFree) {
      freeSince = time;
    }
    cursor = time;
  }
  if (load < capacity && freeSince !== null && to.getTime() > freeSince) {
    windows.push({ start: new Date(freeSince), end: to });
  }
  return windows.filter(w => minutesBetween(w.start, w.end) > 0);
};

// Everything the "View" screen of a workstation needs: status now, next free time,
// maintenance due, and for each day the bookings and free windows inside working hours.
const getWorkstationSchedule = async (workstationId, { from, days, dayStart, dayEnd } = {}) => {
  const [[ws]] = await pool.query('SELECT * FROM workstations WHERE id = ?', [workstationId]);
  if (!ws) throw productionError('Workstation not found', 404);

  const startHour = Math.min(23, Math.max(0, parseFloat(dayStart) || 8));
  const endHour = Math.min(24, Math.max(startHour + 1, parseFloat(dayEnd) || 18));
  const dayCount = Math.min(31, Math.max(1, parseInt(days, 10) || 7));
  const firstDay = startOfDay(from ? (toDate(from) || new Date()) : new Date());
  const rangeEnd = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + dayCount);
  const capacity = Math.max(1, Number(ws.capacity) || 1);
  const now = new Date();

  const [rows] = await pool.query(
    `SELECT jc.id, jc.job_card_no, jc.operation_name, jc.status, jc.start_time, jc.end_time, jc.planned_qty, jc.produced_qty,
            jc.is_rework, jc.hold_reason, jc.assigned_to, u.username AS operator_name,
            wo.wo_number, wo.item_code, wo.priority
     FROM job_cards jc
     JOIN work_orders wo ON jc.work_order_id = wo.id
     LEFT JOIN users u ON jc.assigned_to = u.id
     WHERE jc.workstation_id = ? AND jc.status != 'CANCELLED' AND jc.status != 'COMPLETED'
       AND jc.start_time IS NOT NULL AND jc.end_time IS NOT NULL AND jc.start_time < ? AND jc.end_time > ?`,
    [workstationId, toSql(rangeEnd), toSql(firstDay)]
  );
  const bookings = rows
    .map(r => ({ ...r, start: toDate(r.start_time), end: toDate(r.end_time) }))
    .filter(r => r.start && r.end);
  // A held job keeps its slot on the board but does not block the machine
  const blocking = bookings.filter(b => b.status !== 'ON_HOLD');

  const [actualRows] = await pool.query(
    `SELECT log_date, SUM(TIMESTAMPDIFF(MINUTE, start_time, end_time)) AS minutes, SUM(produced_qty) AS produced
     FROM job_card_time_logs WHERE workstation_id = ? AND log_date >= ? AND log_date < ? AND start_time IS NOT NULL AND end_time IS NOT NULL
     GROUP BY log_date`,
    [workstationId, toSql(firstDay).slice(0, 10), toSql(rangeEnd).slice(0, 10)]
  );
  const actualByDate = new Map(actualRows.map(r => [toSql(toDate(r.log_date) || new Date(r.log_date)).slice(0, 10), r]));

  const daysOut = [];
  for (let i = 0; i < dayCount; i++) {
    const day = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + i);
    const winStart = withHour(day, startHour);
    const winEnd = withHour(day, endHour);
    const dateKey = toSql(day).slice(0, 10);

    const segments = bookings
      .filter(b => b.start < winEnd && b.end > winStart)
      .map(b => ({
        jobCardId: b.id, jobCardNo: b.job_card_no, woNumber: b.wo_number, itemCode: b.item_code, operation: b.operation_name,
        status: b.status, priority: b.priority, isRework: Boolean(b.is_rework), operator: b.operator_name, holdReason: b.hold_reason,
        start: toSql(b.start < winStart ? winStart : b.start), end: toSql(b.end > winEnd ? winEnd : b.end),
        fullStart: toSql(b.start), fullEnd: toSql(b.end)
      }))
      .sort((a, b) => a.start.localeCompare(b.start));

    // Time already in the past today cannot be offered as free
    const freeFrom = now > winStart && now < winEnd ? now : winStart;
    const free = now >= winEnd ? [] : computeFreeWindows(blocking, capacity, freeFrom, winEnd)
      .map(w => ({ start: toSql(w.start), end: toSql(w.end), minutes: minutesBetween(w.start, w.end) }));

    const workingMinutes = minutesBetween(winStart, winEnd) * capacity;
    const bookedMinutes = blocking.reduce((sum, b) => {
      const s = b.start < winStart ? winStart : b.start;
      const e = b.end > winEnd ? winEnd : b.end;
      return sum + minutesBetween(s, e);
    }, 0);
    const actual = actualByDate.get(dateKey);

    daysOut.push({
      date: dateKey, weekday: day.toLocaleDateString('en-US', { weekday: 'short' }),
      windowStart: toSql(winStart), windowEnd: toSql(winEnd), workingMinutes,
      bookedMinutes: Math.min(bookedMinutes, workingMinutes),
      freeMinutes: free.reduce((sum, w) => sum + w.minutes, 0),
      bookedPercent: workingMinutes ? Math.round((Math.min(bookedMinutes, workingMinutes) / workingMinutes) * 1000) / 10 : 0,
      actualRunMinutes: actual ? Number(actual.minutes) : 0, actualProduced: actual ? Number(actual.produced) : 0,
      segments, free
    });
  }

  // Status right now
  const active = blocking.filter(b => b.start <= now && b.end > now);
  const running = active.find(b => b.status === 'IN_PROGRESS') || (await pool.query(
    "SELECT jc.id, jc.job_card_no, jc.operation_name, jc.status, wo.wo_number FROM job_cards jc JOIN work_orders wo ON jc.work_order_id = wo.id WHERE jc.workstation_id = ? AND jc.status = 'IN_PROGRESS' LIMIT 1",
    [workstationId]
  ))[0][0];
  let state = 'AVAILABLE';
  if (String(ws.status || 'Active').toLowerCase() !== 'active') state = 'INACTIVE';
  else if (running) state = 'RUNNING';
  else if (active.length >= capacity) state = 'BOOKED';

  const nextFree = findNextFreeSlot(blocking, { workstationId: Number(workstationId), operatorId: null, capacity }, now > firstDay ? now : firstDay, 1);

  // Maintenance
  let maintenance = { frequency: ws.maintenance_frequency || null, lastDate: ws.last_maintenance_date, nextDue: null, overdue: false, daysToDue: null };
  const interval = MAINTENANCE_INTERVAL_DAYS[ws.maintenance_frequency];
  if (interval && ws.last_maintenance_date) {
    const last = startOfDay(toDate(ws.last_maintenance_date) || new Date(ws.last_maintenance_date));
    const due = new Date(last.getFullYear(), last.getMonth(), last.getDate() + interval);
    const daysToDue = Math.ceil((due - startOfDay(now)) / 86400000);
    maintenance = { ...maintenance, nextDue: toSql(due).slice(0, 10), overdue: daysToDue < 0, daysToDue };
  }

  const totals = daysOut.reduce((t, d) => ({
    working: t.working + d.workingMinutes, booked: t.booked + d.bookedMinutes, run: t.run + d.actualRunMinutes
  }), { working: 0, booked: 0, run: 0 });

  return {
    workstation: {
      id: ws.id, code: ws.workstation_code, name: ws.workstation_name, type: ws.workstation_type, location: ws.location,
      status: ws.status, capacity, targetUtilization: Number(ws.target_utilization) || 0
    },
    now: {
      state,
      currentJob: running ? { jobCardId: running.id, jobCardNo: running.job_card_no, operation: running.operation_name, woNumber: running.wo_number, status: running.status } : null,
      nextFreeAt: state === 'INACTIVE' || !nextFree ? null : toSql(nextFree.start)
    },
    maintenance,
    range: { from: toSql(firstDay).slice(0, 10), days: dayCount, dayStartHour: startHour, dayEndHour: endHour },
    summary: {
      workingMinutes: totals.working, bookedMinutes: totals.booked, actualRunMinutes: totals.run,
      bookedPercent: totals.working ? Math.round((totals.booked / totals.working) * 1000) / 10 : 0,
      upcomingJobs: new Set(bookings.map(b => b.id)).size,
      heldJobs: bookings.filter(b => b.status === 'ON_HOLD').length
    },
    days: daysOut
  };
};

// One line per workstation for the master list: state right now, next free time, today's load, maintenance.
// Built from the same per-machine schedule the detail view uses, so the two always agree.
const getWorkstationsOverview = async () => {
  const [rows] = await pool.query('SELECT id FROM workstations ORDER BY workstation_name');
  const overview = [];
  for (const { id } of rows) {
    try {
      const r = await getWorkstationSchedule(id, { days: 1 });
      const today = r.days[0] || {};
      overview.push({
        id,
        state: r.now.state,
        currentJob: r.now.currentJob,
        nextFreeAt: r.now.nextFreeAt,
        bookedPercentToday: today.bookedPercent || 0,
        freeMinutesToday: today.freeMinutes || 0,
        upcomingJobs: r.summary.upcomingJobs,
        heldJobs: r.summary.heldJobs,
        maintenance: r.maintenance
      });
    } catch (error) {
      overview.push({ id, error: error.message });
    }
  }
  return overview;
};

module.exports = {
  priorityRank,
  checkAvailability,
  scheduleJobCard,
  holdJobCard,
  resumeJobCard,
  resumeJobCardsHeldBy,
  getScheduleBoard,
  getWorkstationSchedule,
  getWorkstationsOverview,
  // exposed for tests
  _internal: { computeFreeWindows, findNextFreeSlot, findConflicts, suggestSlots, estimateDurationMin }
};
