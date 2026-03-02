const pool = require('../config/db');

const listJobCards = async () => {
  const [rows] = await pool.query(
    `SELECT jc.*, wo.wo_number, wo.item_name, wo.priority, wo.quantity as wo_quantity, wo.status as wo_status, wo.end_date as wo_end_date, wo.source_type,
            COALESCE(o.operation_name, jc.operation_name) as operation_name, 
            COALESCE(NULLIF(jc.std_time, 0), o.std_time, 0) as std_time, 
            COALESCE(o.time_uom, 'Min') as time_uom, 
            COALESCE(NULLIF(jc.hourly_rate, 0), o.hourly_rate, 0) as hourly_rate, 
            w.workstation_name, u.username as operator_name, soi.status as item_status,
            oc.id as outward_challan_id, oc.challan_number as outward_challan_no, oc.dispatch_qty
     FROM job_cards jc
     JOIN work_orders wo ON jc.work_order_id = wo.id
     LEFT JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
     LEFT JOIN operations o ON jc.operation_id = o.id
     LEFT JOIN workstations w ON jc.workstation_id = w.id
     LEFT JOIN users u ON jc.assigned_to = u.id
     LEFT JOIN outward_challans oc ON jc.id = oc.job_card_id
     ORDER BY jc.created_at DESC`
  );
  return rows;
};

const createJobCard = async (data) => {
  const { 
    jobCardNo, workOrderId, operationId, workstationId, assignedTo, plannedQty, remarks 
  } = data;

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

  const [result] = await pool.execute(
    `INSERT INTO job_cards 
     (job_card_no, work_order_id, operation_id, workstation_id, assigned_to, planned_qty, remarks, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    [jobCardNo || null, workOrderId, operationId || null, workstationId || null, assignedTo || null, plannedQty, remarks]
  );

  return result.insertId;
};

const updateJobCardProgress = async (id, data) => {
  const { producedQty, acceptedQty, rejectedQty, status, startTime, endTime } = data;
  
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
    if (rejectedQty !== undefined) {
      updates.push('rejected_qty = ?');
      params.push(rejectedQty);
    }
    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (startTime) {
      updates.push('start_time = ?');
      params.push(startTime);
    }
    if (endTime) {
      updates.push('end_time = ?');
      params.push(endTime);
    }

    if (updates.length > 0) {
      params.push(id);
      await connection.execute(
        `UPDATE job_cards SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
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
        // If some are done but none in progress, and some pending, keep it as IN_PROGRESS if any work has started
        const hasStarted = allJcs.some(jc => jc.status === 'COMPLETED');
        if (hasStarted) newWoStatus = 'IN_PROGRESS';
      }

      await connection.execute('UPDATE work_orders SET status = ? WHERE id = ?', [newWoStatus, workOrderId]);
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getJobCardById = async (id) => {
  const [rows] = await pool.query(
    `SELECT jc.*, wo.wo_number, wo.item_name, wo.drawing_no,
            COALESCE(o.operation_name, jc.operation_name) as operation_name, 
            COALESCE(NULLIF(jc.std_time, 0), o.std_time, 0) as std_time, 
            COALESCE(o.time_uom, 'Min') as time_uom, 
            COALESCE(NULLIF(jc.hourly_rate, 0), o.hourly_rate, 0) as hourly_rate, 
            w.workstation_name, u.username as operator_name
     FROM job_cards jc
     JOIN work_orders wo ON jc.work_order_id = wo.id
     LEFT JOIN operations o ON jc.operation_id = o.id
     LEFT JOIN workstations w ON jc.workstation_id = w.id
     LEFT JOIN users u ON jc.assigned_to = u.id
     WHERE jc.id = ?`,
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
        "UPDATE job_cards SET actual_start_date = ?, status = 'IN_PROGRESS' WHERE id = ?",
        [actualStartDate, jobCardId]
      );
      calculatedDay = 1;
    } else {
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

    // Convert startTime and endTime to full DATETIME strings using logDate
    const fullStartTime = (logDate && startTime) ? `${logDate} ${startTime}` : null;
    const fullEndTime = (logDate && endTime) ? `${logDate} ${endTime}` : null;

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
    
    // Update total produced qty in job card
    await connection.execute(
      `UPDATE job_cards jc 
       SET produced_qty = (SELECT SUM(produced_qty) FROM job_card_time_logs WHERE job_card_id = ?)
       WHERE id = ?`,
      [jobCardId, jobCardId]
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

  // Update total produced qty in job card
  if (jobCardId) {
    await pool.execute(
      `UPDATE job_cards jc 
       SET produced_qty = (SELECT SUM(produced_qty) FROM job_card_time_logs WHERE job_card_id = ?)
       WHERE id = ?`,
      [jobCardId, jobCardId]
    );
  }
};

const getQualityLogs = async (jobCardId) => {
  const [rows] = await pool.query(
    'SELECT * FROM job_card_quality_logs WHERE job_card_id = ? ORDER BY created_at DESC',
    [jobCardId]
  );
  return rows;
};

const addQualityLog = async (data) => {
  const { jobCardId, day, checkDate, shift, inspectedQty, acceptedQty, rejectedQty, scrapQty, rejectionReason, notes, status } = data;
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
       (job_card_id, day, check_date, shift, inspected_qty, accepted_qty, rejected_qty, scrap_qty, rejection_reason, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [jobCardId, finalDay, checkDate, shift, inspectedQty, acceptedQty, rejectedQty, scrapQty, rejectionReason, notes, status || 'PENDING']
    );

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
    workOrderId, operationId, workstationId, assignedTo, plannedQty, remarks 
  } = data;

  await pool.execute(
    `UPDATE job_cards 
     SET work_order_id = ?, operation_id = ?, workstation_id = ?, assigned_to = ?, planned_qty = ?, remarks = ?
     WHERE id = ?`,
    [workOrderId, operationId || null, workstationId || null, assignedTo || null, plannedQty, remarks, id]
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
  deleteDowntimeLog
};
