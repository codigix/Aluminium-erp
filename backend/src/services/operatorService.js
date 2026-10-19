const pool = require('../config/db');
const bcrypt = require('bcryptjs');

const pad = n => String(n).padStart(2, '0');
const toSql = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const toDate = v => {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(String(v).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
};
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const withHour = (d, h) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(h), Math.floor((h % 1) * 60));
const minutesBetween = (a, b) => Math.max(0, Math.round((b - a) / 60000));

// Ensure an OPERATOR role exists in roles table
const ensureOperatorRole = async () => {
  const [roles] = await pool.query("SELECT id FROM roles WHERE code = 'OPERATOR'");
  if (roles.length > 0) return roles[0].id;

  const [insert] = await pool.query(
    "INSERT INTO roles (name, code, description, department_id, status) VALUES ('Machine Operator', 'OPERATOR', 'Operates workstations and runs production job cards', 4, 'ACTIVE')"
  );
  return insert.insertId;
};

// Compute free time windows for an operator
const computeFreeWindows = (blocking, winStart, winEnd) => {
  const sorted = blocking
    .filter(b => b.start < winEnd && b.end > winStart)
    .sort((a, b) => a.start - b.start);

  const free = [];
  let cur = winStart;
  for (const b of sorted) {
    if (b.start > cur) free.push({ start: cur, end: b.start });
    if (b.end > cur) cur = b.end;
  }
  if (cur < winEnd) free.push({ start: cur, end: winEnd });
  return free.filter(w => minutesBetween(w.start, w.end) >= 15);
};

// 1. Get all operators
const getAllOperators = async () => {
  const query = `
    SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.status, u.created_at,
           d.name as department_name, d.id as department_id,
           r.name as role_name, r.id as role_id, r.code as role_code,
           (SELECT COUNT(DISTINCT tl.workstation_id) FROM job_card_time_logs tl WHERE tl.operator_id = u.id) as machines_worked_count,
           (SELECT COUNT(*) FROM job_card_time_logs tl WHERE tl.operator_id = u.id) as total_log_entries,
           (SELECT COALESCE(SUM(tl.produced_qty), 0) FROM job_card_time_logs tl WHERE tl.operator_id = u.id) as total_pieces_produced,
           (SELECT COALESCE(SUM(TIMESTAMPDIFF(MINUTE, tl.start_time, tl.end_time)), 0) FROM job_card_time_logs tl WHERE tl.operator_id = u.id) as total_logged_minutes
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE u.department_id = 4 
       OR r.code = 'OPERATOR'
       OR EXISTS (SELECT 1 FROM job_cards jc WHERE jc.assigned_to = u.id)
       OR EXISTS (SELECT 1 FROM job_card_time_logs tl WHERE tl.operator_id = u.id)
    ORDER BY u.first_name, u.last_name, u.username
  `;
  const [rows] = await pool.query(query);
  return rows;
};

// 2. Live overview of all operators (Current Machine, Free/Busy/Booked state, Today's numbers)
const getOperatorsOverview = async () => {
  const operators = await getAllOperators();
  const overview = [];
  const now = new Date();

  for (const op of operators) {
    try {
      // Check active running job on machine
      const [runningRows] = await pool.query(
        `SELECT jc.id as job_card_id, jc.job_card_no, jc.operation_name, jc.status, jc.start_time,
                ws.id as workstation_id, ws.workstation_name, ws.workstation_code,
                wo.wo_number, wo.item_code
         FROM job_cards jc
         JOIN work_orders wo ON jc.work_order_id = wo.id
         LEFT JOIN workstations ws ON jc.workstation_id = ws.id
         WHERE jc.assigned_to = ? AND jc.status = 'IN_PROGRESS'
         ORDER BY jc.id DESC
         LIMIT 1`,
        [op.id]
      );
      const runningJob = runningRows[0] || null;

      // Check booked / scheduled job overlapping now
      const [bookedRows] = await pool.query(
        `SELECT jc.id as job_card_id, jc.job_card_no, jc.operation_name, jc.status, jc.start_time, jc.end_time,
                ws.id as workstation_id, ws.workstation_name, ws.workstation_code,
                wo.wo_number
         FROM job_cards jc
         JOIN work_orders wo ON jc.work_order_id = wo.id
         LEFT JOIN workstations ws ON jc.workstation_id = ws.id
         WHERE jc.assigned_to = ? AND jc.status IN ('PENDING', 'READY', 'PAUSED')
           AND jc.start_time IS NOT NULL AND jc.end_time IS NOT NULL
           AND jc.start_time <= NOW() AND jc.end_time > NOW()
         LIMIT 1`,
        [op.id]
      );
      const bookedJob = bookedRows[0] || null;

      // Today's logged stats
      const [todayLogs] = await pool.query(
        `SELECT COALESCE(SUM(TIMESTAMPDIFF(MINUTE, start_time, end_time)), 0) as minutes_today,
                COALESCE(SUM(produced_qty), 0) as produced_today
         FROM job_card_time_logs
         WHERE operator_id = ? AND log_date = CURDATE()`,
        [op.id]
      );

      // Upcoming jobs count today
      const [upcomingRows] = await pool.query(
        `SELECT COUNT(*) as count
         FROM job_cards
         WHERE assigned_to = ? AND status IN ('PENDING', 'READY', 'IN_PROGRESS', 'PAUSED')
           AND (start_time IS NULL OR DATE(start_time) >= CURDATE())`,
        [op.id]
      );

      let state = 'AVAILABLE';
      if (String(op.status || 'ACTIVE').toUpperCase() !== 'ACTIVE') {
        state = 'INACTIVE';
      } else if (runningJob) {
        state = 'RUNNING';
      } else if (bookedJob) {
        state = 'BOOKED';
      }

      overview.push({
        id: op.id,
        state,
        currentJob: runningJob ? {
          jobCardId: runningJob.job_card_id,
          jobCardNo: runningJob.job_card_no,
          operation: runningJob.operation_name,
          woNumber: runningJob.wo_number,
          workstationId: runningJob.workstation_id,
          workstationName: runningJob.workstation_name,
          workstationCode: runningJob.workstation_code,
          startTime: runningJob.start_time
        } : bookedJob ? {
          jobCardId: bookedJob.job_card_id,
          jobCardNo: bookedJob.job_card_no,
          operation: bookedJob.operation_name,
          woNumber: bookedJob.wo_number,
          workstationId: bookedJob.workstation_id,
          workstationName: bookedJob.workstation_name,
          workstationCode: bookedJob.workstation_code,
          startTime: bookedJob.start_time,
          endTime: bookedJob.end_time,
          isScheduled: true
        } : null,
        minutesLoggedToday: Number(todayLogs[0]?.minutes_today || 0),
        piecesProducedToday: Number(todayLogs[0]?.produced_today || 0),
        upcomingJobs: Number(upcomingRows[0]?.count || 0)
      });
    } catch (err) {
      overview.push({ id: op.id, error: err.message });
    }
  }

  return overview;
};

// 3. Detailed Schedule Timetable for an operator (Modeled after WorkstationScheduleView)
const getOperatorSchedule = async (operatorId, { from, days, dayStart, dayEnd } = {}) => {
  const [users] = await pool.query(
    `SELECT u.id, u.username, u.first_name, u.last_name, u.email, u.phone, u.status,
            d.name as department_name, r.name as role_name
     FROM users u
     LEFT JOIN departments d ON u.department_id = d.id
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE u.id = ?`,
    [operatorId]
  );
  if (users.length === 0) throw new Error('Operator not found');
  const op = users[0];

  const startHour = Math.min(23, Math.max(0, parseFloat(dayStart) || 8));
  const endHour = Math.min(24, Math.max(startHour + 1, parseFloat(dayEnd) || 18));
  const dayCount = Math.min(31, Math.max(1, parseInt(days, 10) || 7));
  const firstDay = startOfDay(from ? (toDate(from) || new Date()) : new Date());
  const rangeEnd = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + dayCount);
  const now = new Date();

  // Load operator's scheduled job cards in this date window
  const [rows] = await pool.query(
    `SELECT jc.id, jc.job_card_no, jc.operation_name, jc.status, jc.start_time, jc.end_time,
            jc.planned_qty, jc.produced_qty, jc.is_rework, jc.hold_reason, jc.workstation_id,
            ws.workstation_name, ws.workstation_code,
            wo.wo_number, wo.item_code, wo.priority
     FROM job_cards jc
     JOIN work_orders wo ON jc.work_order_id = wo.id
     LEFT JOIN workstations ws ON jc.workstation_id = ws.id
     WHERE jc.assigned_to = ? AND jc.status != 'CANCELLED' AND jc.status != 'COMPLETED'
       AND jc.start_time IS NOT NULL AND jc.end_time IS NOT NULL 
       AND jc.start_time < ? AND jc.end_time > ?`,
    [operatorId, toSql(rangeEnd), toSql(firstDay)]
  );

  const bookings = rows
    .map(r => ({ ...r, start: toDate(r.start_time), end: toDate(r.end_time) }))
    .filter(r => r.start && r.end);

  const blocking = bookings.filter(b => b.status !== 'ON_HOLD');

  // Actual time logs recorded by this operator in the range
  const [actualRows] = await pool.query(
    `SELECT log_date, SUM(TIMESTAMPDIFF(MINUTE, start_time, end_time)) AS minutes, SUM(produced_qty) AS produced
     FROM job_card_time_logs 
     WHERE operator_id = ? AND log_date >= ? AND log_date < ? AND start_time IS NOT NULL AND end_time IS NOT NULL
     GROUP BY log_date`,
    [operatorId, toSql(firstDay).slice(0, 10), toSql(rangeEnd).slice(0, 10)]
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
        workstationName: b.workstation_name, workstationCode: b.workstation_code,
        status: b.status, priority: b.priority, isRework: Boolean(b.is_rework), holdReason: b.hold_reason,
        start: toSql(b.start < winStart ? winStart : b.start), end: toSql(b.end > winEnd ? winEnd : b.end),
        fullStart: toSql(b.start), fullEnd: toSql(b.end)
      }))
      .sort((a, b) => a.start.localeCompare(b.start));

    const freeFrom = now > winStart && now < winEnd ? now : winStart;
    const free = now >= winEnd ? [] : computeFreeWindows(blocking, freeFrom, winEnd)
      .map(w => ({ start: toSql(w.start), end: toSql(w.end), minutes: minutesBetween(w.start, w.end) }));

    const workingMinutes = minutesBetween(winStart, winEnd);
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

  // Active status now
  const [runningNowRows] = await pool.query(
    `SELECT jc.id, jc.job_card_no, jc.operation_name, jc.status, wo.wo_number,
            ws.workstation_name, ws.workstation_code
     FROM job_cards jc
     JOIN work_orders wo ON jc.work_order_id = wo.id
     LEFT JOIN workstations ws ON jc.workstation_id = ws.id
     WHERE jc.assigned_to = ? AND jc.status = 'IN_PROGRESS'
     LIMIT 1`,
    [operatorId]
  );
  const running = runningNowRows[0] || null;

  let state = 'AVAILABLE';
  if (String(op.status || 'ACTIVE').toUpperCase() !== 'ACTIVE') state = 'INACTIVE';
  else if (running) state = 'RUNNING';
  else if (blocking.some(b => b.start <= now && b.end > now)) state = 'BOOKED';

  const totals = daysOut.reduce((t, d) => ({
    working: t.working + d.workingMinutes, booked: t.booked + d.bookedMinutes, run: t.run + d.actualRunMinutes
  }), { working: 0, booked: 0, run: 0 });

  return {
    operator: {
      id: op.id,
      name: `${op.first_name || ''} ${op.last_name || ''}`.trim() || op.username,
      username: op.username,
      email: op.email,
      phone: op.phone,
      department: op.department_name,
      role: op.role_name,
      status: op.status
    },
    now: {
      state,
      currentJob: running ? {
        jobCardId: running.id, jobCardNo: running.job_card_no, operation: running.operation_name,
        woNumber: running.wo_number, workstationName: running.workstation_name, workstationCode: running.workstation_code
      } : null
    },
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

// 4. Operator History: All previously allocated machines & production logs
const getOperatorHistory = async (operatorId) => {
  // Aggregated allocated machines summary
  const [machines] = await pool.query(
    `SELECT ws.id, ws.workstation_name, ws.workstation_code, ws.workstation_type, ws.location,
            COUNT(DISTINCT tl.job_card_id) as job_cards_count,
            COUNT(tl.id) as sessions_count,
            COALESCE(SUM(TIMESTAMPDIFF(MINUTE, tl.start_time, tl.end_time)), 0) as total_minutes,
            COALESCE(SUM(tl.produced_qty), 0) as total_produced,
            MAX(tl.log_date) as last_worked_date
     FROM job_card_time_logs tl
     JOIN workstations ws ON tl.workstation_id = ws.id
     WHERE tl.operator_id = ?
     GROUP BY ws.id, ws.workstation_name, ws.workstation_code, ws.workstation_type, ws.location
     ORDER BY last_worked_date DESC`,
    [operatorId]
  );

  // Detailed chronological time logs
  const [logs] = await pool.query(
    `SELECT tl.id, tl.job_card_id, tl.workstation_id, tl.log_date, tl.shift, tl.start_time, tl.end_time,
            tl.produced_qty,
            TIMESTAMPDIFF(MINUTE, tl.start_time, tl.end_time) as duration_minutes,
            jc.job_card_no, jc.operation_name, jc.status as jc_status,
            ws.workstation_name, ws.workstation_code, ws.workstation_type,
            wo.wo_number, wo.item_code
     FROM job_card_time_logs tl
     JOIN job_cards jc ON tl.job_card_id = jc.id
     JOIN work_orders wo ON jc.work_order_id = wo.id
     LEFT JOIN workstations ws ON tl.workstation_id = ws.id
     WHERE tl.operator_id = ?
     ORDER BY tl.log_date DESC, tl.start_time DESC, tl.id DESC
     LIMIT 100`,
    [operatorId]
  );

  const totalMinutes = logs.reduce((sum, l) => sum + (Number(l.duration_minutes) || 0), 0);
  const totalProduced = logs.reduce((sum, l) => sum + (Number(l.produced_qty) || 0), 0);

  return {
    summary: {
      distinctMachinesCount: machines.length,
      totalSessionsCount: logs.length,
      totalMinutes,
      totalProduced
    },
    allocatedMachines: machines,
    logs
  };
};

// 5. Create operator
const createOperator = async (data) => {
  const { username, first_name, last_name, email, phone, status } = data;
  if (!username) throw new Error('Username is required');

  const operatorRoleId = await ensureOperatorRole();
  const hashedPassword = await bcrypt.hash(data.password || 'operator123', 10);

  const [result] = await pool.query(
    `INSERT INTO users (username, password, first_name, last_name, email, phone, department_id, role_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 4, ?, ?, NOW(), NOW())`,
    [username, hashedPassword, first_name || '', last_name || '', email || null, phone || '', operatorRoleId, status || 'ACTIVE']
  );

  return { id: result.insertId, username, first_name, last_name, email, phone, status: status || 'ACTIVE' };
};

// 6. Update operator
const updateOperator = async (id, data) => {
  const { first_name, last_name, email, phone, status } = data;
  await pool.query(
    `UPDATE users 
     SET first_name = ?, last_name = ?, email = ?, phone = ?, status = ?, updated_at = NOW()
     WHERE id = ?`,
    [first_name || '', last_name || '', email || null, phone || '', status || 'ACTIVE', id]
  );
  return { id, first_name, last_name, email, phone, status };
};

module.exports = {
  getAllOperators,
  getOperatorsOverview,
  getOperatorSchedule,
  getOperatorHistory,
  createOperator,
  updateOperator
};
