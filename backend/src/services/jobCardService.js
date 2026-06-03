const crypto = require('crypto');
const pool = require('../config/db');
const generateJobCardQcPdf = require('../utils/generateJobCardQcPdf');

const listJobCards = async () => {
  const [rows] = await pool.query(
    `SELECT jc.id, jc.job_card_no, jc.work_order_id, jc.operation_id, jc.workstation_id, jc.assigned_to, jc.planned_qty, jc.status, jc.execution_mode, jc.public_id,
            jc.sequence_no, jc.actual_start_date, jc.created_at,
            jc.start_time, jc.end_time, jc.produced_qty, jc.accepted_qty, jc.rejected_qty, jc.remarks, jc.vendor_id, jc.vendor_rate,
            wo.wo_number, wo.item_name, wo.priority, wo.quantity as wo_quantity, wo.status as wo_status, wo.end_date as wo_end_date, wo.source_type,
            wo.plan_id, wo.sales_order_id, wo.parent_wo_id,
            COALESCE(soi_parent.description, oi_parent.description, soi_source.description, soi_fallback.description, oi_fallback.description, wo_parent.item_name, wo.source_fg) as source_fg,
            COALESCE(soi.drawing_no, oi.drawing_no, soi_parent.drawing_no, oi_parent.drawing_no, wo.bom_no, wo_parent.bom_no, wo_parent.item_code, wo.item_code) as drawing_no,
            so.project_name, c.company_name as client_name,
            COALESCE(o.operation_name, jc.operation_name) as operation_name, 
            COALESCE(NULLIF(jc.std_time, 0), o.std_time, 0) as std_time, 
            COALESCE(NULLIF(jc.cycle_time, 0), CASE WHEN o.time_uom = 'Min' THEN o.std_time ELSE 0 END, 0) as cycle_time,
            COALESCE(NULLIF(jc.setup_time, 0), 0) as setup_time,
            COALESCE(jc.time_uom, o.time_uom, 'Min') as time_uom, 
            COALESCE(NULLIF(jc.hourly_rate, 0), o.hourly_rate, 0) as hourly_rate, 
            w.workstation_name, u.username as operator_name, v.vendor_name, 
            soi.status as item_status,
            (SELECT id FROM outward_challans WHERE job_card_id = jc.id ORDER BY created_at DESC LIMIT 1) as outward_challan_id,
            (SELECT challan_number FROM outward_challans WHERE job_card_id = jc.id ORDER BY created_at DESC LIMIT 1) as outward_challan_no,
            (SELECT SUM(dispatch_qty) FROM outward_challans WHERE job_card_id = jc.id) as dispatch_qty,
            COALESCE(jc.execution_mode, 'In-house') as execution_type,
            (SELECT start_time FROM job_card_time_logs WHERE job_card_id = jc.id ORDER BY log_date DESC, start_time DESC, id DESC LIMIT 1) as latest_log_start_time,
            (SELECT end_time FROM job_card_time_logs WHERE job_card_id = jc.id ORDER BY log_date DESC, start_time DESC, id DESC LIMIT 1) as latest_log_end_time,
            (SELECT MAX(id) FROM work_orders WHERE 
               (plan_id = wo.plan_id AND plan_id IS NOT NULL) OR 
               (parent_wo_id = wo.parent_wo_id AND parent_wo_id IS NOT NULL) OR 
               (id = wo.id AND plan_id IS NULL AND parent_wo_id IS NULL)
            ) as batch_latest_id
     FROM job_cards jc
     JOIN work_orders wo ON jc.work_order_id = wo.id
     LEFT JOIN work_orders wo_parent ON wo.parent_wo_id = wo_parent.id
     LEFT JOIN sales_order_items soi_parent ON wo_parent.sales_order_item_id = soi_parent.id
     LEFT JOIN order_items oi_parent ON wo_parent.sales_order_item_id = oi_parent.id AND wo_parent.sales_order_id = oi_parent.order_id
     LEFT JOIN sales_order_items soi_source ON (wo.source_fg = soi_source.item_code OR wo.source_fg = soi_source.drawing_no) AND (soi_source.sales_order_id = wo.sales_order_id OR soi_source.sales_order_id IS NULL)
     LEFT JOIN sales_order_items soi_fallback ON (wo_parent.item_code = soi_fallback.item_code OR wo_parent.bom_no = soi_fallback.drawing_no) AND soi_fallback.sales_order_id IS NULL
     LEFT JOIN order_items oi_fallback ON (wo_parent.item_code = oi_fallback.item_code OR wo_parent.bom_no = oi_fallback.drawing_no) AND oi_fallback.order_id = wo_parent.sales_order_id
     LEFT JOIN sales_orders so ON wo.sales_order_id = so.id
     LEFT JOIN companies c ON so.company_id = c.id
     LEFT JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
     LEFT JOIN order_items oi ON wo.sales_order_item_id = oi.id AND wo.sales_order_id = oi.order_id
     LEFT JOIN operations o ON jc.operation_id = o.id
     LEFT JOIN workstations w ON jc.workstation_id = w.id
     LEFT JOIN users u ON jc.assigned_to = u.id
     LEFT JOIN vendors v ON jc.vendor_id = v.id
     ORDER BY batch_latest_id DESC, CASE WHEN wo.source_type = 'SA' THEN 0 ELSE 1 END ASC, wo.id ASC, jc.sequence_no ASC, jc.id ASC`
  );
  return rows;
};

const getActiveAllocations = async () => {
  const [rows] = await pool.query(
    `SELECT jc.id, jc.job_card_no, jc.workstation_id, jc.assigned_to, jc.start_time, jc.end_time, jc.status,
            jc.planned_qty,
            COALESCE(NULLIF(jc.std_time, 0), o.std_time, 0) as std_time,
            COALESCE(jc.time_uom, o.time_uom, 'Min') as time_uom,
            (SELECT start_time FROM job_card_time_logs WHERE job_card_id = jc.id ORDER BY log_date DESC, start_time DESC, id DESC LIMIT 1) as latest_log_start_time,
            (SELECT end_time FROM job_card_time_logs WHERE job_card_id = jc.id ORDER BY log_date DESC, start_time DESC, id DESC LIMIT 1) as latest_log_end_time
     FROM job_cards jc
     LEFT JOIN operations o ON jc.operation_id = o.id
     WHERE jc.status != 'COMPLETED' 
       AND jc.status != 'CANCELLED'
       AND jc.execution_mode != 'Outsource'`
  );
  return rows;
};


const checkOverlap = async (id, workstationId, assignedTo, startDateTime, endDateTime, executionMode) => {
  if (executionMode === 'Outsource') return null;
  if (!startDateTime || !endDateTime) return null;

  const startStr = startDateTime.replace('T', ' ').slice(0, 19);
  const endStr = endDateTime.replace('T', ' ').slice(0, 19);

  // Helper to format Date objects to 12h time string
  const formatTime12h = (dt) => {
    if (!dt) return '';
    const date = new Date(dt);
    if (isNaN(date.getTime())) return String(dt);
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  };

  // 1. Validate Workstation overlap
  if (workstationId) {
    const [wsRows] = await pool.query('SELECT workstation_name FROM workstations WHERE id = ?', [workstationId]);
    const workstationName = wsRows.length > 0 ? wsRows[0].workstation_name : 'Workstation';

    const query = `
      SELECT id, job_card_no, start_time, end_time 
      FROM job_cards 
      WHERE workstation_id = ? 
        AND status != 'COMPLETED' 
        AND status != 'CANCELLED'
        AND execution_mode != 'Outsource'
        AND (? < end_time AND ? > start_time)
        ${id ? 'AND id != ?' : ''}
    `;
    const params = id 
      ? [workstationId, startStr, endStr, id] 
      : [workstationId, startStr, endStr];

    const [wsOverlaps] = await pool.query(query, params);
    if (wsOverlaps.length > 0) {
      const first = wsOverlaps[0];
      const busyStart = formatTime12h(first.start_time);
      const busyEnd = formatTime12h(first.end_time);
      return `${workstationName} is already allocated to Job Card ${first.job_card_no} from ${busyStart} to ${busyEnd}. Please select another time slot.`;
    }
  }

  // 2. Validate Operator overlap
  if (assignedTo) {
    const [uRows] = await pool.query('SELECT username FROM users WHERE id = ?', [assignedTo]);
    const username = uRows.length > 0 ? uRows[0].username : 'Operator';

    const query = `
      SELECT id, job_card_no, start_time, end_time 
      FROM job_cards 
      WHERE assigned_to = ? 
        AND status != 'COMPLETED' 
        AND status != 'CANCELLED'
        AND execution_mode != 'Outsource'
        AND (? < end_time AND ? > start_time)
        ${id ? 'AND id != ?' : ''}
    `;
    const params = id 
      ? [assignedTo, startStr, endStr, id] 
      : [assignedTo, startStr, endStr];

    const [opOverlaps] = await pool.query(query, params);
    if (opOverlaps.length > 0) {
      const first = opOverlaps[0];
      const busyStart = formatTime12h(first.start_time);
      const busyEnd = formatTime12h(first.end_time);
      return `${username} is already allocated to Job Card ${first.job_card_no} from ${busyStart} to ${busyEnd}. Please select another time slot.`;
    }
  }

  return null;
};

const createJobCard = async (data) => {
  const {
    jobCardNo, workOrderId, operationId, workstationId, assignedTo, plannedQty, remarks,
    executionMode, vendorId, vendorRate, status, producedQty, acceptedQty, startDateTime, endDateTime
  } = data;

  // Check overlap first
  const conflictMessage = await checkOverlap(null, workstationId, assignedTo, startDateTime, endDateTime, executionMode);
  if (conflictMessage) {
    throw new Error(conflictMessage);
  }

  // Check if item is rejected
  const [itemRows] = await pool.query(
    `SELECT soi.status 
     FROM work_orders wo
     JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
     WHERE wo.id = ?`,
    [workOrderId]
  );

  if (itemRows.length > 0 && itemRows[0].status === 'Rejected') {
    throw new Error('Cannot create Job Card for a rejected drawing/item.');
  }

  const publicId = crypto.randomUUID();
  const [result] = await pool.execute(
    `INSERT INTO job_cards 
     (job_card_no, work_order_id, operation_id, workstation_id, assigned_to, planned_qty, remarks, 
      status, execution_mode, vendor_id, vendor_rate, produced_qty, accepted_qty, start_time, end_time, public_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      jobCardNo || null, workOrderId, operationId || null, workstationId || null, assignedTo || null, plannedQty, remarks,
      status || 'PENDING', executionMode || 'In-house', vendorId || null, vendorRate || 0, producedQty || 0, acceptedQty || 0,
      startDateTime ? startDateTime.replace('T', ' ') : null,
      endDateTime ? endDateTime.replace('T', ' ') : null,
      publicId
    ]
  );

  return result.insertId;
};

const updateJobCardProgress = async (id, data) => {
  const { producedQty, acceptedQty, rejectedQty, status, startTime, endTime, workstationId, assignedTo, targetWarehouseId, executionType,
    carrierName, trackingNumber, shippingNotes, dispatchDate, dispatchMode, dispatchQty, plannedQty } = data;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const updates = [];
    const params = [];

    if (producedQty !== undefined) {
      updates.push('produced_qty = ?');
      params.push(producedQty);
    }
    if (acceptedQty !== undefined) {
      updates.push('accepted_qty = ?');
      params.push(acceptedQty);
    }
    if (plannedQty !== undefined) {
      updates.push('planned_qty = ?');
      params.push(plannedQty);
    }
    if (rejectedQty !== undefined) {
      updates.push('rejected_qty = ?');
      params.push(rejectedQty);
    }
    if (status === 'COMPLETED') {
      // Get operation details to see if it is a shipment operation or subcontracted
      const [opRow] = await connection.query(
        'SELECT COALESCE(o.operation_name, jc.operation_name) as operation_name, o.operation_type, jc.execution_mode FROM job_cards jc LEFT JOIN operations o ON jc.operation_id = o.id WHERE jc.id = ?',
        [id]
      );
      const isShipment = opRow.length > 0 && (
        String(opRow[0].operation_name || '').toLowerCase() === 'shipment' ||
        String(opRow[0].operation_name || '').toLowerCase() === 'dispatch' ||
        String(opRow[0].operation_type || '').toLowerCase() === 'dispatch'
      );
      const isSubcontract = opRow.length > 0 && (
        String(opRow[0].execution_mode || '').toLowerCase() === 'outsource' ||
        String(opRow[0].execution_mode || '').toLowerCase() === 'subcontract' ||
        String(opRow[0].execution_mode || '').toLowerCase() === 'sub-contract'
      );

      if (!isShipment && !isSubcontract) {
        // 1. Check if all quality logs are approved
        const [qualityLogs] = await connection.query(
          'SELECT status, inspected_qty FROM job_card_quality_logs WHERE job_card_id = ?',
          [id]
        );

        if (qualityLogs.length === 0) {
          throw new Error('Cannot complete Job Card: No quality inspection records found.');
        }

        if (qualityLogs.some(log => log.status !== 'APPROVED')) {
          throw new Error('Cannot complete Job Card: Some quality inspection records are still pending approval.');
        }

        // 2. Check if total inspected matches total produced
        const [producedSum] = await connection.query(
          'SELECT SUM(produced_qty) as total FROM job_card_time_logs WHERE job_card_id = ?',
          [id]
        );

        const totalProduced = parseFloat(producedSum[0]?.total || 0);
        const totalInspected = qualityLogs.reduce((sum, log) => sum + parseFloat(log.inspected_qty || 0), 0);

        if (totalInspected < totalProduced) {
          throw new Error(`Cannot complete Job Card: Insufficient quality inspection. Produced: ${totalProduced}, Inspected: ${totalInspected}.`);
        }
      }

      // Carry forward accepted_qty or produced_qty to the next stage planned_qty automatically
      const [currentJc] = await connection.query(
        'SELECT work_order_id, sequence_no, accepted_qty, produced_qty FROM job_cards WHERE id = ?',
        [id]
      );
      if (currentJc.length > 0) {
        const { work_order_id, sequence_no, accepted_qty, produced_qty } = currentJc[0];
        const carryQty = parseFloat(accepted_qty || produced_qty || 0);

        // Find the next job card in sequence for this work order
        const [nextJcRows] = await connection.query(
          'SELECT id FROM job_cards WHERE work_order_id = ? AND sequence_no > ? ORDER BY sequence_no ASC, id ASC LIMIT 1',
          [work_order_id, sequence_no]
        );
        if (nextJcRows.length > 0) {
          const nextJcId = nextJcRows[0].id;
          await connection.execute(
            'UPDATE job_cards SET planned_qty = ? WHERE id = ?',
            [carryQty, nextJcId]
          );
        }
      }

      updates.push('status = ?');
      params.push(status);
    } else if (status) {
      updates.push('status = ?');
      params.push(status);
    }

    if (carrierName !== undefined) {
      updates.push('carrier_name = ?');
      params.push(carrierName);
    }
    if (trackingNumber !== undefined) {
      updates.push('tracking_number = ?');
      params.push(trackingNumber);
    }
    if (shippingNotes !== undefined) {
      updates.push('shipping_notes = ?');
      params.push(shippingNotes);
    }
    if (dispatchDate !== undefined) {
      updates.push('dispatch_date = ?');
      params.push(dispatchDate);
    }
    if (dispatchMode !== undefined) {
      updates.push('dispatch_mode = ?');
      params.push(dispatchMode);
    }
    if (dispatchQty !== undefined) {
      updates.push('dispatch_qty = ?');
      params.push(dispatchQty);
    }

    if (status === 'IN_PROGRESS') {
      const [jcData] = await connection.query('SELECT workstation_id, assigned_to FROM job_cards WHERE id = ?', [id]);
      if (jcData.length === 0) throw new Error('Job Card not found');

      const checkWorkstationId = workstationId || jcData[0].workstation_id;
      const checkAssignedTo = assignedTo || jcData[0].assigned_to;

      if (checkWorkstationId) {
        const [wsRows] = await connection.query('SELECT IFNULL(capacity, 1) as capacity FROM workstations WHERE id = ?', [checkWorkstationId]);
        const capacity = wsRows.length > 0 ? wsRows[0].capacity : 1;

        if (startTime) {
          const [overlappingWS] = await connection.query(
            `SELECT jc.job_card_no 
             FROM job_card_time_logs tl
             JOIN job_cards jc ON tl.job_card_id = jc.id
             WHERE tl.workstation_id = ? 
               AND tl.start_time <= ? 
               AND tl.end_time > ?
               AND tl.job_card_id != ?`,
            [checkWorkstationId, startTime, startTime, id]
          );
          if (overlappingWS.length >= capacity) {
            throw new Error(`Workstation is busy with Job Card ${overlappingWS[0].job_card_no}`);
          }
        } else {
          const [activeJobs] = await connection.query(
            'SELECT job_card_no FROM job_cards WHERE workstation_id = ? AND status = "IN_PROGRESS" AND id != ?',
            [checkWorkstationId, id]
          );
          if (activeJobs.length >= capacity) {
            throw new Error(`Workstation is busy with Job Card ${activeJobs[0].job_card_no}`);
          }
        }
      }

      if (checkAssignedTo) {
        if (startTime) {
          const [overlapOp] = await connection.query(
            `SELECT jc.job_card_no 
             FROM job_card_time_logs tl
             JOIN job_cards jc ON tl.job_card_id = jc.id
             WHERE tl.operator_id = ? 
               AND tl.start_time <= ? 
               AND tl.end_time > ?
               AND tl.job_card_id != ?`,
            [checkAssignedTo, startTime, startTime, id]
          );
          if (overlapOp.length > 0) {
            throw new Error(`Operator is busy with Job Card ${overlapOp[0].job_card_no}`);
          }
        } else {
          const [busyOp] = await connection.query(
            'SELECT job_card_no FROM job_cards WHERE assigned_to = ? AND status = "IN_PROGRESS" AND id != ?',
            [checkAssignedTo, id]
          );
          if (busyOp.length > 0 && busyOp[0]) {
            throw new Error(`Operator is busy with Job Card ${busyOp[0].job_card_no}`);
          }
        }
      }
    }

    if (workstationId !== undefined) {
      updates.push('workstation_id = ?');
      params.push(workstationId || null);
    }
    if (assignedTo !== undefined) {
      updates.push('assigned_to = ?');
      params.push(assignedTo || null);
    }
    if (targetWarehouseId !== undefined) {
      updates.push('target_warehouse_id = ?');
      params.push(targetWarehouseId || null);
    }
    if (executionType) {
      updates.push('execution_mode = ?');
      params.push(executionType);

      // Update execution_type if it exists in DB (sync both columns)
      try {
        updates.push('execution_type = ?');
        params.push(executionType);
      } catch (e) {
        console.warn('execution_type column might be missing', e.message);
      }
    }

    if (updates.length > 0) {
      params.push(id);
      const query = `UPDATE job_cards SET ${updates.join(', ')} WHERE id = ?`;
      await connection.execute(query, params);
    }

    // Update Work Order status based on Job Cards
    const [jcRows] = await connection.query('SELECT work_order_id FROM job_cards WHERE id = ?', [id]);
    if (jcRows.length > 0) {
      const workOrderId = jcRows[0].work_order_id;

      const [allJcs] = await connection.query('SELECT status FROM job_cards WHERE work_order_id = ?', [workOrderId]);

      let newWoStatus = 'RELEASED';
      if (allJcs.some(jc => jc.status === 'IN_PROGRESS')) {
        newWoStatus = 'IN_PROGRESS';
      } else if (allJcs.every(jc => jc.status === 'COMPLETED')) {
        newWoStatus = 'COMPLETED';
      } else if (allJcs.some(jc => jc.status === 'COMPLETED' || jc.status === 'PENDING')) {
        const hasStarted = allJcs.some(jc => jc.status === 'COMPLETED');
        if (hasStarted) newWoStatus = 'IN_PROGRESS';
      }

      await connection.execute('UPDATE work_orders SET status = ? WHERE id = ?', [newWoStatus, workOrderId]);
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error('Error updating job card progress:', error);
    throw error;
  } finally {
    connection.release();
  }
};

const getJobCardById = async (id) => {
  const isUuid = typeof id === 'string' && id.length === 36;
  const whereClause = isUuid ? 'jc.public_id = ?' : 'jc.id = ?';
  const [rows] = await pool.query(
    `SELECT jc.*, wo.wo_number, wo.item_name,
            COALESCE(soi.drawing_no, oi.drawing_no, wo.bom_no, wo.item_code) as drawing_no,
            COALESCE(o.operation_name, jc.operation_name) as operation_name, 
            COALESCE(NULLIF(jc.std_time, 0), o.std_time, 0) as std_time, 
            COALESCE(NULLIF(jc.cycle_time, 0), CASE WHEN o.time_uom = 'Min' THEN o.std_time ELSE 0 END, 0) as cycle_time,
            COALESCE(NULLIF(jc.setup_time, 0), 0) as setup_time,
            COALESCE(jc.time_uom, o.time_uom, 'Min') as time_uom, 
            COALESCE(NULLIF(jc.hourly_rate, 0), o.hourly_rate, 0) as hourly_rate, 
            w.workstation_name, u.username as operator_name, v.vendor_name,
            so.project_name, c.company_name as client_name, so.shipping_address
     FROM job_cards jc
     JOIN work_orders wo ON jc.work_order_id = wo.id
     LEFT JOIN sales_orders so ON wo.sales_order_id = so.id
     LEFT JOIN companies c ON so.company_id = c.id
     LEFT JOIN operations o ON jc.operation_id = o.id
     LEFT JOIN workstations w ON jc.workstation_id = w.id
     LEFT JOIN users u ON jc.assigned_to = u.id
     LEFT JOIN vendors v ON jc.vendor_id = v.id
     LEFT JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
     LEFT JOIN order_items oi ON wo.sales_order_item_id = oi.id AND wo.sales_order_id = oi.order_id
     WHERE ${whereClause}`,
    [id]
  );
  return rows[0];
};

const getTimeLogs = async (jobCardId) => {
  const [rows] = await pool.query(
    `SELECT tl.*, u.username as operator_name, w.workstation_name 
     FROM job_card_time_logs tl
     LEFT JOIN users u ON tl.operator_id = u.id
     LEFT JOIN workstations w ON tl.workstation_id = w.id
     WHERE tl.job_card_id = ? ORDER BY tl.created_at DESC`,
    [jobCardId]
  );
  return rows;
};

const addTimeLog = async (data) => {
  const { jobCardId, logDate, operatorId, workstationId, shift, startTime, endTime, producedQty, day } = data;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Prevent duplicate entry (job_card_id, log_date, shift)
    const [existingLogs] = await connection.query(
      'SELECT id FROM job_card_time_logs WHERE job_card_id = ? AND log_date = ? AND shift = ?',
      [jobCardId, logDate, shift]
    );
    if (existingLogs.length > 0) {
      throw new Error(`A log for this shift (${shift}) on ${logDate} already exists for this Job Card.`);
    }

    // 1b. Check Operator and Workstation availability with time overlap
    const fullStartTime = (logDate && startTime) ? `${logDate} ${startTime}` : null;
    const fullEndTime = (logDate && endTime) ? `${logDate} ${endTime}` : null;

    if (workstationId) {
      const [wsRows] = await connection.query('SELECT IFNULL(capacity, 1) as capacity FROM workstations WHERE id = ?', [workstationId]);
      const capacity = wsRows.length > 0 ? wsRows[0].capacity : 1;

      if (fullStartTime && fullEndTime) {
        const [overlappingWS] = await connection.query(
          `SELECT jc.job_card_no 
           FROM job_card_time_logs tl
           JOIN job_cards jc ON tl.job_card_id = jc.id
           WHERE tl.workstation_id = ? 
             AND tl.start_time < ? 
             AND tl.end_time > ?`,
          [workstationId, fullEndTime, fullStartTime]
        );
        if (overlappingWS.length >= capacity) {
          throw new Error(`Workstation is busy with Job Card ${overlappingWS[0].job_card_no}`);
        }
      } else {
        const [activeJobs] = await connection.query(
          'SELECT job_card_no FROM job_cards WHERE workstation_id = ? AND status = "IN_PROGRESS" AND id != ?',
          [workstationId, jobCardId]
        );
        if (activeJobs.length >= capacity) {
          throw new Error(`Workstation is busy with Job Card ${activeJobs[0].job_card_no}`);
        }
      }
    }

    if (operatorId) {
      if (fullStartTime && fullEndTime) {
        const [overlapOp] = await connection.query(
          `SELECT jc.job_card_no 
           FROM job_card_time_logs tl
           JOIN job_cards jc ON tl.job_card_id = jc.id
           WHERE tl.operator_id = ? 
             AND tl.start_time < ? 
             AND tl.end_time > ?`,
          [operatorId, fullEndTime, fullStartTime]
        );
        if (overlapOp.length > 0) {
          throw new Error(`Operator is busy with Job Card ${overlapOp[0].job_card_no}`);
        }
      } else {
        const [busyOp] = await connection.query(
          'SELECT job_card_no FROM job_cards WHERE assigned_to = ? AND status = "IN_PROGRESS" AND id != ?',
          [operatorId, jobCardId]
        );
        if (busyOp.length > 0) {
          throw new Error(`Operator is busy with Job Card ${busyOp[0].job_card_no}`);
        }
      }
    }

    // 2. Get Job Card details
    const [jcRows] = await connection.query(
      'SELECT actual_start_date FROM job_cards WHERE id = ?',
      [jobCardId]
    );
    if (jcRows.length === 0) throw new Error('Job Card not found');

    let actualStartDate = jcRows[0].actual_start_date;
    // If it's a Date object, convert to YYYY-MM-DD string to avoid timezone shifts
    if (actualStartDate instanceof Date) {
      actualStartDate = actualStartDate.toISOString().split('T')[0];
    }
    let calculatedDay = 1;

    // 3. Logic for Day calculation
    if (!actualStartDate) {
      // First Entry
      actualStartDate = logDate;
      await connection.execute(
        "UPDATE job_cards SET actual_start_date = ?, status = 'IN_PROGRESS', workstation_id = ?, assigned_to = ? WHERE id = ?",
        [actualStartDate, workstationId, operatorId, jobCardId]
      );
      calculatedDay = 1;
    } else {
      // Update workstation and operator even if not the first entry to reflect current activity
      await connection.execute(
        "UPDATE job_cards SET workstation_id = ?, assigned_to = ? WHERE id = ?",
        [workstationId, operatorId, jobCardId]
      );
      // Future Entries
      const start = new Date(actualStartDate + 'T00:00:00');
      const current = new Date(logDate + 'T00:00:00');

      if (current < start) {
        throw new Error(`Production date (${logDate}) cannot be earlier than actual start date (${actualStartDate})`);
      }

      const diffTime = current - start;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      calculatedDay = diffDays + 1;
    }

    // Use manually provided day if present, otherwise use calculatedDay
    const finalDay = (day !== undefined && day !== null && day !== '') ? day : calculatedDay;



    const [result] = await connection.execute(
      `INSERT INTO job_card_time_logs 
       (job_card_id, day, log_date, operator_id, workstation_id, shift, start_time, end_time, produced_qty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        jobCardId || null,
        finalDay,
        logDate || null,
        operatorId || null,
        workstationId || null,
        shift || null,
        fullStartTime,
        fullEndTime,
        producedQty || 0
      ]
    );

    // Update total produced qty, workstation and operator in job card
    await connection.execute(
      `UPDATE job_cards jc 
       SET produced_qty = (SELECT SUM(produced_qty) FROM job_card_time_logs WHERE job_card_id = ?),
           workstation_id = COALESCE(?, workstation_id),
           assigned_to = COALESCE(?, assigned_to)
       WHERE id = ?`,
      [jobCardId, workstationId || null, operatorId || null, jobCardId]
    );

    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateTimeLog = async (id, data) => {
  const { day, logDate, operatorId, workstationId, shift, startTime, endTime, producedQty } = data;

  // Get jobCardId from the log before updating if not provided
  let { jobCardId } = data;
  if (!jobCardId) {
    const [log] = await pool.query('SELECT job_card_id FROM job_card_time_logs WHERE id = ?', [id]);
    if (log.length > 0) jobCardId = log[0].job_card_id;
  }

  const fullStartTime = startTime ? (startTime.includes(':') && !startTime.includes(' ') ? `${logDate} ${startTime}` : startTime) : null;
  const fullEndTime = endTime ? (endTime.includes(':') && !endTime.includes(' ') ? `${logDate} ${endTime}` : endTime) : null;

  const updates = [];
  const params = [];

  if (day !== undefined) { updates.push('day = ?'); params.push(day); }
  if (logDate) { updates.push('log_date = ?'); params.push(logDate); }
  if (operatorId) { updates.push('operator_id = ?'); params.push(operatorId); }
  if (workstationId) { updates.push('workstation_id = ?'); params.push(workstationId); }
  if (shift) { updates.push('shift = ?'); params.push(shift); }
  if (fullStartTime) { updates.push('start_time = ?'); params.push(fullStartTime); }
  if (fullEndTime) { updates.push('end_time = ?'); params.push(fullEndTime); }
  if (producedQty !== undefined) { updates.push('produced_qty = ?'); params.push(producedQty); }

  if (updates.length > 0) {
    params.push(id);
    await pool.execute(
      `UPDATE job_card_time_logs SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
  }

  // Update total produced qty, workstation and operator in job card
  if (jobCardId) {
    await pool.execute(
      `UPDATE job_cards jc 
       SET produced_qty = (SELECT SUM(produced_qty) FROM job_card_time_logs WHERE job_card_id = ?),
           workstation_id = COALESCE(?, workstation_id),
           assigned_to = COALESCE(?, assigned_to)
       WHERE id = ?`,
      [jobCardId, workstationId, operatorId, jobCardId]
    );
  }
};

const getQualityLogs = async (jobCardId) => {
  const [rows] = await pool.query(
    'SELECT * FROM job_card_quality_logs WHERE job_card_id = ? ORDER BY created_at DESC',
    [jobCardId]
  );

  // Fetch inward items for each log if they exist
  for (const log of rows) {
    const [items] = await pool.query(
      'SELECT * FROM job_card_inward_item_rates WHERE quality_log_id = ?',
      [log.id]
    );
    log.inwardItems = items;
  }

  return rows;
};

const addQualityLog = async (data) => {
  const { jobCardId, day, checkDate, shift, inspectedQty, acceptedQty, rejectedQty, scrapQty, rejectionReason, notes, status, inwardItems, vendorInvoice, subTotal, gstAmount, grandTotal } = data;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Get actual_start_date from job card
    const [jobCard] = await connection.query('SELECT actual_start_date FROM job_cards WHERE id = ?', [jobCardId]);
    if (jobCard.length === 0) throw new Error('Job Card not found');

    let actualStartDate = jobCard[0].actual_start_date;
    if (actualStartDate instanceof Date) {
      actualStartDate = actualStartDate.toISOString().split('T')[0];
    }
    let calculatedDay = 1;

    // 2. Logic for Day calculation
    if (!actualStartDate) {
      // First Entry
      actualStartDate = checkDate;
      await connection.execute(
        "UPDATE job_cards SET actual_start_date = ?, status = 'IN_PROGRESS' WHERE id = ?",
        [actualStartDate, jobCardId]
      );
      calculatedDay = 1;
    } else {
      // Future Entries
      const start = new Date(actualStartDate + 'T00:00:00');
      const current = new Date(checkDate + 'T00:00:00');

      const diffTime = current - start;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      calculatedDay = diffDays + 1;
    }

    // Use manually provided day if present, otherwise use calculatedDay
    const finalDay = (day !== undefined && day !== null && day !== '') ? day : calculatedDay;

    const [result] = await connection.execute(
      `INSERT INTO job_card_quality_logs 
       (job_card_id, day, check_date, shift, inspected_qty, accepted_qty, rejected_qty, scrap_qty, rejection_reason, notes, status, vendor_invoice, sub_total, gst_amount, grand_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        jobCardId, finalDay, checkDate, shift, inspectedQty, acceptedQty, rejectedQty, scrapQty, rejectionReason || null, notes || null, status || 'PENDING',
        vendorInvoice || null, subTotal || 0, gstAmount || 0, grandTotal || 0
      ]
    );

    const qualityLogId = result.insertId;

    // 3. Handle Inward Item Rates
    if (inwardItems && Array.isArray(inwardItems)) {
      for (const item of inwardItems) {
        await connection.execute(
          `INSERT INTO job_card_inward_item_rates 
           (quality_log_id, item_code, release_qty, rate)
           VALUES (?, ?, ?, ?)`,
          [qualityLogId, item.item_code, item.release_qty, item.rate || 0]
        );
      }
    }

    // Update accepted and rejected qty in job card if approved
    if (status === 'APPROVED') {
      await connection.execute(
        `UPDATE job_cards jc 
         SET accepted_qty = (SELECT SUM(accepted_qty) FROM job_card_quality_logs WHERE job_card_id = ? AND status = 'APPROVED'),
             rejected_qty = (SELECT SUM(rejected_qty) FROM job_card_quality_logs WHERE job_card_id = ? AND status = 'APPROVED')
         WHERE id = ?`,
        [jobCardId, jobCardId, jobCardId]
      );
    }

    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateQualityLog = async (id, data) => {
  const { day, checkDate, shift, inspectedQty, acceptedQty, rejectedQty, scrapQty, rejectionReason, notes, status } = data;

  // Get jobCardId from the log before updating if not provided
  let { jobCardId } = data;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    if (!jobCardId) {
      const [log] = await connection.query('SELECT job_card_id FROM job_card_quality_logs WHERE id = ?', [id]);
      if (log.length > 0) jobCardId = log[0].job_card_id;
    }

    const updates = [];
    const params = [];

    if (day !== undefined) { updates.push('day = ?'); params.push(day); }
    if (checkDate) { updates.push('check_date = ?'); params.push(checkDate); }
    if (shift) { updates.push('shift = ?'); params.push(shift); }
    if (inspectedQty !== undefined) { updates.push('inspected_qty = ?'); params.push(inspectedQty); }
    if (acceptedQty !== undefined) { updates.push('accepted_qty = ?'); params.push(acceptedQty); }
    if (rejectedQty !== undefined) { updates.push('rejected_qty = ?'); params.push(rejectedQty); }
    if (scrapQty !== undefined) { updates.push('scrap_qty = ?'); params.push(scrapQty); }
    if (rejectionReason !== undefined) { updates.push('rejection_reason = ?'); params.push(rejectionReason); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
    if (status) {
      const trimmedStatus = status.trim();
      updates.push('status = ?');
      params.push(trimmedStatus);
    }

    if (updates.length > 0) {
      params.push(id);
      await connection.execute(
        `UPDATE job_card_quality_logs SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    // Update accepted and rejected qty in job card if approved
    if (jobCardId) {
      await connection.execute(
        `UPDATE job_cards jc 
         SET accepted_qty = (SELECT SUM(accepted_qty) FROM job_card_quality_logs WHERE job_card_id = ? AND status = 'APPROVED'),
             rejected_qty = (SELECT SUM(rejected_qty) FROM job_card_quality_logs WHERE job_card_id = ? AND status = 'APPROVED')
         WHERE id = ?`,
        [jobCardId, jobCardId, jobCardId]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getDowntimeLogs = async (jobCardId) => {
  const [rows] = await pool.query(
    'SELECT * FROM job_card_downtime_logs WHERE job_card_id = ? ORDER BY created_at DESC',
    [jobCardId]
  );
  return rows;
};

const addDowntimeLog = async (data) => {
  const { jobCardId, day, downtimeDate, shift, downtimeType, startTime, endTime, remarks } = data;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Get actual_start_date from job card
    const [jobCard] = await connection.query('SELECT actual_start_date FROM job_cards WHERE id = ?', [jobCardId]);
    if (jobCard.length === 0) throw new Error('Job Card not found');

    let actualStartDate = jobCard[0].actual_start_date;
    if (actualStartDate instanceof Date) {
      actualStartDate = actualStartDate.toISOString().split('T')[0];
    }
    let calculatedDay = 1;

    // 2. Logic for Day calculation
    if (!actualStartDate) {
      // First Entry
      actualStartDate = downtimeDate;
      await connection.execute(
        "UPDATE job_cards SET actual_start_date = ?, status = 'IN_PROGRESS' WHERE id = ?",
        [actualStartDate, jobCardId]
      );
      calculatedDay = 1;
    } else {
      // Future Entries
      const start = new Date(actualStartDate + 'T00:00:00');
      const current = new Date(downtimeDate + 'T00:00:00');

      const diffTime = current - start;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      calculatedDay = diffDays + 1;
    }

    // Use manually provided day if present, otherwise use calculatedDay
    const finalDay = (day !== undefined && day !== null && day !== '') ? day : calculatedDay;

    // Convert startTime and endTime to full DATETIME strings using downtimeDate
    const fullStartTime = (downtimeDate && startTime) ? `${downtimeDate} ${startTime}` : null;
    const fullEndTime = (downtimeDate && endTime) ? `${downtimeDate} ${endTime}` : null;

    const [result] = await connection.execute(
      `INSERT INTO job_card_downtime_logs 
       (job_card_id, day, downtime_date, shift, downtime_type, start_time, end_time, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [jobCardId, finalDay, downtimeDate, shift, downtimeType, fullStartTime, fullEndTime, remarks]
    );

    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateJobCard = async (id, data) => {
  const {
    workOrderId, operationId, workstationId, assignedTo, plannedQty, remarks,
    executionMode, vendorId, vendorRate, status, producedQty, acceptedQty, startDateTime, endDateTime
  } = data;

  const [currentJc] = await pool.query(
    'SELECT status, produced_qty, start_time, end_time, workstation_id, assigned_to FROM job_cards WHERE id = ?',
    [id]
  );
  if (currentJc.length > 0) {
    const jc = currentJc[0];
    const [timeLogs] = await pool.query('SELECT COUNT(*) as count FROM job_card_time_logs WHERE job_card_id = ?', [id]);
    const logCount = timeLogs[0]?.count || 0;

    const hasLogProcessStarted = jc.status !== 'PENDING' || parseFloat(jc.produced_qty || 0) > 0 || logCount > 0;
    if (hasLogProcessStarted) {
      const currentStartStr = jc.start_time ? new Date(jc.start_time).toISOString().slice(0, 19).replace('T', ' ') : null;
      const currentEndStr = jc.end_time ? new Date(jc.end_time).toISOString().slice(0, 19).replace('T', ' ') : null;

      const newStartStr = startDateTime ? startDateTime.replace('T', ' ').slice(0, 19) : null;
      const newEndStr = endDateTime ? endDateTime.replace('T', ' ').slice(0, 19) : null;

      const workstationChanged = Number(workstationId || 0) !== Number(jc.workstation_id || 0);
      const assignedToChanged = Number(assignedTo || 0) !== Number(jc.assigned_to || 0);

      const parseAndCompareTimes = (t1, t2) => {
        if (!t1 && !t2) return false;
        if (!t1 || !t2) return true;
        const d1 = new Date(t1);
        const d2 = new Date(t2);
        return Math.abs(d1.getTime() - d2.getTime()) > 60000;
      };

      const startTimeChanged = parseAndCompareTimes(currentStartStr, newStartStr);
      const endTimeChanged = parseAndCompareTimes(currentEndStr, newEndStr);

      if (startTimeChanged || endTimeChanged || workstationChanged || assignedToChanged) {
        throw new Error('Cannot modify planned schedule (dates/times), operator or workstation once logging/operation process has started.');
      }
    }
  }

  // Check overlap first
  const conflictMessage = await checkOverlap(id, workstationId, assignedTo, startDateTime, endDateTime, executionMode);
  if (conflictMessage) {
    throw new Error(conflictMessage);
  }

  await pool.execute(
    `UPDATE job_cards 
     SET work_order_id = ?, operation_id = ?, workstation_id = ?, assigned_to = ?, planned_qty = ?, remarks = ?,
         execution_mode = ?, vendor_id = ?, vendor_rate = ?, status = ?, produced_qty = ?, accepted_qty = ?, 
         start_time = ?, end_time = ?
     WHERE id = ?`,
    [
      workOrderId, operationId || null, workstationId || null, assignedTo || null, plannedQty, remarks,
      executionMode || 'In-house', vendorId || null, vendorRate || 0, status || 'PENDING', producedQty || 0, acceptedQty || 0,
      startDateTime ? startDateTime.replace('T', ' ') : null,
      endDateTime ? endDateTime.replace('T', ' ') : null,
      id
    ]
  );
};

const deleteJobCard = async (id) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Delete associated logs first
    await connection.execute('DELETE FROM job_card_time_logs WHERE job_card_id = ?', [id]);
    await connection.execute('DELETE FROM job_card_quality_logs WHERE job_card_id = ?', [id]);
    await connection.execute('DELETE FROM job_card_downtime_logs WHERE job_card_id = ?', [id]);

    // Delete the job card
    await connection.execute('DELETE FROM job_cards WHERE id = ?', [id]);

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const deleteTimeLog = async (logId) => {
  const [log] = await pool.query('SELECT job_card_id FROM job_card_time_logs WHERE id = ?', [logId]);

  await pool.execute('DELETE FROM job_card_time_logs WHERE id = ?', [logId]);

  if (log.length > 0) {
    const jobCardId = log[0].job_card_id;
    await pool.execute(
      `UPDATE job_cards jc 
       SET produced_qty = COALESCE((SELECT SUM(produced_qty) FROM job_card_time_logs WHERE job_card_id = ?), 0)
       WHERE id = ?`,
      [jobCardId, jobCardId]
    );
  }
};

const deleteQualityLog = async (logId) => {
  const [log] = await pool.query('SELECT job_card_id FROM job_card_quality_logs WHERE id = ?', [logId]);

  await pool.execute('DELETE FROM job_card_quality_logs WHERE id = ?', [logId]);

  if (log.length > 0) {
    const jobCardId = log[0].job_card_id;
    await pool.execute(
      `UPDATE job_cards jc 
       SET accepted_qty = COALESCE((SELECT SUM(accepted_qty) FROM job_card_quality_logs WHERE job_card_id = ? AND status = 'APPROVED'), 0),
           rejected_qty = COALESCE((SELECT SUM(rejected_qty) FROM job_card_quality_logs WHERE job_card_id = ? AND status = 'APPROVED'), 0)
       WHERE id = ?`,
      [jobCardId, jobCardId, jobCardId]
    );
  }
};

const deleteDowntimeLog = async (logId) => {
  await pool.execute('DELETE FROM job_card_downtime_logs WHERE id = ?', [logId]);
};

const getWorkOrderLogs = async (workOrderId) => {
  const [timeLogs] = await pool.query(
    `SELECT tl.*, u.username as operator_name, w.workstation_name, jc.job_card_no, o.operation_name
     FROM job_card_time_logs tl
     JOIN job_cards jc ON tl.job_card_id = jc.id
     LEFT JOIN users u ON tl.operator_id = u.id
     LEFT JOIN workstations w ON tl.workstation_id = w.id
     LEFT JOIN operations o ON jc.operation_id = o.id
     WHERE jc.work_order_id = ? ORDER BY tl.log_date DESC, tl.shift ASC`,
    [workOrderId]
  );

  const [qualityLogs] = await pool.query(
    `SELECT ql.*, jc.job_card_no, o.operation_name
     FROM job_card_quality_logs ql
     JOIN job_cards jc ON ql.job_card_id = jc.id
     LEFT JOIN operations o ON jc.operation_id = o.id
     WHERE jc.work_order_id = ? ORDER BY ql.check_date DESC, ql.shift ASC`,
    [workOrderId]
  );

  const [downtimeLogs] = await pool.query(
    `SELECT dl.*, jc.job_card_no, o.operation_name
     FROM job_card_downtime_logs dl
     JOIN job_cards jc ON dl.job_card_id = jc.id
     LEFT JOIN operations o ON jc.operation_id = o.id
     WHERE jc.work_order_id = ? ORDER BY dl.downtime_date DESC, dl.shift ASC`,
    [workOrderId]
  );

  return { timeLogs, qualityLogs, downtimeLogs };
};

const getVendorReceipts = async () => {
  const [rows] = await pool.query(`
    SELECT 
      q.id,
      q.job_card_id,
      jc.job_card_no as job_card_number,
      q.check_date as date,
      q.sub_total,
      q.gst_amount,
      q.grand_total as amount,
      q.status,
      q.vendor_invoice as invoice_url,
      v.vendor_name,
      v.id as vendor_id
    FROM job_card_quality_logs q
    JOIN job_cards jc ON q.job_card_id = jc.id
    JOIN outward_challans oc ON jc.id = oc.job_card_id
    JOIN vendors v ON oc.vendor_id = v.id
    WHERE q.grand_total > 0
    ORDER BY q.created_at DESC
  `);

  return rows;
};

const getVendorReceiptItems = async (logId) => {
  const [rows] = await pool.query(`
    SELECT * FROM job_card_inward_item_rates
    WHERE quality_log_id = ?
  `, [logId]);
  return rows;
};

const sendVendorReceiptToPayment = async (logId) => {
  await pool.execute(
    "UPDATE job_card_quality_logs SET status = 'PROCESSING' WHERE id = ?",
    [logId]
  );
  return { success: true };
};

const getQualityLogFullDetails = async (logId) => {
  const [rows] = await pool.query(
    `SELECT ql.*, 
            jc.job_card_no, jc.planned_qty,
            wo.wo_number, wo.item_name, wo.item_code,
            COALESCE(soi.drawing_no, oi.drawing_no, wo.bom_no, wo.item_code) as drawing_no,
            so.project_name, c.company_name as client_name,
            o.operation_name
     FROM job_card_quality_logs ql
     JOIN job_cards jc ON ql.job_card_id = jc.id
     JOIN work_orders wo ON jc.work_order_id = wo.id
     LEFT JOIN sales_orders so ON wo.sales_order_id = so.id
     LEFT JOIN companies c ON so.company_id = c.id
     LEFT JOIN operations o ON jc.operation_id = o.id
     LEFT JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
     LEFT JOIN order_items oi ON wo.sales_order_item_id = oi.id AND wo.sales_order_id = oi.order_id
     WHERE ql.id = ?`,
    [logId]
  );
  return rows[0] || null;
};

const downloadJobCardQcPdf = async (logId) => {
  const logDetails = await getQualityLogFullDetails(logId);
  if (!logDetails) throw new Error('Quality inspection record not found');

  const pdfPath = await generateJobCardQcPdf({ log: logDetails });
  return pdfPath;
};

const getJobCardDetailAnalysis = async (idOrNo) => {
  try {
    const isUuid = typeof idOrNo === 'string' && idOrNo.length === 36;
    const whereClause = isUuid ? 'jc.public_id = :id' : 'jc.id = :id OR TRIM(jc.job_card_no) = :no OR jc.job_card_no LIKE :likeNo';

    const query = `SELECT jc.*, wo.wo_number, wo.item_name, wo.item_code, wo.priority, wo.quantity as wo_total_qty,
            COALESCE(o.operation_name, jc.operation_name) as op_name,
            w.workstation_name, u.username as operator_name,
            so.project_name, c.company_name as client_name, so.shipping_address,
            so.target_dispatch_date,
            (SELECT SUM(produced_qty) FROM job_card_time_logs WHERE job_card_id = jc.id) as actual_produced,
            (SELECT SUM(inspected_qty) FROM job_card_quality_logs WHERE job_card_id = jc.id AND status = 'APPROVED') as actual_accepted,
            (SELECT SUM(rejected_qty) FROM job_card_quality_logs WHERE job_card_id = jc.id AND status = 'APPROVED') as actual_rejected
     FROM job_cards jc
     LEFT JOIN work_orders wo ON jc.work_order_id = wo.id
     LEFT JOIN sales_orders so ON wo.sales_order_id = so.id
     LEFT JOIN companies c ON so.company_id = c.id
     LEFT JOIN operations o ON jc.operation_id = o.id
     LEFT JOIN workstations w ON jc.workstation_id = w.id
     LEFT JOIN users u ON jc.assigned_to = u.id
     WHERE ${whereClause}`;

    const params = {
      id: isUuid ? idOrNo : (isNaN(idOrNo) ? 0 : Number(idOrNo)),
      no: String(idOrNo).trim(),
      likeNo: `%${idOrNo}%`
    };

    const [jcRows] = await pool.query(query, params);

    if (jcRows.length === 0) {
      throw new Error('Job Card not found');
    }

    const jc = jcRows[0];

    // 2. Get Logs
    const [timeLogs] = await pool.query(
      `SELECT tl.*, u.username as operator_name, w.workstation_name 
     FROM job_card_time_logs tl
     LEFT JOIN users u ON tl.operator_id = u.id
     LEFT JOIN workstations w ON tl.workstation_id = w.id
     WHERE tl.job_card_id = ? ORDER BY tl.log_date ASC, tl.start_time ASC`,
      [jc.id]
    );

    const [qualityLogs] = await pool.query(
      `SELECT ql.*, NULL as inspector_name
     FROM job_card_quality_logs ql
     WHERE ql.job_card_id = ? ORDER BY ql.created_at ASC`,
      [jc.id]
    );

    const [downtimeLogs] = await pool.query(
      `SELECT * FROM job_card_downtime_logs WHERE job_card_id = ? ORDER BY start_time ASC`,
      [jc.id]
    );

    // 3. Operational Timeline
    const timeline = [];

    // Work Order Created
    timeline.push({
      title: 'Work Order Created',
      desc: `${jc.wo_number} created for ${jc.item_name}`,
      time: jc.created_at,
      type: 'CREATED',
      completed: true
    });

    // Operation Started
    if (jc.actual_start_date || timeLogs.length > 0) {
      timeline.push({
        title: 'Operation Started',
        desc: `${jc.op_name} operation started at ${jc.workstation_name || 'Workstation'}`,
        time: jc.actual_start_date || (timeLogs[0] ? timeLogs[0].log_date : null),
        type: 'STARTED',
        completed: true
      });
    }

    // Production Running
    if (jc.status === 'IN_PROGRESS') {
      timeline.push({
        title: 'Production Running',
        desc: 'Production execution in progress',
        time: timeLogs.length > 0 ? timeLogs[timeLogs.length - 1].updated_at : new Date(),
        type: 'RUNNING',
        completed: false,
        current: true
      });
    }

    // Production Completed
    if (jc.status === 'COMPLETED' || jc.produced_qty >= jc.planned_qty) {
      timeline.push({
        title: 'Production Completed',
        desc: 'Production completed for planned quantity',
        time: jc.updated_at,
        type: 'COMPLETED',
        completed: true
      });
    }

    // Awaiting Quality / Quality Inspection
    if (qualityLogs.length > 0) {
      const allApproved = qualityLogs.every(l => l.status === 'APPROVED');
      timeline.push({
        title: allApproved ? 'Quality Inspection Completed' : 'Awaiting Quality',
        desc: allApproved ? 'Quality inspection & acceptance finished' : 'Pending quality inspection & acceptance',
        time: qualityLogs[qualityLogs.length - 1].created_at,
        type: 'QUALITY',
        completed: allApproved,
        current: !allApproved
      });
    }

    // 4. Performance Metrics
    const totalActualTimeMinutes = timeLogs.reduce((sum, log) => {
      if (log.start_time && log.end_time) {
        const start = new Date(String(log.start_time).replace(' ', 'T'));
        const end = new Date(String(log.end_time).replace(' ', 'T'));
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          return sum + (end - start) / 60000;
        }
      }
      return sum;
    }, 0);

    const totalDowntimeMinutes = downtimeLogs.reduce((sum, log) => {
      if (log.start_time && log.end_time) {
        const start = new Date(String(log.start_time).replace(' ', 'T'));
        const end = new Date(String(log.end_time).replace(' ', 'T'));
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          return sum + (end - start) / 60000;
        }
      }
      return sum;
    }, 0);

    const stdTimeTotal = (jc.cycle_time || 0) * (jc.planned_qty || 0);
    const efficiency = totalActualTimeMinutes > 0 ? (stdTimeTotal / totalActualTimeMinutes) * 100 : 0;

    return {
      jobCard: jc,
      logs: {
        time: timeLogs,
        quality: qualityLogs,
        downtime: downtimeLogs
      },
      timeline,
      metrics: {
        standardTime: stdTimeTotal,
        actualTime: totalActualTimeMinutes,
        downtime: totalDowntimeMinutes,
        efficiency: Math.round(efficiency),
        variance: Math.max(0, totalActualTimeMinutes - stdTimeTotal),
        performance: efficiency > 90 ? 'High' : efficiency > 70 ? 'Optimal' : 'Needs Attention'
      }
    };
  } catch (error) {
    throw error;
  }
};

module.exports = {
  listJobCards,
  createJobCard,
  updateJobCardProgress,
  getJobCardById,
  updateJobCard,
  deleteJobCard,
  getTimeLogs,
  addTimeLog,
  updateTimeLog,
  deleteTimeLog,
  getQualityLogs,
  addQualityLog,
  updateQualityLog,
  deleteQualityLog,
  getDowntimeLogs,
  addDowntimeLog,
  deleteDowntimeLog,
  getWorkOrderLogs,
  getVendorReceipts,
  getVendorReceiptItems,
  sendVendorReceiptToPayment,
  getQualityLogFullDetails,
  downloadJobCardQcPdf,
  getJobCardDetailAnalysis,
  getActiveAllocations
};
