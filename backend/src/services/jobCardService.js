const crypto = require('crypto');
const pool = require('../config/db');
const generateJobCardQcPdf = require('../utils/generateJobCardQcPdf');

const checkProductionPlanFulfilled = async (connectionOrPool, { jobCardId, workOrderId }) => {
  let planId = null;
  if (workOrderId) {
    const [woRows] = await connectionOrPool.query('SELECT plan_id FROM work_orders WHERE id = ?', [workOrderId]);
    planId = woRows[0]?.plan_id;
  } else if (jobCardId) {
    const [jcRows] = await connectionOrPool.query(
      'SELECT wo.plan_id FROM job_cards jc JOIN work_orders wo ON jc.work_order_id = wo.id WHERE jc.id = ?',
      [jobCardId]
    );
    planId = jcRows[0]?.plan_id;
  }
  
  if (!planId) return true; // No production plan associated, allow it.

  const [mrRows] = await connectionOrPool.query(
    'SELECT status FROM material_requests WHERE plan_id = ? ORDER BY id DESC LIMIT 1',
    [planId]
  );
  if (mrRows.length === 0) return false; // Has plan but no MR exists at all.

  const normalized = (mrRows[0].status || '').toUpperCase().trim();
  return normalized === 'FULFILLED' || normalized === 'COMPLETED';
};

const listJobCards = async () => {
  const [rows] = await pool.query(
    `SELECT jc.id, jc.job_card_no, jc.work_order_id, jc.operation_id, jc.workstation_id, jc.assigned_to, jc.planned_qty, jc.status, jc.execution_mode, jc.public_id,
            jc.sequence_no, jc.actual_start_date, jc.created_at,
            jc.start_time, jc.end_time, jc.produced_qty, jc.accepted_qty, jc.rejected_qty, jc.rework_qty, jc.scrap_qty, jc.remarks, jc.vendor_id, jc.vendor_rate,
            ROW_NUMBER() OVER (PARTITION BY COALESCE(wo.plan_id, wo.parent_wo_id, wo.id) ORDER BY CASE WHEN wo.source_type = 'SA' THEN 0 ELSE 1 END ASC, wo.id ASC, jc.sequence_no ASC, jc.id ASC) as operation_sequence,
            wo.wo_number, wo.item_name, wo.priority, wo.quantity as wo_quantity, wo.status as wo_status, wo.end_date as wo_end_date, wo.source_type,
            wo.plan_id, wo.sales_order_id, wo.parent_wo_id, wo.item_code, wo.sales_order_item_id,
            (SELECT status FROM material_requests WHERE plan_id = wo.plan_id ORDER BY id DESC LIMIT 1) as mr_status,
            COALESCE(soi_parent.description, oi_parent.description, soi_source.description, soi_fallback.description, oi_fallback.description, wo_parent.item_name, wo.source_fg) as source_fg,
            COALESCE(soi.drawing_no, oi.drawing_no, soi_parent.drawing_no, oi_parent.drawing_no, wo.bom_no, wo_parent.bom_no, wo_parent.item_code, wo.item_code) as drawing_no,
            COALESCE(so.project_name, o_dir.project_name) as project_name,
            COALESCE(c.company_name, c_dir.company_name) as client_name,
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
            COALESCE(jc.transferred_qty, (SELECT CASE WHEN status = 'PENDING' THEN 0 ELSE GREATEST(COALESCE(planned_qty, 0), COALESCE(accepted_qty, 0)) END FROM job_cards WHERE work_order_id = jc.work_order_id AND sequence_no > jc.sequence_no ORDER BY sequence_no ASC, id ASC LIMIT 1), 0) as transferred_qty,
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
     LEFT JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
     LEFT JOIN sales_orders so ON (
       (soi.id IS NOT NULL AND soi.sales_order_id = so.id) OR
       (soi.id IS NULL AND wo.sales_order_id = so.id)
     )
     LEFT JOIN companies c ON so.company_id = c.id
     LEFT JOIN orders o_dir ON wo.sales_order_id = o_dir.id AND o_dir.source_type = 'DIRECT' AND (soi.id IS NULL OR soi.sales_order_id != wo.sales_order_id)
     LEFT JOIN companies c_dir ON o_dir.client_id = c_dir.id
     LEFT JOIN order_items oi ON wo.sales_order_item_id = oi.id AND wo.sales_order_id = oi.order_id
     LEFT JOIN operations o ON jc.operation_id = o.id
     LEFT JOIN workstations w ON jc.workstation_id = w.id
     LEFT JOIN users u ON jc.assigned_to = u.id
     LEFT JOIN vendors v ON jc.vendor_id = v.id
     ORDER BY batch_latest_id DESC, CASE WHEN wo.source_type = 'SA' THEN 0 ELSE 1 END ASC, wo.id ASC, jc.sequence_no ASC, jc.id ASC`
  );

  for (const row of rows) {
    const [childWos] = await pool.query(
      'SELECT id, item_code, item_name, quantity FROM work_orders WHERE plan_id = ? AND (parent_wo_id = ? OR source_fg = ?) AND id != ? AND status NOT IN ("DRAFT", "CANCELLED")',
      [row.plan_id, row.work_order_id, row.item_code, row.work_order_id]
    );

    if (childWos.length > 0) {
      row.child_parts = [];
      let minPossibleQty = parseFloat(row.wo_quantity || row.planned_qty || 0);
      const parentQty = minPossibleQty;

      for (const childWo of childWos) {
        const [finalJc] = await pool.query(
          'SELECT COALESCE(transferred_qty, 0) as transferred_qty FROM job_cards WHERE work_order_id = ? ORDER BY sequence_no DESC, id DESC LIMIT 1',
          [childWo.id]
        );
        const transferred = parseFloat(finalJc[0]?.transferred_qty || 0);

        row.child_parts.push({
          item_code: childWo.item_code,
          item_name: childWo.item_name,
          required_qty: parseFloat(childWo.quantity),
          transferred_qty: transferred
        });

        const reqQty = parseFloat(childWo.quantity);
        const possible = reqQty > 0 ? (transferred * parentQty) / reqQty : parentQty;
        if (possible < minPossibleQty) {
          minPossibleQty = possible;
        }
      }

      row.assembly_available_qty = minPossibleQty;
      const [minSeqRow] = await pool.query(
        'SELECT MIN(sequence_no) as min_seq FROM job_cards WHERE work_order_id = ?',
        [row.work_order_id]
      );
      const isFirstOp = row.sequence_no === minSeqRow[0]?.min_seq;

      row.is_first_op = isFirstOp;
      row.is_assembly_waiting = isFirstOp && row.child_parts.some(cp => cp.transferred_qty === 0);
    } else {
      row.child_parts = null;
      row.assembly_available_qty = parseFloat(row.planned_qty || 0);
      row.is_assembly_waiting = false;
      row.is_first_op = false;
    }
  }

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


const checkSequenceOverlap = async (id, workOrderId, startDateTime, endDateTime) => {
  return null; // Disabled to allow flexible scheduling of operations on the same day/times

  const currentStart = new Date(startStr.replace(' ', 'T'));
  const currentEnd = new Date(endStr.replace(' ', 'T'));

  if (isNaN(currentStart.getTime()) || isNaN(currentEnd.getTime())) {
    return null;
  }

  // Get current item's details (item_code and drawing_no)
  let currentItemCode = '';
  let currentDrawingNo = '';
  let currentSequenceNo = 0;

  if (id) {
    const [jcRow] = await pool.query(
      `SELECT jc.sequence_no, wo.item_code, 
              COALESCE(soi.drawing_no, oi.drawing_no, wo.bom_no, wo.item_code) as drawing_no
       FROM job_cards jc
       JOIN work_orders wo ON jc.work_order_id = wo.id
       LEFT JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
       LEFT JOIN order_items oi ON wo.sales_order_item_id = oi.id AND wo.sales_order_id = oi.order_id
       WHERE jc.id = ?`,
      [id]
    );
    if (jcRow.length > 0) {
      currentSequenceNo = jcRow[0].sequence_no;
      currentItemCode = jcRow[0].item_code;
      currentDrawingNo = jcRow[0].drawing_no;
    }
  } else {
    const [woRow] = await pool.query(
      `SELECT wo.item_code, 
              COALESCE(soi.drawing_no, oi.drawing_no, wo.bom_no, wo.item_code) as drawing_no
       FROM work_orders wo
       LEFT JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
       LEFT JOIN order_items oi ON wo.sales_order_item_id = oi.id AND wo.sales_order_id = oi.order_id
       WHERE wo.id = ?`,
      [workOrderId]
    );
    if (woRow.length > 0) {
      currentItemCode = woRow[0].item_code;
      currentDrawingNo = woRow[0].drawing_no;
    }

    const [seqRow] = await pool.query(
      `SELECT COALESCE(MAX(jc.sequence_no), 0) as maxSeq 
       FROM job_cards jc
       JOIN work_orders wo ON jc.work_order_id = wo.id
       LEFT JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
       LEFT JOIN order_items oi ON wo.sales_order_item_id = oi.id AND wo.sales_order_id = oi.order_id
       WHERE jc.work_order_id = ? AND jc.status != 'CANCELLED'
         AND (wo.item_code = ? OR COALESCE(soi.drawing_no, oi.drawing_no, wo.bom_no, wo.item_code) = ?)`,
      [workOrderId, currentItemCode, currentDrawingNo]
    );
    currentSequenceNo = (seqRow[0]?.maxSeq || 0) + 1;
  }

  // Fetch other active job cards of the same work order
  const query = `
    SELECT jc.id, jc.job_card_no, jc.sequence_no, jc.start_time, jc.end_time,
           wo.item_code, 
           COALESCE(soi.drawing_no, oi.drawing_no, wo.bom_no, wo.item_code) as drawing_no
    FROM job_cards jc
    JOIN work_orders wo ON jc.work_order_id = wo.id
    LEFT JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
    LEFT JOIN order_items oi ON wo.sales_order_item_id = oi.id AND wo.sales_order_id = oi.order_id
    WHERE jc.work_order_id = ? 
      AND jc.status != 'CANCELLED' 
      AND jc.start_time IS NOT NULL 
      AND jc.end_time IS NOT NULL
      ${id ? 'AND jc.id != ?' : ''}
  `;
  const params = id ? [workOrderId, id] : [workOrderId];
  const [rows] = await pool.query(query, params);

  for (const row of rows) {
    const isSameRouting = row.item_code === currentItemCode;
    if (!isSameRouting) continue;

    const otherStart = new Date(row.start_time);
    const otherEnd = new Date(row.end_time);
    if (isNaN(otherStart.getTime()) || isNaN(otherEnd.getTime())) continue;

    // 1. Enforce no time overlap at all
    const isOverlap = currentStart < otherEnd && currentEnd > otherStart;
    if (isOverlap) {
      return `Time overlap detected. Another Job Card for this Work Order is already scheduled during the selected time period.`;
    }

    // 2. Enforce dependent operation sequence ordering
    if (row.sequence_no < currentSequenceNo) {
      // current is AFTER row, so currentStart must be >= otherEnd
      if (currentStart < otherEnd) {
        return `Time overlap detected. Another Job Card for this Work Order is already scheduled during the selected time period.`;
      }
    } else if (row.sequence_no > currentSequenceNo) {
      // current is BEFORE row, so currentEnd must be <= otherStart
      if (currentEnd > otherStart) {
        return `Time overlap detected. Another Job Card for this Work Order is already scheduled during the selected time period.`;
      }
    }
  }

  return null;
};


const checkOverlap = async (id, workstationId, assignedTo, startDateTime, endDateTime, executionMode) => {
  return null;

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

  // Check sequence timing overlap
  const seqConflictMessage = await checkSequenceOverlap(null, workOrderId, startDateTime, endDateTime);
  if (seqConflictMessage) {
    throw new Error(seqConflictMessage);
  }

  if (status === 'IN_PROGRESS' || producedQty > 0 || acceptedQty > 0) {
    const isPlanFulfilled = await checkProductionPlanFulfilled(pool, { workOrderId });
    if (!isPlanFulfilled) {
      throw new Error("Cannot start Job Card: The associated production plan does not have a fulfilled Material Requirement.");
    }
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

  // Get sequence_no for manual creation
  const [woRow] = await pool.query(
    `SELECT wo.item_code, 
            COALESCE(soi.drawing_no, oi.drawing_no, wo.bom_no, wo.item_code) as drawing_no
     FROM work_orders wo
     LEFT JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
     LEFT JOIN order_items oi ON wo.sales_order_item_id = oi.id AND wo.sales_order_id = oi.order_id
     WHERE wo.id = ?`,
    [workOrderId]
  );
  const currentItemCode = woRow[0]?.item_code || '';
  const currentDrawingNo = woRow[0]?.drawing_no || '';

  const [seqRow] = await pool.query(
    `SELECT COALESCE(MAX(jc.sequence_no), 0) as maxSeq 
     FROM job_cards jc
     JOIN work_orders wo ON jc.work_order_id = wo.id
     LEFT JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
     LEFT JOIN order_items oi ON wo.sales_order_item_id = oi.id AND wo.sales_order_id = oi.order_id
     WHERE jc.work_order_id = ? AND jc.status != 'CANCELLED'
       AND (wo.item_code = ? OR COALESCE(soi.drawing_no, oi.drawing_no, wo.bom_no, wo.item_code) = ?)`,
    [workOrderId, currentItemCode, currentDrawingNo]
  );
  const sequenceNo = (seqRow[0]?.maxSeq || 0) + 1;

  const publicId = crypto.randomUUID();
  const [result] = await pool.execute(
    `INSERT INTO job_cards 
     (job_card_no, work_order_id, operation_id, workstation_id, assigned_to, planned_qty, remarks, 
      status, execution_mode, vendor_id, vendor_rate, produced_qty, accepted_qty, start_time, end_time, public_id, sequence_no)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      jobCardNo || null, workOrderId, operationId || null, workstationId || null, assignedTo || null, plannedQty, remarks,
      status || 'PENDING', executionMode || 'In-house', vendorId || null, vendorRate || 0, producedQty || 0, acceptedQty || 0,
      startDateTime ? startDateTime.replace('T', ' ') : null,
      endDateTime ? endDateTime.replace('T', ' ') : null,
      publicId,
      sequenceNo
    ]
  );

  return result.insertId;
};

const updateJobCardProgress = async (id, data) => {
  const maxRetries = 3;
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await updateJobCardProgressInternal(connection, id, data);
      await connection.commit();
      return;
    } catch (error) {
      await connection.rollback();
      if (error.code === 'ER_LOCK_DEADLOCK' && attempt < maxRetries) {
        console.warn(`[updateJobCardProgress] Deadlock detected on attempt ${attempt}. Retrying in 100ms...`);
        connection.release();
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      console.error('Error updating job card progress:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
};

const updateJobCardProgressInternal = async (connection, id, data) => {
  const { producedQty, acceptedQty, rejectedQty, scrapQty, status, startTime, endTime, workstationId, assignedTo, targetWarehouseId, executionType,
    carrierName, trackingNumber, shippingNotes, dispatchDate, dispatchMode, dispatchQty, plannedQty, sourceJobCardId } = data;

  try {

    // Fetch the current state of this job card to allow carrying forward configured operator/workstation and status transition
    const [currentJcRow] = await connection.query(
      'SELECT status, assigned_to, workstation_id, dispatch_qty FROM job_cards WHERE id = ?',
      [id]
    );
    if (currentJcRow.length === 0) {
      throw new Error('Job Card not found');
    }
    const currentJcStatus = currentJcRow[0].status;
    const currentAssignedTo = currentJcRow[0].assigned_to;
    const currentWorkstationId = currentJcRow[0].workstation_id;
    const prevDispatchQty = parseFloat(currentJcRow[0].dispatch_qty || 0);

    // Carry forward configured values if they are already set in the DB but incoming updates are null/undefined
    let finalAssignedTo = assignedTo;
    if ((finalAssignedTo === undefined || finalAssignedTo === null) && currentAssignedTo) {
      finalAssignedTo = currentAssignedTo;
    }

    let finalWorkstationId = workstationId;
    if ((finalWorkstationId === undefined || finalWorkstationId === null) && currentWorkstationId) {
      finalWorkstationId = currentWorkstationId;
    }

    // Auto-update status from PENDING to IN_PROGRESS when quantity is transferred (i.e. plannedQty is set)
    let finalStatus = status;
    if (!finalStatus && currentJcStatus === 'PENDING' && plannedQty !== undefined) {
      finalStatus = 'IN_PROGRESS';
    }

    // Fetch Job Card and Work Order details to check assembly component availability
    const [jcDetails] = await connection.query(
      `SELECT jc.sequence_no, jc.planned_qty, jc.status,
              wo.id as work_order_id, wo.plan_id, wo.item_code, wo.quantity as wo_quantity
       FROM job_cards jc
       JOIN work_orders wo ON jc.work_order_id = wo.id
       WHERE jc.id = ?`,
      [id]
    );
    if (jcDetails.length > 0) {
      const jcDetail = jcDetails[0];
      const [childWos] = await connection.query(
        'SELECT id, item_code, item_name, quantity FROM work_orders WHERE plan_id = ? AND (parent_wo_id = ? OR source_fg = ?) AND id != ? AND status NOT IN ("DRAFT", "CANCELLED")',
        [jcDetail.plan_id, jcDetail.work_order_id, jcDetail.item_code, jcDetail.work_order_id]
      );

      if (childWos.length > 0) {
        let minPossibleQty = parseFloat(jcDetail.wo_quantity || jcDetail.planned_qty || 0);
        const parentQty = minPossibleQty;
        const childParts = [];

        for (const childWo of childWos) {
          const [finalJc] = await connection.query(
            'SELECT COALESCE(transferred_qty, 0) as transferred_qty FROM job_cards WHERE work_order_id = ? ORDER BY sequence_no DESC, id DESC LIMIT 1',
            [childWo.id]
          );
          const transferred = parseFloat(finalJc[0]?.transferred_qty || 0);
          const reqQty = parseFloat(childWo.quantity);
          childParts.push({
            required_qty: reqQty,
            transferred_qty: transferred
          });

          const possible = reqQty > 0 ? (transferred * parentQty) / reqQty : parentQty;
          if (possible < minPossibleQty) {
            minPossibleQty = possible;
          }
        }

        const assemblyAvailableQty = minPossibleQty;
        const [minSeqRow] = await connection.query(
          'SELECT MIN(sequence_no) as min_seq FROM job_cards WHERE work_order_id = ?',
          [jcDetail.work_order_id]
        );
        const isFirstOp = jcDetail.sequence_no === minSeqRow[0]?.min_seq;

        const isAssemblyWaiting = isFirstOp && childParts.some(cp => cp.transferred_qty === 0);
        if (isAssemblyWaiting) {
          if (plannedQty !== undefined) {
            // Bypass the validation blocks during quantity transfer by keeping it PENDING and unassigned
            finalStatus = currentJcStatus;
            finalAssignedTo = currentAssignedTo;
            finalWorkstationId = currentWorkstationId;
          } else {
            const isAssigning = (finalWorkstationId !== undefined && finalWorkstationId !== null && finalWorkstationId !== currentWorkstationId) || 
                                (finalAssignedTo !== undefined && finalAssignedTo !== null && finalAssignedTo !== currentAssignedTo);
            const isStartingOrCompleting = (finalStatus === 'IN_PROGRESS' || finalStatus === 'COMPLETED');
            if (isAssigning || isStartingOrCompleting) {
              throw new Error('Cannot start, assign workstation/operator, or update status: Assembly is waiting for components.');
            }
          }
        }
      }
    }

    if (finalStatus === 'IN_PROGRESS' || producedQty !== undefined || acceptedQty !== undefined) {
      const isPlanFulfilled = await checkProductionPlanFulfilled(connection, { jobCardId: id });
      if (!isPlanFulfilled) {
        throw new Error("Cannot start or enter production details: The associated production plan does not have a fulfilled Material Requirement.");
      }
    }

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
      if (currentJcStatus === 'PENDING') {
        updates.push('planned_qty = ?');
      } else {
        updates.push('planned_qty = COALESCE(planned_qty, 0) + ?');
      }
      params.push(plannedQty);
    }
    if (rejectedQty !== undefined) {
      updates.push('rejected_qty = ?');
      params.push(rejectedQty);
    }
    if (scrapQty !== undefined) {
      updates.push('scrap_qty = ?');
      params.push(scrapQty);
    }
    if (finalStatus === 'COMPLETED') {
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
        const carryQty = parseFloat(
          acceptedQty !== undefined ? acceptedQty :
          (producedQty !== undefined ? producedQty :
          (accepted_qty || produced_qty || 0))
        );

        // Find the next job card in sequence for this work order
        const [nextJcRows] = await connection.query(
          'SELECT id, status FROM job_cards WHERE work_order_id = ? AND sequence_no > ? ORDER BY sequence_no ASC, id ASC LIMIT 1',
          [work_order_id, sequence_no]
        );

        let targetJcId = null;
        let isParentJc = false;
        let targetJcStatus = null;
        let parentWoId = null;

        if (nextJcRows.length > 0) {
          targetJcId = nextJcRows[0].id;
          targetJcStatus = nextJcRows[0].status;
        } else {
          // If no next operation in the same work order, check if this is a child work order
          const [woRows] = await connection.query(
            'SELECT parent_wo_id, plan_id, source_fg FROM work_orders WHERE id = ?',
            [work_order_id]
          );
          parentWoId = woRows[0]?.parent_wo_id;
          const planId = woRows[0]?.plan_id;
          const sourceFg = woRows[0]?.source_fg;
          
          if (!parentWoId && planId && sourceFg) {
            // Fallback: Find parent work order under the same plan whose source_type is FG
            const [parentWoRows] = await connection.query(
              'SELECT id FROM work_orders WHERE plan_id = ? AND source_type = "FG" LIMIT 1',
              [planId]
            );
            if (parentWoRows.length > 0) {
              parentWoId = parentWoRows[0].id;
            }
          }

          if (parentWoId) {
            // Find the first job card in the parent work order
            const [parentJcRows] = await connection.query(
              'SELECT id, status FROM job_cards WHERE work_order_id = ? ORDER BY sequence_no ASC, id ASC LIMIT 1',
              [parentWoId]
            );
            if (parentJcRows.length > 0) {
              targetJcId = parentJcRows[0].id;
              targetJcStatus = parentJcRows[0].status;
              isParentJc = true;
            }
          }
        }

        if (targetJcId) {
          if (isParentJc) {
            // Calculate parent available qty based on child parts
            const [parentWo] = await connection.query('SELECT plan_id, item_code, quantity FROM work_orders WHERE id = ?', [parentWoId]);
            const parentItemCode = parentWo[0]?.item_code;
            const parentPlanId = parentWo[0]?.plan_id;
            const parentPlannedQty = parseFloat(parentWo[0]?.quantity || 0);

            const [childWos] = await connection.query(
              'SELECT id, quantity FROM work_orders WHERE plan_id = ? AND (parent_wo_id = ? OR source_fg = ?) AND id != ? AND status NOT IN ("DRAFT", "CANCELLED")',
              [parentPlanId, parentWoId, parentItemCode, parentWoId]
            );

            let minPossibleQty = parentPlannedQty;
            const childParts = [];
            for (const childWo of childWos) {
              let transferred = 0;
              if (childWo.id === work_order_id) {
                transferred = carryQty;
              } else {
                const [finalJc] = await connection.query(
                  'SELECT COALESCE(transferred_qty, 0) as transferred_qty FROM job_cards WHERE work_order_id = ? ORDER BY sequence_no DESC, id DESC LIMIT 1',
                  [childWo.id]
                );
                transferred = parseFloat(finalJc[0]?.transferred_qty || 0);
              }
              const reqQty = parseFloat(childWo.quantity);
              childParts.push({
                required_qty: reqQty,
                transferred_qty: transferred
              });
              const possible = reqQty > 0 ? (transferred * parentPlannedQty) / reqQty : parentPlannedQty;
              if (possible < minPossibleQty) {
                minPossibleQty = possible;
              }
            }

            const assemblyAvailableQty = minPossibleQty;
            const isWaiting = childParts.some(cp => cp.transferred_qty === 0);

            if (targetJcStatus === 'PENDING') {
              if (!isWaiting) {
                await connection.execute(
                  "UPDATE job_cards SET planned_qty = ?, status = 'IN_PROGRESS', actual_start_date = COALESCE(actual_start_date, CURRENT_DATE()) WHERE id = ?",
                  [assemblyAvailableQty, targetJcId]
                );
              } else {
                await connection.execute(
                  "UPDATE job_cards SET planned_qty = ? WHERE id = ?",
                  [assemblyAvailableQty, targetJcId]
                );
              }
            } else {
              await connection.execute(
                'UPDATE job_cards SET planned_qty = ? WHERE id = ?',
                [assemblyAvailableQty, targetJcId]
              );
            }
          }


          // Update transferred_qty on the current job card
          await connection.execute(
            'UPDATE job_cards SET transferred_qty = ? WHERE id = ?',
            [carryQty, id]
          );
        }
      }



      updates.push('status = ?');
      params.push(finalStatus);
      if (finalStatus === 'IN_PROGRESS') {
        updates.push('actual_start_date = COALESCE(actual_start_date, CURRENT_DATE())');
      }
    } else if (finalStatus) {
      updates.push('status = ?');
      params.push(finalStatus);
      if (finalStatus === 'IN_PROGRESS') {
        updates.push('actual_start_date = COALESCE(actual_start_date, CURRENT_DATE())');
      }
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

    if (finalStatus === 'IN_PROGRESS') {
      const [jcData] = await connection.query('SELECT workstation_id, assigned_to FROM job_cards WHERE id = ?', [id]);
      if (jcData.length === 0) throw new Error('Job Card not found');

      const checkWorkstationId = finalWorkstationId || jcData[0].workstation_id;
      const checkAssignedTo = finalAssignedTo || jcData[0].assigned_to;

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
               AND tl.job_card_id != ?
               AND jc.status != 'CANCELLED' AND jc.status != 'COMPLETED'`,
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
               AND tl.job_card_id != ?
               AND jc.status != 'CANCELLED' AND jc.status != 'COMPLETED'`,
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

    if (finalWorkstationId !== undefined) {
      updates.push('workstation_id = ?');
      params.push(finalWorkstationId || null);
    }
    if (finalAssignedTo !== undefined) {
      updates.push('assigned_to = ?');
      params.push(finalAssignedTo || null);
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

    if (sourceJobCardId && plannedQty !== undefined) {
      await connection.execute(
        'UPDATE job_cards SET transferred_qty = COALESCE(transferred_qty, 0) + ? WHERE id = ?',
        [plannedQty, sourceJobCardId]
      );
    }

    // Get operation details to see if it is a shipment operation
    const [opRow] = await connection.query(
      'SELECT COALESCE(o.operation_name, jc.operation_name) as operation_name, o.operation_type, jc.execution_mode, jc.work_order_id FROM job_cards jc LEFT JOIN operations o ON jc.operation_id = o.id WHERE jc.id = ?',
      [id]
    );
    const isShipment = opRow.length > 0 && (
      String(opRow[0].operation_name || '').toLowerCase() === 'shipment' ||
      String(opRow[0].operation_name || '').toLowerCase() === 'dispatch' ||
      String(opRow[0].operation_type || '').toLowerCase() === 'dispatch'
    );

    if (isShipment && opRow.length > 0) {
      const workOrderId = opRow[0].work_order_id;
      const [woRow] = await connection.query(
        'SELECT sales_order_id, sales_order_item_id FROM work_orders WHERE id = ?',
        [workOrderId]
      );
      let salesOrderId = woRow.length > 0 ? woRow[0].sales_order_id : null;
      const salesOrderItemId = woRow.length > 0 ? woRow[0].sales_order_item_id : null;
      if (salesOrderItemId) {
        const [soiRow] = await connection.query(
          'SELECT sales_order_id FROM sales_order_items WHERE id = ?',
          [salesOrderItemId]
        );
        if (soiRow.length > 0 && soiRow[0].sales_order_id) {
          salesOrderId = soiRow[0].sales_order_id;
        }
      }

      if (salesOrderId) {
        const newDispatchQtyVal = dispatchQty !== undefined ? parseFloat(dispatchQty || 0) : 0;

        // If this is a new dispatch (new dispatch qty is greater than previous dispatch qty)
        if (newDispatchQtyVal > prevDispatchQty) {
          // Count existing shipment orders for this job card to create a unique suffix
          const [existingCount] = await connection.query(
            'SELECT count(*) as count FROM shipment_orders WHERE job_card_id = ?',
            [id]
          );
          const count = existingCount[0].count;

          let [orderRows] = await connection.query(
            `SELECT 
              so.company_id, 
              c.company_name,
              so.target_dispatch_date, 
              so.production_priority,
              ct.email as customer_email,
              ct.phone as customer_phone,
              (SELECT CONCAT_WS(', ', line1, line2, city, state, pincode) FROM company_addresses WHERE company_id = so.company_id AND address_type = 'SHIPPING' LIMIT 1) as shipping_address,
              (SELECT CONCAT_WS(', ', line1, line2, city, state, pincode) FROM company_addresses WHERE company_id = so.company_id AND address_type = 'BILLING' LIMIT 1) as billing_address
            FROM sales_orders so
            LEFT JOIN companies c ON so.company_id = c.id
            LEFT JOIN (
              SELECT company_id, email, phone,
                     ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY contact_type = 'PRIMARY' DESC, id ASC) as rn
              FROM contacts
            ) ct ON ct.company_id = so.company_id AND ct.rn = 1
            WHERE so.id = ?`,
            [salesOrderId]
          );

          if (orderRows.length === 0) {
            const [altOrderRows] = await connection.query(
              `SELECT 
                o.client_id as company_id, 
                c.company_name,
                o.project_name,
                ct.email as customer_email,
                ct.phone as customer_phone,
                (SELECT CONCAT_WS(', ', line1, line2, city, state, pincode) FROM company_addresses WHERE company_id = o.client_id AND address_type = 'SHIPPING' LIMIT 1) as shipping_address,
                (SELECT CONCAT_WS(', ', line1, line2, city, state, pincode) FROM company_addresses WHERE company_id = o.client_id AND address_type = 'BILLING' LIMIT 1) as billing_address,
                o.delivery_date as target_dispatch_date,
                'NORMAL' as production_priority,
                o.status
              FROM orders o
              LEFT JOIN companies c ON o.client_id = c.id
              LEFT JOIN (
                SELECT company_id, email, phone,
                       ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY contact_type = 'PRIMARY' DESC, id ASC) as rn
                FROM contacts
              ) ct ON ct.company_id = o.client_id AND ct.rn = 1
              WHERE o.id = ?`,
              [salesOrderId]
            );

            if (altOrderRows.length > 0) {
              const altOrder = altOrderRows[0];
              console.log(`[jobCardService/updateProgress] Found in orders table. Syncing to sales_orders to satisfy foreign key...`);
              await connection.execute(
                `INSERT IGNORE INTO sales_orders (id, company_id, so_number, target_dispatch_date, status, current_department, request_accepted, is_sales_order, project_name)
                 VALUES (?, ?, ?, ?, ?, 'SHIPMENT', 1, 1, ?)`,
                [
                  salesOrderId,
                  altOrder.company_id,
                  `ORD-${String(salesOrderId).padStart(4, '0')}`,
                  altOrder.target_dispatch_date,
                  'READY_FOR_SHIPMENT',
                  altOrder.project_name || null
                ]
              );
              orderRows = altOrderRows;
            }
          }

          const order = orderRows[0];

          const date = new Date();
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');

          // Generate a unique shipment code. Append suffix only if there are already existing shipment orders.
          let shipmentCode = `SHP-${year}${month}-SO${String(salesOrderId).padStart(4, '0')}-JC${id}`;
          if (count > 0) {
            shipmentCode += `-${count + 1}`;
          }

          const dispatchIncrement = newDispatchQtyVal - prevDispatchQty;

          await connection.execute(
            `INSERT INTO shipment_orders (
              shipment_code, sales_order_id, sales_order_item_id, job_card_id, customer_id, customer_name, 
              customer_phone, customer_email, shipping_address, billing_address,
              dispatch_target_date, priority, quantity, status
            )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_ACCEPTANCE')`,
            [
              shipmentCode,
              salesOrderId,
              salesOrderItemId,
              id,
              order?.company_id || null,
              order?.company_name || null,
              order?.customer_phone || null,
              order?.customer_email || null,
              order?.shipping_address || null,
              order?.billing_address || null,
              order?.target_dispatch_date || null,
              order?.production_priority || 'NORMAL',
              dispatchIncrement
            ]
          );

          await connection.execute(
            "UPDATE sales_orders SET status = 'READY_FOR_SHIPMENT', current_department = 'SHIPMENT', updated_at = NOW() WHERE id = ?",
            [salesOrderId]
          );
        }
      }
    }

    const affectedWoIds = [];
    if (finalStatus === 'COMPLETED' && isShipment && opRow.length > 0) {
      const workOrderId = opRow[0].work_order_id;
      affectedWoIds.push(workOrderId);

      await connection.execute(
        'UPDATE job_cards SET status = "COMPLETED" WHERE work_order_id = ? AND status != "COMPLETED"',
        [workOrderId]
      );

      // Find child/sub-assembly work orders under the same plan
      const [parentWoRows] = await connection.query(
        'SELECT id, plan_id, item_code FROM work_orders WHERE id = ?',
        [workOrderId]
      );
      if (parentWoRows.length > 0) {
        const { id: parentId, plan_id: planId, item_code: parentItemCode } = parentWoRows[0];
        
        // Find child work orders by parent_wo_id or source_fg matching parent's item_code under the same plan
        const [childWoRows] = await connection.query(
          'SELECT id FROM work_orders WHERE plan_id = ? AND (parent_wo_id = ? OR source_fg = ?)',
          [planId, parentId, parentItemCode]
        );
        
        if (childWoRows.length > 0) {
          const childWoIds = childWoRows.map(row => row.id);
          affectedWoIds.push(...childWoIds);

          // Complete all job cards for these child work orders
          await connection.query(
            `UPDATE job_cards SET status = "COMPLETED" WHERE work_order_id IN (${childWoIds.join(',')}) AND status != "COMPLETED"`
          );
        }
      }
    } else {
      const [jcRows] = await connection.query('SELECT work_order_id FROM job_cards WHERE id = ?', [id]);
      if (jcRows.length > 0) {
        affectedWoIds.push(jcRows[0].work_order_id);
      }
    }

    // Update Work Order status based on Job Cards
    for (const woId of affectedWoIds) {
      const [allJcs] = await connection.query('SELECT status FROM job_cards WHERE work_order_id = ?', [woId]);

      let newWoStatus = 'RELEASED';
      if (allJcs.some(jc => jc.status === 'IN_PROGRESS')) {
        newWoStatus = 'IN_PROGRESS';
      } else if (allJcs.every(jc => jc.status === 'COMPLETED')) {
        newWoStatus = 'COMPLETED';
      } else if (allJcs.some(jc => jc.status === 'COMPLETED' || jc.status === 'PENDING')) {
        const hasStarted = allJcs.some(jc => jc.status === 'COMPLETED');
        if (hasStarted) newWoStatus = 'IN_PROGRESS';
      }

      await connection.execute('UPDATE work_orders SET status = ? WHERE id = ?', [newWoStatus, woId]);
      await syncReworkQuantities(woId, connection);

      if (newWoStatus === 'COMPLETED') {
        const [woRow] = await connection.query(
          'SELECT plan_id, production_plan_item_id FROM work_orders WHERE id = ?',
          [woId]
        );
        if (woRow.length > 0) {
          const planId = woRow[0].plan_id;
          const ppiId = woRow[0].production_plan_item_id;

          if (ppiId) {
            await connection.execute(
              'UPDATE production_plan_items SET status = "COMPLETED" WHERE id = ?',
              [ppiId]
            );
          }

          if (planId) {
            const [woRows] = await connection.query(
              'SELECT id, status FROM work_orders WHERE plan_id = ?',
              [planId]
            );
            const allCompleted = woRows.every(wo => wo.status === 'COMPLETED' || wo.status === 'CANCELLED');
            if (allCompleted) {
              await connection.execute(
                'UPDATE production_plans SET status = "COMPLETED" WHERE id = ?',
                [planId]
              );
            }
          }
        }
      }
    }

  } catch (error) {
    throw error;
  }
};

const getJobCardById = async (id) => {
  const isUuid = typeof id === 'string' && id.length === 36;
  const whereClause = isUuid ? 'jc.public_id = ?' : 'jc.id = ?';
  const [rows] = await pool.query(
    `SELECT jc.id, jc.job_card_no, jc.work_order_id, jc.operation_id, jc.workstation_id, jc.assigned_to, jc.planned_qty,
            jc.produced_qty, jc.accepted_qty, jc.rejected_qty, jc.rework_qty, jc.scrap_qty,
            jc.actual_start_date, jc.start_time, jc.end_time, jc.status, jc.remarks, jc.created_at, jc.updated_at,
            jc.std_time, jc.time_uom, jc.hourly_rate, jc.operation_name, jc.execution_mode, jc.vendor_id, jc.vendor_rate,
            jc.sequence_no, jc.target_warehouse_id, jc.jc_number, jc.cycle_time, jc.setup_time, jc.public_id,
            jc.carrier_name, jc.tracking_number, jc.shipping_notes, jc.dispatch_date, jc.dispatch_mode,
            (SELECT id FROM outward_challans WHERE job_card_id = jc.id ORDER BY created_at DESC LIMIT 1) as outward_challan_id,
            (SELECT challan_number FROM outward_challans WHERE job_card_id = jc.id ORDER BY created_at DESC LIMIT 1) as outward_challan_no,
            (SELECT SUM(dispatch_qty) FROM outward_challans WHERE job_card_id = jc.id) as dispatch_qty,
            (SELECT status FROM material_requests WHERE plan_id = wo.plan_id ORDER BY id DESC LIMIT 1) as mr_status,
            wo.plan_id, wo.quantity as wo_quantity, wo.wo_number, wo.item_name, wo.item_code, wo.sales_order_item_id, wo.parent_wo_id, wo.source_type,
            COALESCE(soi.drawing_no, oi.drawing_no, wo.bom_no, wo.item_code) as drawing_no,
            COALESCE(o.operation_name, jc.operation_name) as operation_name, 
            COALESCE(NULLIF(jc.std_time, 0), o.std_time, 0) as std_time, 
            COALESCE(NULLIF(jc.cycle_time, 0), CASE WHEN o.time_uom = 'Min' THEN o.std_time ELSE 0 END, 0) as cycle_time,
            COALESCE(NULLIF(jc.setup_time, 0), 0) as setup_time,
            COALESCE(jc.time_uom, o.time_uom, 'Min') as time_uom, 
            COALESCE(NULLIF(jc.hourly_rate, 0), o.hourly_rate, 0) as hourly_rate, 
            w.workstation_name, u.username as operator_name, v.vendor_name,
            COALESCE(so.project_name, o_dir.project_name) as project_name,
            COALESCE(c.company_name, c_dir.company_name) as client_name,
            COALESCE(so.shipping_address, (SELECT CONCAT_WS(', ', line1, line2, city, state, pincode) FROM company_addresses WHERE company_id = o_dir.client_id AND address_type = 'SHIPPING' LIMIT 1)) as shipping_address,
            COALESCE(jc.transferred_qty, (SELECT CASE WHEN status = 'PENDING' THEN 0 ELSE GREATEST(COALESCE(planned_qty, 0), COALESCE(accepted_qty, 0)) END FROM job_cards WHERE work_order_id = jc.work_order_id AND sequence_no > jc.sequence_no ORDER BY sequence_no ASC, id ASC LIMIT 1), 0) as transferred_qty
     FROM job_cards jc
     JOIN work_orders wo ON jc.work_order_id = wo.id
     LEFT JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
     LEFT JOIN sales_orders so ON (
       (soi.id IS NOT NULL AND soi.sales_order_id = so.id) OR
       (soi.id IS NULL AND wo.sales_order_id = so.id)
     )
     LEFT JOIN companies c ON so.company_id = c.id
     LEFT JOIN orders o_dir ON wo.sales_order_id = o_dir.id AND o_dir.source_type = 'DIRECT' AND (soi.id IS NULL OR soi.sales_order_id != wo.sales_order_id)
     LEFT JOIN companies c_dir ON o_dir.client_id = c_dir.id
     LEFT JOIN operations o ON jc.operation_id = o.id
     LEFT JOIN workstations w ON jc.workstation_id = w.id
     LEFT JOIN users u ON jc.assigned_to = u.id
     LEFT JOIN vendors v ON jc.vendor_id = v.id
     LEFT JOIN order_items oi ON wo.sales_order_item_id = oi.id AND wo.sales_order_id = oi.order_id
     WHERE ${whereClause}`,
    [id]
  );
  
  if (rows.length > 0) {
    const row = rows[0];
    const [childWos] = await pool.query(
      'SELECT id, item_code, item_name, quantity FROM work_orders WHERE plan_id = ? AND (parent_wo_id = ? OR source_fg = ?) AND id != ? AND status NOT IN ("DRAFT", "CANCELLED")',
      [row.plan_id, row.work_order_id, row.item_code, row.work_order_id]
    );

    if (childWos.length > 0) {
      row.child_parts = [];
      let minPossibleQty = parseFloat(row.wo_quantity || row.planned_qty || 0);
      const parentQty = minPossibleQty;

      for (const childWo of childWos) {
        const [finalJc] = await pool.query(
          'SELECT COALESCE(transferred_qty, 0) as transferred_qty FROM job_cards WHERE work_order_id = ? ORDER BY sequence_no DESC, id DESC LIMIT 1',
          [childWo.id]
        );
        const transferred = parseFloat(finalJc[0]?.transferred_qty || 0);

        row.child_parts.push({
          item_code: childWo.item_code,
          item_name: childWo.item_name,
          required_qty: parseFloat(childWo.quantity),
          transferred_qty: transferred
        });

        const reqQty = parseFloat(childWo.quantity);
        const possible = reqQty > 0 ? (transferred * parentQty) / reqQty : parentQty;
        if (possible < minPossibleQty) {
          minPossibleQty = possible;
        }
      }

      row.assembly_available_qty = minPossibleQty;
      const [minSeqRow] = await pool.query(
        'SELECT MIN(sequence_no) as min_seq FROM job_cards WHERE work_order_id = ?',
        [row.work_order_id]
      );
      const isFirstOp = row.sequence_no === minSeqRow[0]?.min_seq;

      row.is_first_op = isFirstOp;
      row.is_assembly_waiting = isFirstOp && row.child_parts.some(cp => cp.transferred_qty === 0);
    } else {
      row.child_parts = null;
      row.assembly_available_qty = parseFloat(row.planned_qty || 0);
      row.is_assembly_waiting = false;
      row.is_first_op = false;
    }
  }

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

const getProductionStartDate = async (connection, jobCardId) => {
  const [jcRow] = await connection.query(
    `SELECT wo.plan_id, jc.work_order_id FROM job_cards jc JOIN work_orders wo ON jc.work_order_id = wo.id WHERE jc.id = ?`,
    [jobCardId]
  );
  if (jcRow.length === 0) return new Date().toISOString().slice(0, 10);

  const planId = jcRow[0].plan_id;
  const workOrderId = jcRow[0].work_order_id;

  const query = `
    SELECT MIN(DATE(COALESCE(jc.actual_start_date, jc.start_time, jc.created_at))) as prod_start_date
    FROM job_cards jc
    JOIN work_orders wo ON jc.work_order_id = wo.id
    WHERE (wo.plan_id = ? AND wo.plan_id IS NOT NULL)
       OR (jc.work_order_id = ? AND wo.plan_id IS NULL)
  `;
  const params = [planId || null, workOrderId];
  const [rows] = await connection.query(query, params);

  let dateVal = rows[0]?.prod_start_date;
  if (dateVal) {
    if (dateVal instanceof Date) {
      dateVal = dateVal.toISOString().slice(0, 10);
    } else {
      dateVal = String(dateVal).slice(0, 10);
    }
    return dateVal;
  }
  return new Date().toISOString().slice(0, 10);
};

const adjustActualStartDate = async (connection, jobCardId, newStartDate) => {
  await connection.execute(
    "UPDATE job_cards SET actual_start_date = ? WHERE id = ?",
    [newStartDate, jobCardId]
  );

  const [jcRow] = await connection.query(
    `SELECT wo.plan_id, jc.work_order_id FROM job_cards jc JOIN work_orders wo ON jc.work_order_id = wo.id WHERE jc.id = ?`,
    [jobCardId]
  );
  if (jcRow.length === 0) return;
  const planId = jcRow[0].plan_id;
  const workOrderId = jcRow[0].work_order_id;

  const groupQuery = `
    SELECT jc.id FROM job_cards jc
    JOIN work_orders wo ON jc.work_order_id = wo.id
    WHERE (wo.plan_id = ? AND wo.plan_id IS NOT NULL)
       OR (jc.work_order_id = ? AND wo.plan_id IS NULL)
  `;
  const [groupRows] = await connection.query(groupQuery, [planId || null, workOrderId]);
  const jcIds = groupRows.map(r => r.id);

  if (jcIds.length > 0) {
    const idsStr = jcIds.join(',');
    await connection.execute(
      `UPDATE job_card_time_logs SET day = DATEDIFF(log_date, ?) + 1 WHERE job_card_id IN (${idsStr})`,
      [newStartDate]
    );
    await connection.execute(
      `UPDATE job_card_quality_logs SET day = DATEDIFF(check_date, ?) + 1 WHERE job_card_id IN (${idsStr})`,
      [newStartDate]
    );
    await connection.execute(
      `UPDATE job_card_downtime_logs SET day = DATEDIFF(downtime_date, ?) + 1 WHERE job_card_id IN (${idsStr})`,
      [newStartDate]
    );
  }
};

const addTimeLog = async (data) => {
  const { jobCardId, logDate, operatorId, workstationId, shift, startTime, endTime, producedQty, day } = data;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Check if the production plan's material requirement is fulfilled
    const isPlanFulfilled = await checkProductionPlanFulfilled(connection, { jobCardId });
    if (!isPlanFulfilled) {
      throw new Error("Cannot add production entry: The associated production plan does not have a fulfilled Material Requirement.");
    }

    // Check if the assembly is waiting for components
    const [jcDetails] = await connection.query(
      `SELECT jc.sequence_no, jc.planned_qty, jc.status,
              wo.id as work_order_id, wo.plan_id, wo.item_code, wo.quantity as wo_quantity
       FROM job_cards jc
       JOIN work_orders wo ON jc.work_order_id = wo.id
       WHERE jc.id = ?`,
      [jobCardId]
    );
    if (jcDetails.length > 0) {
      const jcDetail = jcDetails[0];
      const [childWos] = await connection.query(
        'SELECT id, item_code, item_name, quantity FROM work_orders WHERE plan_id = ? AND (parent_wo_id = ? OR source_fg = ?) AND id != ? AND status NOT IN ("DRAFT", "CANCELLED")',
        [jcDetail.plan_id, jcDetail.work_order_id, jcDetail.item_code, jcDetail.work_order_id]
      );

      if (childWos.length > 0) {
        let minPossibleQty = parseFloat(jcDetail.wo_quantity || jcDetail.planned_qty || 0);
        const parentQty = minPossibleQty;
        const childParts = [];

        for (const childWo of childWos) {
          const [finalJc] = await connection.query(
            'SELECT COALESCE(transferred_qty, 0) as transferred_qty FROM job_cards WHERE work_order_id = ? ORDER BY sequence_no DESC, id DESC LIMIT 1',
            [childWo.id]
          );
          const transferred = parseFloat(finalJc[0]?.transferred_qty || 0);
          const reqQty = parseFloat(childWo.quantity);
          childParts.push({
            required_qty: reqQty,
            transferred_qty: transferred
          });

          const possible = reqQty > 0 ? (transferred * parentQty) / reqQty : parentQty;
          if (possible < minPossibleQty) {
            minPossibleQty = possible;
          }
        }

        const assemblyAvailableQty = minPossibleQty;
        const [minSeqRow] = await connection.query(
          'SELECT MIN(sequence_no) as min_seq FROM job_cards WHERE work_order_id = ?',
          [jcDetail.work_order_id]
        );
        const isFirstOp = jcDetail.sequence_no === minSeqRow[0]?.min_seq;

        const isAssemblyWaiting = isFirstOp && childParts.some(cp => cp.transferred_qty === 0);
        if (isAssemblyWaiting) {
          throw new Error('Cannot add production entry: Assembly is waiting for components.');
        }
      }
    }

    // 1b. Check Operator and Workstation availability with time overlap
    const fullStartTime = (logDate && startTime) ? `${logDate} ${startTime}` : null;
    const fullEndTime = (logDate && endTime) ? `${logDate} ${endTime}` : null;

    // 1. Prevent overlapping time log for this same Job Card
    if (fullStartTime && fullEndTime) {
      const [overlappingLogs] = await connection.query(
        `SELECT id FROM job_card_time_logs 
         WHERE job_card_id = ? 
           AND start_time < ? 
           AND end_time > ?`,
        [jobCardId, fullEndTime, fullStartTime]
      );
      if (overlappingLogs.length > 0) {
        throw new Error(`Time overlap detected. Another time log for this Job Card already exists during the selected time period.`);
      }
    }

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
             AND tl.end_time > ?
             AND jc.status != 'CANCELLED' AND jc.status != 'COMPLETED'`,
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
             AND tl.end_time > ?
             AND jc.status != 'CANCELLED' AND jc.status != 'COMPLETED'`,
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

    let jcActualStartDate = jcRows[0].actual_start_date;
    if (jcActualStartDate instanceof Date) {
      jcActualStartDate = jcActualStartDate.toISOString().split('T')[0];
    }

    if (!jcActualStartDate) {
      // First Entry for this job card
      await connection.execute(
        "UPDATE job_cards SET actual_start_date = ?, status = 'IN_PROGRESS', workstation_id = ?, assigned_to = ? WHERE id = ?",
        [logDate, workstationId, operatorId, jobCardId]
      );
    } else {
      // Update workstation and operator even if not the first entry to reflect current activity
      await connection.execute(
        "UPDATE job_cards SET workstation_id = ?, assigned_to = ? WHERE id = ?",
        [workstationId, operatorId, jobCardId]
      );
    }

    // Calculate productionStartDate of the plan/batch
    const productionStartDate = await getProductionStartDate(connection, jobCardId);
    let calculatedDay = 1;

    const start = new Date(productionStartDate + 'T00:00:00');
    const current = new Date(logDate + 'T00:00:00');

    if (current < start) {
      await adjustActualStartDate(connection, jobCardId, logDate);
      calculatedDay = 1;
    } else {
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

    let jcActualStartDate = jobCard[0].actual_start_date;
    if (jcActualStartDate instanceof Date) {
      jcActualStartDate = jcActualStartDate.toISOString().split('T')[0];
    }

    if (!jcActualStartDate) {
      // First Entry for this job card
      await connection.execute(
        "UPDATE job_cards SET actual_start_date = ?, status = 'IN_PROGRESS' WHERE id = ?",
        [checkDate, jobCardId]
      );
    }

    // Calculate productionStartDate of the plan/batch
    const productionStartDate = await getProductionStartDate(connection, jobCardId);
    let calculatedDay = 1;

    const start = new Date(productionStartDate + 'T00:00:00');
    const current = new Date(checkDate + 'T00:00:00');

    if (current < start) {
      await adjustActualStartDate(connection, jobCardId, checkDate);
      calculatedDay = 1;
    } else {
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
         SET accepted_qty = COALESCE((SELECT SUM(accepted_qty) FROM job_card_quality_logs WHERE job_card_id = ? AND status = 'APPROVED'), 0),
             rejected_qty = COALESCE((SELECT SUM(rejected_qty) FROM job_card_quality_logs WHERE job_card_id = ? AND status = 'APPROVED'), 0),
             scrap_qty = COALESCE((SELECT SUM(scrap_qty) FROM job_card_quality_logs WHERE job_card_id = ? AND status = 'APPROVED'), 0)
         WHERE id = ?`,
        [jobCardId, jobCardId, jobCardId, jobCardId]
      );
      const [jcRow] = await connection.query('SELECT work_order_id FROM job_cards WHERE id = ?', [jobCardId]);
      if (jcRow.length > 0) {
        await syncReworkQuantities(jcRow[0].work_order_id, connection);
      }
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
         SET accepted_qty = COALESCE((SELECT SUM(accepted_qty) FROM job_card_quality_logs WHERE job_card_id = ? AND status = 'APPROVED'), 0),
             rejected_qty = COALESCE((SELECT SUM(rejected_qty) FROM job_card_quality_logs WHERE job_card_id = ? AND status = 'APPROVED'), 0),
             scrap_qty = COALESCE((SELECT SUM(scrap_qty) FROM job_card_quality_logs WHERE job_card_id = ? AND status = 'APPROVED'), 0)
         WHERE id = ?`,
        [jobCardId, jobCardId, jobCardId, jobCardId]
      );
      const [jcRow] = await connection.query('SELECT work_order_id FROM job_cards WHERE id = ?', [jobCardId]);
      if (jcRow.length > 0) {
        await syncReworkQuantities(jcRow[0].work_order_id, connection);
      }
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

    let jcActualStartDate = jobCard[0].actual_start_date;
    if (jcActualStartDate instanceof Date) {
      jcActualStartDate = jcActualStartDate.toISOString().split('T')[0];
    }

    if (!jcActualStartDate) {
      // First Entry for this job card
      await connection.execute(
        "UPDATE job_cards SET actual_start_date = ?, status = 'IN_PROGRESS' WHERE id = ?",
        [downtimeDate, jobCardId]
      );
    }

    // Calculate productionStartDate of the plan/batch
    const productionStartDate = await getProductionStartDate(connection, jobCardId);
    let calculatedDay = 1;

    const start = new Date(productionStartDate + 'T00:00:00');
    const current = new Date(downtimeDate + 'T00:00:00');

    if (current < start) {
      await adjustActualStartDate(connection, jobCardId, downtimeDate);
      calculatedDay = 1;
    } else {
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

const syncUnaccountedDowntime = async (jobCardId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Delete any existing Unaccounted Downtime logs for this job card
    await connection.execute(
      "DELETE FROM job_card_downtime_logs WHERE job_card_id = ? AND downtime_type = 'Unaccounted Downtime'",
      [jobCardId]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error("Error in syncUnaccountedDowntime:", error);
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


  // Check overlap first
  const conflictMessage = await checkOverlap(id, workstationId, assignedTo, startDateTime, endDateTime, executionMode);
  if (conflictMessage) {
    throw new Error(conflictMessage);
  }

  // Check sequence timing overlap
  const seqConflictMessage = await checkSequenceOverlap(id, workOrderId, startDateTime, endDateTime);
  if (seqConflictMessage) {
    throw new Error(seqConflictMessage);
  }

  // Check if the assembly is waiting for components
  const [jcDetails] = await pool.query(
    `SELECT jc.sequence_no, jc.planned_qty, jc.status,
            wo.id as work_order_id, wo.plan_id, wo.item_code, wo.quantity as wo_quantity
     FROM job_cards jc
     JOIN work_orders wo ON jc.work_order_id = wo.id
     WHERE jc.id = ?`,
    [id]
  );
  if (jcDetails.length > 0) {
    const jcDetail = jcDetails[0];
    const [childWos] = await pool.query(
      'SELECT id, item_code, item_name, quantity FROM work_orders WHERE plan_id = ? AND (parent_wo_id = ? OR source_fg = ?) AND id != ? AND status NOT IN ("DRAFT", "CANCELLED")',
      [jcDetail.plan_id, jcDetail.work_order_id, jcDetail.item_code, jcDetail.work_order_id]
    );

    if (childWos.length > 0) {
      let minPossibleQty = parseFloat(jcDetail.wo_quantity || jcDetail.planned_qty || 0);
      const parentQty = minPossibleQty;
      const childParts = [];

      for (const childWo of childWos) {
        const [finalJc] = await pool.query(
          'SELECT COALESCE(transferred_qty, 0) as transferred_qty FROM job_cards WHERE work_order_id = ? ORDER BY sequence_no DESC, id DESC LIMIT 1',
          [childWo.id]
        );
        const transferred = parseFloat(finalJc[0]?.transferred_qty || 0);
        const reqQty = parseFloat(childWo.quantity);
        childParts.push({
          required_qty: reqQty,
          transferred_qty: transferred
        });

        const possible = reqQty > 0 ? (transferred * parentQty) / reqQty : parentQty;
        if (possible < minPossibleQty) {
          minPossibleQty = possible;
        }
      }

      const assemblyAvailableQty = minPossibleQty;
      const [minSeqRow] = await pool.query(
        'SELECT MIN(sequence_no) as min_seq FROM job_cards WHERE work_order_id = ?',
        [jcDetail.work_order_id]
      );
      const isFirstOp = jcDetail.sequence_no === minSeqRow[0]?.min_seq;

      const isAssemblyWaiting = isFirstOp && childParts.some(cp => cp.transferred_qty === 0);
      if (isAssemblyWaiting) {
        const isAssigning = (workstationId !== undefined && workstationId !== null) || (assignedTo !== undefined && assignedTo !== null);
        const isStartingOrCompleting = (status === 'IN_PROGRESS' || status === 'COMPLETED');
        if (isAssigning || isStartingOrCompleting) {
          throw new Error('Cannot start, assign workstation/operator, or update status: Assembly is waiting for components.');
        }
      }
    }
  }

  if (status === 'IN_PROGRESS' || producedQty > 0 || acceptedQty > 0) {
    const isPlanFulfilled = await checkProductionPlanFulfilled(pool, { jobCardId: id });
    if (!isPlanFulfilled) {
      throw new Error("Cannot start or enter production details: The associated production plan does not have a fulfilled Material Requirement.");
    }
  }

  if (status === 'IN_PROGRESS' && executionMode !== 'Outsource') {
    if (workstationId) {
      const [wsRows] = await pool.query('SELECT IFNULL(capacity, 1) as capacity FROM workstations WHERE id = ?', [workstationId]);
      const capacity = wsRows.length > 0 ? wsRows[0].capacity : 1;
      const [activeJobs] = await pool.query(
        'SELECT job_card_no FROM job_cards WHERE workstation_id = ? AND status = "IN_PROGRESS" AND id != ?',
        [workstationId, id]
      );
      if (activeJobs.length >= capacity) {
        throw new Error(`Workstation is busy with Job Card ${activeJobs[0].job_card_no}`);
      }
    }
    if (assignedTo) {
      const [busyOp] = await pool.query(
        'SELECT job_card_no FROM job_cards WHERE assigned_to = ? AND status = "IN_PROGRESS" AND id != ?',
        [assignedTo, id]
      );
      if (busyOp.length > 0) {
        throw new Error(`Operator is busy with Job Card ${busyOp[0].job_card_no}`);
      }
    }
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
           rejected_qty = COALESCE((SELECT SUM(rejected_qty) FROM job_card_quality_logs WHERE job_card_id = ? AND status = 'APPROVED'), 0),
           scrap_qty = COALESCE((SELECT SUM(scrap_qty) FROM job_card_quality_logs WHERE job_card_id = ? AND status = 'APPROVED'), 0)
       WHERE id = ?`,
      [jobCardId, jobCardId, jobCardId, jobCardId]
    );
    const [jcRow] = await pool.query('SELECT work_order_id FROM job_cards WHERE id = ?', [jobCardId]);
    if (jcRow.length > 0) {
      await syncReworkQuantities(jcRow[0].work_order_id, pool);
    }
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
            COALESCE(so.project_name, o_dir.project_name) as project_name,
            COALESCE(c.company_name, c_dir.company_name) as client_name,
            o.operation_name
     FROM job_card_quality_logs ql
     JOIN job_cards jc ON ql.job_card_id = jc.id
     JOIN work_orders wo ON jc.work_order_id = wo.id
     LEFT JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
     LEFT JOIN sales_orders so ON (
       (soi.id IS NOT NULL AND soi.sales_order_id = so.id) OR
       (soi.id IS NULL AND wo.sales_order_id = so.id)
     )
     LEFT JOIN companies c ON so.company_id = c.id
     LEFT JOIN orders o_dir ON wo.sales_order_id = o_dir.id AND o_dir.source_type = 'DIRECT' AND (soi.id IS NULL OR soi.sales_order_id != wo.sales_order_id)
     LEFT JOIN companies c_dir ON o_dir.client_id = c_dir.id
     LEFT JOIN operations o ON jc.operation_id = o.id
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

    const query = `SELECT jc.*, wo.wo_number, wo.item_name, wo.item_code, wo.sales_order_item_id, wo.priority, wo.quantity as wo_total_qty,
            COALESCE(o.operation_name, jc.operation_name) as op_name,
            w.workstation_name, u.username as operator_name,
            COALESCE(so.project_name, o_dir.project_name) as project_name,
            COALESCE(c.company_name, c_dir.company_name) as client_name,
            COALESCE(so.shipping_address, (SELECT CONCAT_WS(', ', line1, line2, city, state, pincode) FROM company_addresses WHERE company_id = o_dir.client_id AND address_type = 'SHIPPING' LIMIT 1)) as shipping_address,
            COALESCE(so.target_dispatch_date, o_dir.delivery_date) as target_dispatch_date,
            (SELECT SUM(produced_qty) FROM job_card_time_logs WHERE job_card_id = jc.id) as actual_produced,
            (SELECT SUM(inspected_qty) FROM job_card_quality_logs WHERE job_card_id = jc.id AND status = 'APPROVED') as actual_accepted,
            (SELECT SUM(rejected_qty) FROM job_card_quality_logs WHERE job_card_id = jc.id AND status = 'APPROVED') as actual_rejected,
            COALESCE((SELECT CASE WHEN status = 'PENDING' THEN 0 ELSE GREATEST(COALESCE(planned_qty, 0), COALESCE(accepted_qty, 0)) END FROM job_cards WHERE work_order_id = jc.work_order_id AND sequence_no > jc.sequence_no ORDER BY sequence_no ASC, id ASC LIMIT 1), 0) as transferred_qty
     FROM job_cards jc
     LEFT JOIN work_orders wo ON jc.work_order_id = wo.id
     LEFT JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
     LEFT JOIN sales_orders so ON (
       (soi.id IS NOT NULL AND soi.sales_order_id = so.id) OR
       (soi.id IS NULL AND wo.sales_order_id = so.id)
     )
     LEFT JOIN companies c ON so.company_id = c.id
     LEFT JOIN orders o_dir ON wo.sales_order_id = o_dir.id AND o_dir.source_type = 'DIRECT' AND (soi.id IS NULL OR soi.sales_order_id != wo.sales_order_id)
     LEFT JOIN companies c_dir ON o_dir.client_id = c_dir.id
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

const syncReworkQuantities = async (workOrderId, connection) => {
  const [jobCards] = await connection.query(
    'SELECT id, sequence_no, accepted_qty, rejected_qty, scrap_qty FROM job_cards WHERE work_order_id = ? ORDER BY sequence_no ASC, id ASC',
    [workOrderId]
  );

  if (jobCards.length === 0) return;

  const reworkGenerated = jobCards.map(jc => {
    const rejected = parseFloat(jc.rejected_qty || 0);
    const scrap = parseFloat(jc.scrap_qty || 0);
    return Math.max(0, rejected - scrap);
  });

  for (let i = 0; i < jobCards.length; i++) {
    const jc = jobCards[i];
    let newReworkQty = 0;

    // Sum rework generated by all downstream operations
    for (let j = i + 1; j < jobCards.length; j++) {
      newReworkQty += reworkGenerated[j];
    }

    // First operation also includes its own generated rework
    if (i === 0) {
      newReworkQty += reworkGenerated[0];
    }

    await connection.execute(
      'UPDATE job_cards SET rework_qty = ? WHERE id = ?',
      [newReworkQty, jc.id]
    );
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
  getActiveAllocations,
  syncUnaccountedDowntime,
  syncReworkQuantities
};
