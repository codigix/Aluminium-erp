const pool = require('../config/db');

const getAllOperations = async () => {
  const [rows] = await pool.query(`
    SELECT o.*, 
           GROUP_CONCAT(w.workstation_name SEPARATOR ', ') as workstation_names,
           GROUP_CONCAT(w.workstation_code SEPARATOR ', ') as workstation_codes,
           GROUP_CONCAT(w.id SEPARATOR ',') as workstation_ids,
           o.hourly_rate as operation_rate
    FROM operations o
    LEFT JOIN operation_workstations ow ON o.id = ow.operation_id
    LEFT JOIN workstations w ON ow.workstation_id = w.id
    GROUP BY o.id
    ORDER BY CAST(SUBSTRING(o.operation_code, 4) AS UNSIGNED) ASC
  `);
  
  return rows.map(row => ({
    ...row,
    workstation_ids: row.workstation_ids ? row.workstation_ids.split(',').map(Number) : []
  }));
};

const getOperationById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM operations WHERE id = ?', [id]);
  if (rows.length === 0) return null;
  
  const [wsRows] = await pool.query('SELECT workstation_id FROM operation_workstations WHERE operation_id = ?', [id]);
  return {
    ...rows[0],
    workstation_ids: wsRows.map(r => r.workstation_id)
  };
};

const createOperation = async (data) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO operations (
        operation_code, operation_name, std_time, time_uom, hourly_rate, operation_type, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.operation_code, data.operation_name, 
        data.std_time, data.time_uom || 'Hr', data.hourly_rate || 0,
        data.operation_type || 'In-House',
        data.is_active !== undefined ? data.is_active : 1
      ]
    );

    const operationId = result.insertId;

    if (data.workstation_ids && Array.isArray(data.workstation_ids)) {
      for (const wsId of data.workstation_ids) {
        await connection.query(
          'INSERT INTO operation_workstations (operation_id, workstation_id) VALUES (?, ?)',
          [operationId, wsId]
        );
      }
    } else if (data.workstation_id) {
      await connection.query(
        'INSERT INTO operation_workstations (operation_id, workstation_id) VALUES (?, ?)',
        [operationId, data.workstation_id]
      );
    }

    await connection.commit();
    return { id: operationId, ...data };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateOperation = async (id, data) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      `UPDATE operations SET 
        operation_code = ?, 
        operation_name = ?, 
        std_time = ?, 
        time_uom = ?, 
        hourly_rate = ?,
        operation_type = ?,
        is_active = ?
       WHERE id = ?`,
      [
        data.operation_code, data.operation_name, 
        data.std_time, data.time_uom, data.hourly_rate || 0,
        data.operation_type || 'In-House',
        data.is_active, id
      ]
    );

    await connection.query('DELETE FROM operation_workstations WHERE operation_id = ?', [id]);

    if (data.workstation_ids && Array.isArray(data.workstation_ids)) {
      for (const wsId of data.workstation_ids) {
        await connection.query(
          'INSERT INTO operation_workstations (operation_id, workstation_id) VALUES (?, ?)',
          [id, wsId]
        );
      }
    } else if (data.workstation_id) {
      await connection.query(
        'INSERT INTO operation_workstations (operation_id, workstation_id) VALUES (?, ?)',
        [id, data.workstation_id]
      );
    }

    await connection.commit();
    return { id, ...data };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const deleteOperation = async (id) => {
  // ERP logic: No Delete if used (this should be checked if we had references)
  // For now, let's just implement the delete or a soft-disable if requested
  await pool.query('DELETE FROM operations WHERE id = ?', [id]);
  return { success: true };
};

const generateOperationCode = async () => {
  const [result] = await pool.query(
    `SELECT operation_code FROM operations 
     WHERE operation_code LIKE "OP-%" 
     ORDER BY CAST(SUBSTRING(operation_code, 4) AS UNSIGNED) DESC LIMIT 1`
  );
  
  if (result.length === 0) {
    return 'OP-10';
  }

  const lastCode = result[0].operation_code;
  const match = lastCode.match(/OP-(\d+)/);
  const currentNumber = match ? parseInt(match[1]) : 0;
  const nextNumber = currentNumber + 10;
  return `OP-${String(nextNumber)}`;
};

const isShipmentStep = name => ['shipment', 'dispatch'].includes(String(name || '').trim().toLowerCase());
const isOutsourcedType = type => /^(outsourc|sub[\s-]?contract|vendor)/i.test(String(type || '').trim());

// Each product's operation sequence, with the problems that later make job cards start without
// a machine, a standard time or a matching operation. Read-only: operations are edited on the item's BOM.
const getRoutingCheck = async () => {
  const [steps] = await pool.query(
    `SELECT soio.id, soio.sales_order_item_id, soio.item_code, soio.drawing_no, soio.operation_name, soio.workstation,
            soio.cycle_time_min, soio.setup_time_min, soio.hourly_rate, soio.operation_type,
            soi.description AS item_description, soi.status AS item_status, so.so_number, so.project_name
     FROM sales_order_item_operations soio
     LEFT JOIN sales_order_items soi ON soio.sales_order_item_id = soi.id
     LEFT JOIN sales_orders so ON soi.sales_order_id = so.id
     WHERE soi.id IS NULL OR soi.status != 'Rejected'
     ORDER BY soio.sales_order_item_id, soio.id
     LIMIT 8000`
  );
  const [masterOps] = await pool.query('SELECT LOWER(TRIM(operation_name)) AS n FROM operations');
  const [masterStations] = await pool.query('SELECT LOWER(TRIM(workstation_name)) AS n, LOWER(TRIM(workstation_code)) AS c FROM workstations');
  const knownOps = new Set(masterOps.map(r => r.n));
  // Routings usually store the workstation code (WS-0009); older ones store the name. Accept either.
  const knownStations = new Set(masterStations.flatMap(r => [r.n, r.c]).filter(Boolean));

  const groups = new Map();
  for (const s of steps) {
    const key = s.sales_order_item_id ? `item_${s.sales_order_item_id}` : `code_${s.item_code || s.drawing_no || 'unknown'}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key, itemId: s.sales_order_item_id, itemCode: s.item_code, drawingNo: s.drawing_no, description: s.item_description,
        orderNo: s.so_number, project: s.project_name, steps: []
      });
    }
    const outsourced = isOutsourcedType(s.operation_type);
    const shipment = isShipmentStep(s.operation_name);
    const issues = [];
    if (!shipment && !knownOps.has(String(s.operation_name || '').trim().toLowerCase())) issues.push({ code: 'UNKNOWN_OPERATION', level: 'note', text: 'Not in Operation Master. The routing\'s own time and rate are used instead' });
    if (!outsourced && !shipment) {
      if (!s.workstation) issues.push({ code: 'NO_WORKSTATION', level: 'problem', text: 'No workstation chosen, so the job card starts without a machine' });
      else if (!knownStations.has(String(s.workstation).trim().toLowerCase())) issues.push({ code: 'UNKNOWN_WORKSTATION', level: 'problem', text: `"${s.workstation}" is not in the Workstation master (it may have been deleted), so the job card starts without a machine` });
      if (!(parseFloat(s.cycle_time_min) > 0)) issues.push({ code: 'NO_TIME', level: 'problem', text: 'No cycle time, so scheduling falls back to a 60-minute guess' });
    }
    groups.get(key).steps.push({
      id: s.id, operation: s.operation_name, workstation: s.workstation, type: s.operation_type || 'In-House',
      cycleMin: parseFloat(s.cycle_time_min) || 0, setupMin: parseFloat(s.setup_time_min) || 0, rate: parseFloat(s.hourly_rate) || 0, issues
    });
  }

  const routings = Array.from(groups.values()).map(g => ({
    ...g,
    minutesPerPiece: Math.round(g.steps.reduce((sum, st) => sum + st.cycleMin, 0) * 100) / 100,
    // "problems" stop a job card getting its machine or time; "notes" are only master-data tidiness
    problemCount: g.steps.reduce((sum, st) => sum + st.issues.filter(i => i.level === 'problem').length, 0),
    noteCount: g.steps.reduce((sum, st) => sum + st.issues.filter(i => i.level === 'note').length, 0)
  }));
  const countCode = code => routings.reduce((sum, r) => sum + r.steps.filter(st => st.issues.some(i => i.code === code)).length, 0);
  return {
    routings,
    summary: {
      routings: routings.length,
      withProblems: routings.filter(r => r.problemCount > 0).length,
      unknownOperations: countCode('UNKNOWN_OPERATION'),
      noWorkstation: countCode('NO_WORKSTATION'),
      unknownWorkstations: countCode('UNKNOWN_WORKSTATION'),
      noTime: countCode('NO_TIME')
    }
  };
};

module.exports = {
  getAllOperations,
  getRoutingCheck,
  getOperationById,
  createOperation,
  updateOperation,
  deleteOperation,
  generateOperationCode
};
