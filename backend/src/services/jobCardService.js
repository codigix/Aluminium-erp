const pool = require('../config/db');

const listJobCards = async () => {
  const [rows] = await pool.query(
    `SELECT jc.*, wo.wo_number, wo.item_name, wo.priority, wo.quantity as wo_quantity, wo.status as wo_status, wo.end_date as wo_end_date, wo.source_type,
            o.operation_name, o.std_time, o.time_uom, w.workstation_name, u.username as operator_name, soi.status as item_status
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
    `SELECT jc.*, wo.wo_number, o.operation_name, w.workstation_name, u.username as operator_name
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
  await pool.execute('DELETE FROM job_cards WHERE id = ?', [id]);
};

module.exports = {
  listJobCards,
  createJobCard,
  updateJobCardProgress,
  getJobCardById,
  updateJobCard,
  deleteJobCard
};
