const pool = require('../config/db');
const bomService = require('./bomService');

const listWorkOrders = async () => {
  const [rows] = await pool.query(
    `SELECT wo.*, so.project_name, w.workstation_name,
            (SELECT COUNT(*) FROM job_cards WHERE work_order_id = wo.id) as total_job_cards,
            (SELECT COUNT(*) FROM job_cards WHERE work_order_id = wo.id AND status = 'COMPLETED') as completed_job_cards
     FROM work_orders wo
     LEFT JOIN sales_orders so ON wo.sales_order_id = so.id
     LEFT JOIN workstations w ON wo.workstation_id = w.id
     ORDER BY wo.created_at DESC`
  );
  return rows;
};

const createWorkOrdersFromPlan = async (planId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Fetch Plan Details
    const [plans] = await connection.query('SELECT * FROM production_plans WHERE id = ?', [planId]);
    if (plans.length === 0) throw new Error('Production Plan not found');
    const plan = plans[0];

    // 2. Fetch Finished Goods
    const [items] = await connection.query('SELECT * FROM production_plan_items WHERE plan_id = ?', [planId]);
    
    // 3. Fetch Sub Assemblies
    const [subAssemblies] = await connection.query('SELECT * FROM production_plan_sub_assemblies WHERE plan_id = ?', [planId]);

    const createdWorkOrders = [];

    // Helper to create WO
    const createWO = async (itemData, sourceType) => {
      const itemCode = itemData.item_code;
      const itemName = itemData.description || itemData.item_code; // Fallback
      const bomNo = itemData.bom_no;
      const quantity = itemData.planned_qty || itemData.required_qty;
      const salesOrderItemId = itemData.sales_order_item_id || null;
      const productionPlanItemId = itemData.id;

      // Check if WO already exists for this plan and item
      const [existing] = await connection.query(
        'SELECT id FROM work_orders WHERE plan_id = ? AND item_code = ?',
        [planId, itemCode]
      );
      if (existing.length > 0) return null;

      const woNumber = await generateWoNumber();
      
      const [result] = await connection.execute(
        `INSERT INTO work_orders 
         (wo_number, plan_id, production_plan_item_id, sales_order_id, sales_order_item_id, 
          item_code, item_name, bom_no, source_type, quantity, status, priority)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', 'NORMAL')`,
        [
          woNumber, planId, sourceType === 'FG' ? productionPlanItemId : null, 
          plan.sales_order_id, salesOrderItemId,
          itemCode, itemName, bomNo, sourceType, quantity
        ]
      );

      const workOrderId = result.insertId;
      await createJobCardsForWorkOrder(workOrderId, connection, 'DRAFT');
      return workOrderId;
    };

    // Process Finished Goods
    for (const item of items) {
      const woId = await createWO(item, 'FG');
      if (woId) createdWorkOrders.push(woId);
    }

    // Process Sub Assemblies
    for (const sa of subAssemblies) {
      const woId = await createWO(sa, 'SA');
      if (woId) createdWorkOrders.push(woId);
    }

    // Update Plan status
    await connection.execute('UPDATE production_plans SET status = "IN_PROGRESS" WHERE id = ?', [planId]);

    await connection.commit();
    return createdWorkOrders;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const createWorkOrder = async (data) => {
  const { 
    woNumber, productionPlanItemId, salesOrderId, salesOrderItemId, 
    workstationId, quantity, startDate, endDate, priority, remarks,
    status = 'RELEASED'
  } = data;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 0. Check if item is rejected and fetch its details
    const [itemRows] = await connection.query(
      'SELECT item_code, description, item_type, drawing_no, status FROM sales_order_items WHERE id = ?',
      [salesOrderItemId]
    );
    if (itemRows.length === 0) throw new Error('Sales Order Item not found');
    
    if (itemRows[0].status === 'Rejected') {
      throw new Error('Cannot create Work Order for a rejected drawing/item.');
    }
    const item = itemRows[0];

    // 1. Create the Work Order
    const [result] = await connection.execute(
      `INSERT INTO work_orders 
       (wo_number, production_plan_item_id, sales_order_id, sales_order_item_id, workstation_id, 
        item_code, item_name, source_type, quantity, start_date, end_date, priority, remarks, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        woNumber, productionPlanItemId || null, salesOrderId, salesOrderItemId, workstationId || null, 
        item.item_code, item.description || item.item_code, item.item_type || 'FG', 
        quantity, startDate, endDate, priority, remarks, status
      ]
    );

    const workOrderId = result.insertId;

    // 2. Create Job Cards with appropriate status
    const jcInitialStatus = status === 'RELEASED' ? 'PENDING' : 'DRAFT';
    await createJobCardsForWorkOrder(workOrderId, connection, jcInitialStatus);

    // 4. Update Production Plan Item status if applicable
    if (productionPlanItemId) {
      await connection.execute(
        'UPDATE production_plan_items SET status = \'IN_PROGRESS\' WHERE id = ?',
        [productionPlanItemId]
      );
    }

    await connection.commit();
    return workOrderId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getWorkOrderById = async (id) => {
  const [rows] = await pool.query(
    `SELECT wo.*, so.project_name, soi.item_code, soi.description, w.workstation_name
     FROM work_orders wo
     JOIN sales_orders so ON wo.sales_order_id = so.id
     JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
     LEFT JOIN workstations w ON wo.workstation_id = w.id
     WHERE wo.id = ?`,
    [id]
  );
  return rows[0];
};

const generateJobCardNo = async (connection) => {
  const [rows] = await connection.query('SELECT COUNT(*) as count FROM job_cards');
  const count = rows[0].count + 1;
  return `JC-${String(count).padStart(4, '0')}`;
};

const createJobCardsForWorkOrder = async (workOrderId, connection, initialStatus = 'DRAFT') => {
  // 1. Fetch WO details
  const [woRows] = await connection.query(
    'SELECT item_code, bom_no, quantity, sales_order_item_id, source_type FROM work_orders WHERE id = ?',
    [workOrderId]
  );
  if (woRows.length === 0) return;
  const wo = woRows[0];

  // 2. Check if Job Cards already exist
  const [existingJc] = await connection.query('SELECT id FROM job_cards WHERE work_order_id = ?', [workOrderId]);
  if (existingJc.length > 0) return;

  // 3. Fetch Operations from BOM
  // IMPORTANT: For Sub-Assemblies (SA), we should fetch operations for the specific item_code 
  // from the master BOM, as sales_order_item_id refers to the parent FG item.
  let bomOperationsRaw = [];
  if (wo.source_type === 'SA' || !wo.sales_order_item_id) {
    bomOperationsRaw = await bomService.getItemOperations(null, wo.item_code);
  } else {
    // For FG, try to get SO-specific operations first
    bomOperationsRaw = await bomService.getItemOperations(wo.sales_order_item_id, wo.item_code);
  }
  
  if (bomOperationsRaw.length === 0) {
    console.warn(`No operations found for item ${wo.item_code} in BOM`);
    return;
  }

  // 4. Create Job Cards
  for (const op of bomOperationsRaw) {
    const [masterOps] = await connection.query(
      'SELECT id FROM operations WHERE operation_name = ?',
      [op.operation_name]
    );
    const [masterWs] = await connection.query(
      'SELECT id FROM workstations WHERE workstation_name = ?',
      [op.workstation]
    );

    const jcNo = await generateJobCardNo(connection);

    await connection.execute(
      `INSERT INTO job_cards 
       (job_card_no, work_order_id, operation_id, workstation_id, planned_qty, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [jcNo, workOrderId, masterOps[0]?.id || null, masterWs[0]?.id || null, wo.quantity, initialStatus]
    );
  }
};

const updateWorkOrderStatus = async (id, status) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute('UPDATE work_orders SET status = ? WHERE id = ?', [status, id]);

    if (status === 'RELEASED') {
      // Move any DRAFT job cards to PENDING
      await connection.execute('UPDATE job_cards SET status = "PENDING" WHERE work_order_id = ? AND status = "DRAFT"', [id]);
      
      // Also ensure JCs exist (if they weren't created earlier for some reason)
      await createJobCardsForWorkOrder(id, connection, 'PENDING');
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const deleteWorkOrder = async (id) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Check if any material issues exist
    const [miRows] = await connection.query('SELECT id FROM material_issues WHERE work_order_id = ?', [id]);
    if (miRows.length > 0) {
      throw new Error('Cannot delete Work Order with linked material issues.');
    }

    // 2. Check if any job cards are completed or in progress
    const [jcRows] = await connection.query('SELECT id FROM job_cards WHERE work_order_id = ? AND status NOT IN ("DRAFT", "PENDING")', [id]);
    if (jcRows.length > 0) {
      throw new Error('Cannot delete Work Order with active or completed job cards.');
    }

    // 3. Get production plan item id to revert status
    const [woRows] = await connection.query('SELECT production_plan_item_id FROM work_orders WHERE id = ?', [id]);
    if (woRows.length === 0) throw new Error('Work Order not found');
    const productionPlanItemId = woRows[0].production_plan_item_id;

    // 4. Delete associated job cards
    await connection.execute('DELETE FROM job_cards WHERE work_order_id = ?', [id]);

    // 5. Delete the work order
    await connection.execute('DELETE FROM work_orders WHERE id = ?', [id]);

    // 6. Revert Production Plan Item status if applicable
    if (productionPlanItemId) {
      await connection.execute(
        'UPDATE production_plan_items SET status = "PENDING" WHERE id = ?',
        [productionPlanItemId]
      );
    }

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const generateWoNumber = async () => {
  return `WO-${Date.now()}`;
};

module.exports = {
  listWorkOrders,
  createWorkOrdersFromPlan,
  createWorkOrder,
  getWorkOrderById,
  updateWorkOrderStatus,
  deleteWorkOrder,
  generateWoNumber
};
