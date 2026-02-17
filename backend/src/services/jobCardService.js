const pool = require('../config/db');

const listJobCards = async () => {
  const [rows] = await pool.query(
    `SELECT jc.*, wo.wo_number, wo.item_name, wo.priority, wo.quantity as wo_quantity, wo.status as wo_status, wo.end_date as wo_end_date, wo.source_type,
            COALESCE(o.operation_name, jc.operation_name) as operation_name, 
            COALESCE(NULLIF(jc.std_time, 0), o.std_time, 0) as std_time, 
            COALESCE(o.time_uom, 'Min') as time_uom, 
            COALESCE(NULLIF(jc.hourly_rate, 0), o.hourly_rate, 0) as hourly_rate, 
            w.workstation_name, u.username as operator_name, soi.status as item_status
     FROM job_cards jc
     JOIN work_orders wo ON jc.work_order_id = wo.id
     LEFT JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
     LEFT JOIN operations o ON jc.operation_id = o.id
     LEFT JOIN workstations w ON jc.workstation_id = w.id
     LEFT JOIN users u ON jc.assigned_to = u.id
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
  const { jobCardId, logDate, operatorId, workstationId, shift, startTime, endTime, producedQty } = data;
  const [result] = await pool.execute(
    `INSERT INTO job_card_time_logs 
     (job_card_id, log_date, operator_id, workstation_id, shift, start_time, end_time, produced_qty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [jobCardId, logDate, operatorId, workstationId, shift, startTime, endTime, producedQty]
  );
  
  // Update total produced qty in job card
  await pool.execute(
    `UPDATE job_cards jc 
     SET produced_qty = (SELECT SUM(produced_qty) FROM job_card_time_logs WHERE job_card_id = ?)
     WHERE id = ?`,
    [jobCardId, jobCardId]
  );
  
  return result.insertId;
};

const getQualityLogs = async (jobCardId) => {
  const [rows] = await pool.query(
    'SELECT * FROM job_card_quality_logs WHERE job_card_id = ? ORDER BY created_at DESC',
    [jobCardId]
  );
  return rows;
};

const addQualityLog = async (data) => {
  const { jobCardId, checkDate, shift, inspectedQty, acceptedQty, rejectedQty, scrapQty, rejectionReason, notes, status } = data;
  const [result] = await pool.execute(
    `INSERT INTO job_card_quality_logs 
     (job_card_id, check_date, shift, inspected_qty, accepted_qty, rejected_qty, scrap_qty, rejection_reason, notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [jobCardId, checkDate, shift, inspectedQty, acceptedQty, rejectedQty, scrapQty, rejectionReason, notes, status || 'PENDING']
  );

  // Update accepted and rejected qty in job card if approved
  if (status === 'APPROVED') {
    await pool.execute(
      `UPDATE job_cards jc 
       SET accepted_qty = (SELECT SUM(accepted_qty) FROM job_card_quality_logs WHERE job_card_id = ? AND status = 'APPROVED'),
           rejected_qty = (SELECT SUM(rejected_qty) FROM job_card_quality_logs WHERE job_card_id = ? AND status = 'APPROVED')
       WHERE id = ?`,
      [jobCardId, jobCardId, jobCardId]
    );
  }
  
  return result.insertId;
};

const getDowntimeLogs = async (jobCardId) => {
  const [rows] = await pool.query(
    'SELECT * FROM job_card_downtime_logs WHERE job_card_id = ? ORDER BY created_at DESC',
    [jobCardId]
  );
  return rows;
};

const addDowntimeLog = async (data) => {
  const { jobCardId, downtimeDate, shift, downtimeType, startTime, endTime, remarks } = data;
  const [result] = await pool.execute(
    `INSERT INTO job_card_downtime_logs 
     (job_card_id, downtime_date, shift, downtime_type, start_time, end_time, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [jobCardId, downtimeDate, shift, downtimeType, startTime, endTime, remarks]
  );
  return result.insertId;
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

module.exports = {
  listJobCards,
  createJobCard,
  updateJobCardProgress,
  getJobCardById,
  updateJobCard,
  deleteJobCard,
  getTimeLogs,
  addTimeLog,
  getQualityLogs,
  addQualityLog,
  getDowntimeLogs,
  addDowntimeLog
};
