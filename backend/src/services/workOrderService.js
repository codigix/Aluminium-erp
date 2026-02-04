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

      // Create Job Cards from BOM Operations
      const bomOperationsRaw = await bomService.getItemOperations(salesOrderItemId, itemCode);
      
      for (const op of bomOperationsRaw) {
        const [masterOps] = await connection.query('SELECT id FROM operations WHERE operation_name = ?', [op.operation_name]);
        const [masterWs] = await connection.query('SELECT id FROM workstations WHERE workstation_name = ?', [op.workstation]);
        
        await connection.execute(
          `INSERT INTO job_cards (work_order_id, operation_id, workstation_id, planned_qty, status)
           VALUES (?, ?, ?, ?, 'PENDING')`,
          [workOrderId, masterOps[0]?.id || null, masterWs[0]?.id || null, quantity]
        );
      }

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
    workstationId, quantity, startDate, endDate, priority, remarks 
  } = data;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 0. Check if item is rejected and fetch its details
    const [itemRows] = await connection.query(
      'SELECT item_code, drawing_no, status FROM sales_order_items WHERE id = ?',
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
       (wo_number, production_plan_item_id, sales_order_id, sales_order_item_id, workstation_id, quantity, start_date, end_date, priority, remarks, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RELEASED')`,
      [woNumber, productionPlanItemId || null, salesOrderId, salesOrderItemId, workstationId || null, quantity, startDate, endDate, priority, remarks]
    );

    const workOrderId = result.insertId;

    // 2. Fetch Operations from BOM using multi-tier logic
    const bomOperationsRaw = await bomService.getItemOperations(salesOrderItemId, item.item_code, item.drawing_no);
    
    // We still need to join with master operations/workstations for the master IDs
    const bomOperations = [];
    for (const op of bomOperationsRaw) {
      const [masterOps] = await connection.query(
        'SELECT id FROM operations WHERE operation_name = ?',
        [op.operation_name]
      );
      const [masterWs] = await connection.query(
        'SELECT id FROM workstations WHERE workstation_name = ?',
        [op.workstation]
      );
      bomOperations.push({
        ...op,
        master_operation_id: masterOps[0]?.id || null,
        master_workstation_id: masterWs[0]?.id || null
      });
    }

    if (bomOperations.length === 0) {
      throw new Error('Cannot create Work Order: No operations found in BOM for this item. Please define BOM operations first.');
    }

    // 3. Create Job Cards for each operation
    for (const op of bomOperations) {
      await connection.execute(
        `INSERT INTO job_cards 
         (work_order_id, operation_id, workstation_id, planned_qty, status)
         VALUES (?, ?, ?, ?, 'PENDING')`,
        [workOrderId, op.master_operation_id || null, op.master_workstation_id || null, quantity]
      );
    }

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

const updateWorkOrderStatus = async (id, status) => {
  await pool.execute('UPDATE work_orders SET status = ? WHERE id = ?', [status, id]);
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
  generateWoNumber
};
