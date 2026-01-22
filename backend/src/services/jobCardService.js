const pool = require('../config/db');

const listJobCards = async () => {
  const [rows] = await pool.query(
    `SELECT jc.*, wo.wo_number, o.operation_name, w.workstation_name, u.username as operator_name, soi.status as item_status
     FROM job_cards jc
     JOIN work_orders wo ON jc.work_order_id = wo.id
     JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
     LEFT JOIN operations o ON jc.operation_id = o.id
     LEFT JOIN workstations w ON jc.workstation_id = w.id
     LEFT JOIN users u ON jc.assigned_to = u.id
     ORDER BY jc.created_at DESC`
  );
  return rows;
};

const createJobCard = async (data) => {
  const { 
    workOrderId, operationId, workstationId, assignedTo, plannedQty, remarks 
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
     (work_order_id, operation_id, workstation_id, assigned_to, planned_qty, remarks, status)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
    [workOrderId, operationId || null, workstationId || null, assignedTo || null, plannedQty, remarks]
  );

  return result.insertId;
};

const updateJobCardProgress = async (id, data) => {
  const { producedQty, rejectedQty, status, startTime, endTime } = data;
  
  const updates = [];
  const params = [];

  if (producedQty !== undefined) {
    updates.push('produced_qty = ?');
    params.push(producedQty);
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

  if (updates.length === 0) return;

  params.push(id);
  await pool.execute(
    `UPDATE job_cards SET ${updates.join(', ')} WHERE id = ?`,
    params
  );
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

module.exports = {
  listJobCards,
  createJobCard,
  updateJobCardProgress,
  getJobCardById
};
