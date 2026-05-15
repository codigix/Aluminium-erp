const pool = require('../config/db');
const bomService = require('./bomService');
const stockService = require('./stockService');

const listWorkOrders = async () => {
  const [rows] = await pool.query(
    `SELECT wo.*, so.project_name, w.workstation_name, c.company_name as client_name,
            COALESCE(soi_parent.description, oi_parent.description, soi_source.description, soi_fallback.description, oi_fallback.description, wo_parent.item_name, wo.source_fg) as source_fg,
            (SELECT COUNT(*) FROM job_cards WHERE work_order_id = wo.id) as total_job_cards,
            (SELECT COUNT(*) FROM job_cards WHERE work_order_id = wo.id AND status = 'COMPLETED') as completed_job_cards,
            (SELECT MAX(id) FROM work_orders WHERE 
               (plan_id = wo.plan_id AND plan_id IS NOT NULL) OR 
               (parent_wo_id = wo.parent_wo_id AND parent_wo_id IS NOT NULL) OR 
               (id = wo.id AND plan_id IS NULL AND parent_wo_id IS NULL)
            ) as batch_latest_id
     FROM work_orders wo
     LEFT JOIN work_orders wo_parent ON wo.parent_wo_id = wo_parent.id
     LEFT JOIN sales_order_items soi_parent ON wo_parent.sales_order_item_id = soi_parent.id
     LEFT JOIN order_items oi_parent ON wo_parent.sales_order_item_id = oi_parent.id AND wo_parent.sales_order_id = oi_parent.order_id
     LEFT JOIN sales_order_items soi_fallback ON (wo_parent.item_code = soi_fallback.item_code OR wo_parent.bom_no = soi_fallback.drawing_no) AND soi_fallback.sales_order_id IS NULL
     LEFT JOIN order_items oi_fallback ON (wo_parent.item_code = oi_fallback.item_code OR wo_parent.bom_no = oi_fallback.drawing_no) AND oi_fallback.order_id = wo_parent.sales_order_id
     LEFT JOIN sales_order_items soi_source ON (wo.source_fg = soi_source.item_code OR wo.source_fg = soi_source.drawing_no) AND (soi_source.sales_order_id = wo.sales_order_id OR soi_source.sales_order_id IS NULL)
     LEFT JOIN sales_orders so ON wo.sales_order_id = so.id
     LEFT JOIN companies c ON so.company_id = c.id
     LEFT JOIN workstations w ON wo.workstation_id = w.id
     ORDER BY batch_latest_id DESC, CASE WHEN wo.source_type = 'SA' THEN 0 ELSE 1 END ASC, wo.id ASC`
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
    const [planOps] = await connection.query('SELECT * FROM production_plan_operations WHERE plan_id = ? ORDER BY step_no ASC', [planId]);

    const createdWorkOrders = [];
    const saWorkOrderIds = [];
    let parentWoId = null;

    // Helper to create WO
    const createWO = async (itemData, sourceType, parentId = null) => {
      const itemCode = itemData.item_code;
      let itemName = itemData.description || itemData.item_name;

      // If name is just the code or missing, try to fetch a better name from sales_order_items or bom_creation
      if (!itemName || itemName === itemCode) {
        if (itemData.sales_order_item_id) {
          const [soItems] = await connection.query('SELECT description FROM sales_order_items WHERE id = ?', [itemData.sales_order_item_id]);
          if (soItems.length > 0 && soItems[0].description) itemName = soItems[0].description;
        }

        if (!itemName || itemName === itemCode) {
          const [bomItems] = await connection.query('SELECT description as product_name FROM sales_order_items WHERE (drawing_no = ? OR item_code = ?) AND description IS NOT NULL LIMIT 1', [itemData.bom_no, itemCode]);
          if (bomItems.length > 0 && bomItems[0].product_name) itemName = bomItems[0].product_name;
        }
      }
      
      if (!itemName) itemName = itemCode; // Fallback to code if still nothing
      const bomNo = itemData.bom_no;
      const quantity = parseFloat(itemData.planned_qty || itemData.required_qty || 0);
      const salesOrderItemId = itemData.sales_order_item_id || null;
      const productionPlanItemId = sourceType === 'FG' ? itemData.id : null;
      const startDate = (itemData.planned_start_date || plan.start_date) || null;
      const endDate = (itemData.planned_end_date || plan.end_date) || null;

      // Check if WO already exists for this plan and item
      const [existing] = await connection.query(
        'SELECT id FROM work_orders WHERE plan_id = ? AND item_code = ? AND source_type = ?',
        [planId, itemCode, sourceType]
      );
      if (existing.length > 0) return existing[0].id;

      // Ensure we have a valid sales_order_id if available
      const effectiveSalesOrderId = plan.sales_order_id || (itemData.sales_order_id) || null;
      const sourceFg = itemData.source_fg || (sourceType === 'FG' ? itemName : null);

      const woNumber = await generateWoNumber(connection);
      
      const [result] = await connection.execute(
        `INSERT INTO work_orders 
         (wo_number, plan_id, production_plan_item_id, parent_wo_id, sales_order_id, sales_order_item_id, 
          item_code, item_name, bom_no, source_type, source_fg, quantity, start_date, end_date, status, priority)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`,
        [
          woNumber, planId, productionPlanItemId, parentId,
          effectiveSalesOrderId, salesOrderItemId,
          itemCode, itemName, bomNo, sourceType, sourceFg, quantity,
          startDate, endDate, plan.production_priority || 'NORMAL'
        ]
      );

      const workOrderId = result.insertId;
      
      // Create Job Cards for both Finished Goods (FG) and Sub-Assemblies (SA)
      await createJobCardsForWorkOrder(workOrderId, connection, 'PENDING', planOps);
      
      return workOrderId;
    };

    // 1. Process Sub Assemblies FIRST
    for (const sa of subAssemblies) {
      const woId = await createWO(sa, 'SA');
      if (woId) {
        createdWorkOrders.push(woId);
        saWorkOrderIds.push(woId);
      }
    }

    // 2. Process Finished Goods SECOND
    for (const item of items) {
      const woId = await createWO(item, 'FG');
      if (woId) {
        createdWorkOrders.push(woId);
        if (!parentWoId) parentWoId = woId; // Use first FG as parent for linking
      }
    }

    // 3. Link SAs to parent FG if applicable
    if (parentWoId && saWorkOrderIds.length > 0) {
      // Fetch parent info to update SAs
      const [parents] = await connection.query('SELECT item_name FROM work_orders WHERE id = ?', [parentWoId]);
      const parentName = parents.length > 0 ? parents[0].item_name : null;

      await connection.query(
        'UPDATE work_orders SET parent_wo_id = ?, source_fg = ? WHERE id IN (?) AND source_fg IS NULL',
        [parentWoId, parentName, saWorkOrderIds]
      );
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
    `SELECT wo.*, so.project_name, 
            COALESCE(soi.item_code, wo.item_code) as item_code, 
            COALESCE(soi.description, wo.item_name) as description, 
            w.workstation_name
     FROM work_orders wo
     LEFT JOIN sales_orders so ON wo.sales_order_id = so.id
     LEFT JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
     LEFT JOIN workstations w ON wo.workstation_id = w.id
     WHERE wo.id = ?`,
    [id]
  );
  return rows[0];
};

const getWorkOrderMaterialRequirements = async (id) => {
  const [woRows] = await pool.query(
    'SELECT id, item_code, quantity, sales_order_item_id, bom_no FROM work_orders WHERE id = ?',
    [id]
  );
  if (woRows.length === 0) return [];
  const wo = woRows[0];

  // 1. Get BOM materials
  const materials = await bomService.getItemMaterials(wo.sales_order_item_id, wo.item_code, wo.bom_no);
  
  // 2. Get Issued quantities for this WO
  const [issuedRows] = await pool.query(
    `SELECT mii.item_code, SUM(mii.quantity) as issued_qty 
     FROM material_issue_items mii
     JOIN material_issues mi ON mii.issue_id = mi.id
     WHERE mi.work_order_id = ?
     GROUP BY mii.item_code`,
    [id]
  );
  const issuedMap = {};
  issuedRows.forEach(row => {
    issuedMap[row.item_code] = parseFloat(row.issued_qty || 0);
  });

  // 3. Get Consumed quantities for this WO
  const [consumedRows] = await pool.query(
    `SELECT item_code, SUM(quantity) as consumed_qty 
     FROM work_order_material_consumption
     WHERE work_order_id = ?
     GROUP BY item_code`,
    [id]
  );
  const consumedMap = {};
  consumedRows.forEach(row => {
    consumedMap[row.item_code] = parseFloat(row.consumed_qty || 0);
  });

  // 4. Get Current Stock for these items
  // We use material_name to match stock if item_code doesn't match directly
  const stockMap = {};
  const [stockRows] = await pool.query(
    `SELECT LOWER(TRIM(material_name)) as match_name, MAX(item_code) as actual_item_code, SUM(current_balance) as total_stock 
     FROM stock_balance 
     GROUP BY LOWER(TRIM(material_name))`
  );
  stockRows.forEach(row => {
    stockMap[row.match_name] = {
      item_code: row.actual_item_code,
      total_stock: parseFloat(row.total_stock || 0)
    };
  });

  // 5. Merge data
  return materials.map(m => {
    const required = parseFloat(m.qty_per_pc || 0) * parseFloat(wo.quantity || 0);
    const matchName = (m.material_name || "").toLowerCase().trim();
    const stockData = stockMap[matchName] || { item_code: m.item_code, total_stock: 0 };
    const actualItemCode = stockData.item_code;
    
    const issued = issuedMap[actualItemCode] || issuedMap[m.item_code] || 0;
    const consumed = consumedMap[actualItemCode] || consumedMap[m.item_code] || 0;
    const totalStock = stockData.total_stock;
    
    return {
      item_code: actualItemCode,
      material_name: m.material_name,
      material_type: m.material_type,
      uom: m.uom,
      source_assembly: m.drawing_no || m.item_code,
      required_qty: required.toFixed(3),
      issued_qty: (required - consumed).toFixed(3),
      consumed_qty: consumed.toFixed(3),
      total_stock: totalStock.toFixed(3),
      remaining_qty: (totalStock - consumed).toFixed(3)
    };
  });
};

const updateMaterialConsumption = async (workOrderId, consumptionData, userId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Get WO number for remarks
    const [woRows] = await connection.query('SELECT wo_number FROM work_orders WHERE id = ?', [workOrderId]);
    const woNumber = woRows[0]?.wo_number || workOrderId;

    for (const item of consumptionData) {
      // Only insert if quantity > 0
      if (parseFloat(item.quantity || 0) <= 0) continue;

      const [result] = await connection.execute(
        `INSERT INTO work_order_material_consumption 
         (work_order_id, item_code, material_name, material_type, quantity, uom, created_by, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          workOrderId, 
          item.item_code, 
          item.material_name, 
          item.material_type, 
          item.quantity, 
          item.uom, 
          userId, 
          item.remarks || `Consumed for WO ${woNumber}`
        ]
      );

      const consumptionId = result.insertId;

      // Deduct from stock (transaction_type = 'OUT')
      // Note: We use 'MATERIAL_CONSUMPTION' as ref_doc_type
      await stockService.addStockLedgerEntry(
        item.item_code,
        'OUT',
        item.quantity,
        'MATERIAL_CONSUMPTION',
        consumptionId,
        `CON-${consumptionId}`,
        {
          remarks: `Consumed for WO ${woNumber}`,
          userId: userId,
          materialName: item.material_name,
          materialType: item.material_type,
          unit: item.uom,
          connection: connection
        }
      );
    }

    await connection.commit();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const generateJobCardNo = async (connection) => {
  const conn = connection || pool;
  const [rows] = await conn.query('SELECT COUNT(*) as count FROM job_cards');
  const count = rows[0].count + 1;
  const random = Math.floor(Math.random() * 1000);
  return `JC-${String(count).padStart(4, '0')}-${random}`;
};

const createJobCardsForWorkOrder = async (workOrderId, connection, initialStatus = 'DRAFT', providedOperations = null) => {
  // 1. Fetch WO details
  const [woRows] = await connection.query(
    'SELECT item_code, item_name, bom_no, quantity, sales_order_item_id, source_type, source_fg FROM work_orders WHERE id = ?',
    [workOrderId]
  );
  if (woRows.length === 0) return;
  const wo = woRows[0];

  // 2. Check if Job Cards already exist
  const [existingJc] = await connection.query('SELECT id FROM job_cards WHERE work_order_id = ?', [workOrderId]);
  if (existingJc.length > 0) return;

  // 3. Get Operations
  let operationsToUse = [];
  if (providedOperations && Array.isArray(providedOperations)) {
    // If operations are provided, use them strictly
    // IMPROVED: If we are creating job cards for a Finished Good WO, 
    // we should include all operations where source_item matches item_code OR drawing_no
    // OR if the operation item_type is 'FG' and this is an 'FG' work order.
    
    const [woDetails] = await connection.query('SELECT drawing_no, item_code FROM sales_order_items WHERE id = ?', [wo.sales_order_item_id]);
    const woDrawing = woDetails[0]?.drawing_no || wo.bom_no;
    const woSoiCode = woDetails[0]?.item_code;

    operationsToUse = providedOperations.filter(op => {
      const opSource = (op.source_item || op.sourceItem || '').toUpperCase();
      const opType = (op.item_type || op.itemType || '').toUpperCase();
      
      const targetCode = (wo.item_code || '').toUpperCase();
      const targetDrawing = (woDrawing || '').toUpperCase();
      const targetSoiCode = (woSoiCode || '').toUpperCase();
      const targetName = (wo.item_name || '').toUpperCase();
      const targetSourceFg = (wo.source_fg || '').toUpperCase();

      const isFG = wo.source_type === 'FG';
      const isSA = wo.source_type === 'SA';
      const opIsFG = ['FG', 'FINISHED GOOD', 'FINISHED GOODS'].includes(opType);
      const opIsSA = ['SA', 'SUB ASSEMBLY', 'SUB-ASSEMBLY', 'SUBASSEMBLY'].includes(opType);

      // Priority 1: Direct match by source item code, drawing, name, source_fg, or SOI code
      if (opSource) {
        // If opSource is specified, it MUST match one of the identifiers 
        // AND the item type must also match to avoid cross-contamination between FG and SA
        const sourceMatches = (opSource === targetCode || 
                               (targetDrawing && opSource === targetDrawing) ||
                               (targetSoiCode && opSource === targetSoiCode) ||
                               (targetName && opSource === targetName) ||
                               (targetSourceFg && opSource === targetSourceFg));
        
        const typeMatches = (isFG && opIsFG) || (isSA && opIsSA);
        
        if (sourceMatches && typeMatches) return true;
      }

      // Priority 2: If opSource is NOT specified, fallback to matching strictly by type
      if (!opSource) {
        if (isFG && opIsFG) return true;
        if (isSA && opIsSA) return true;
      }

      return false;
    }).map(op => ({
      operation_name: op.operation_name || op.operationName,
      workstation: op.workstation,
      base_time: op.base_time || op.cycle_time_min || op.baseTime,
      net_time: op.net_time || op.netTime || op.base_time || op.cycle_time_min || op.baseTime,
      time_uom: op.time_uom || op.timeUom || 'Min',
      hourly_rate: op.hourly_rate || op.hourlyRate,
      operation_type: op.process_type || op.processType || op.operation_type || op.operationType || 'In-House',
      execution_type: op.process_type || op.processType || op.operation_type || op.operationType || 'In-House'
    }));
  } else {
    // Fetch from BOM if not provided (fallback)
    if (wo.source_type === 'SA' || !wo.sales_order_item_id) {
      operationsToUse = await bomService.getItemOperations(null, wo.item_code);
    } else {
      operationsToUse = await bomService.getItemOperations(wo.sales_order_item_id, wo.item_code);
    }
    // Ensure execution_type is set for fallback operations too
    operationsToUse = operationsToUse.map(op => ({
      ...op,
      operation_name: op.operation_name,
      execution_type: op.operation_type || 'In-House'
    }));
  }
  
  // 4. Create Job Cards for defined operations
  for (let i = 0; i < operationsToUse.length; i++) {
    const op = operationsToUse[i];
    const sequenceNo = i + 1;
    const [masterOps] = await connection.query(
      'SELECT id, std_time, time_uom, hourly_rate FROM operations WHERE operation_name = ?',
      [op.operation_name]
    );
    const [masterWs] = await connection.query(
      'SELECT id FROM workstations WHERE workstation_name = ?',
      [op.workstation]
    );

    // Fetch warehouse ID if target_warehouse is provided
    let targetWarehouseId = null;
    const targetWhName = op.target_warehouse || op.targetWarehouse;
    if (targetWhName) {
      const [whRows] = await connection.query('SELECT id FROM warehouses WHERE warehouse_name = ?', [targetWhName]);
      if (whRows.length > 0) targetWarehouseId = whRows[0].id;
    }

    const jcNo = await generateJobCardNo(connection);
    let stdTime = op.net_time || op.base_time || op.cycle_time_min || masterOps[0]?.std_time || 0;
    
    // If it's from production_plan_operations (op.net_time), it's stored in Hours in database but we use Min in Job Cards
    // We check if net_time is explicitly provided which is the case for Production Plan operations
    if (op.net_time) {
      stdTime = parseFloat(op.net_time) * 60;
    }

    const cycleTime = op.cycle_time_min || (masterOps[0]?.std_time && masterOps[0]?.time_uom === 'Min' ? masterOps[0]?.std_time : 0);
    const setupTime = op.setup_time_min || 0;

    // If it's from op.base_time or op.cycle_time_min, it's almost always intended as Min in this system
    const timeUom = (op.net_time || op.base_time || op.cycle_time_min) ? 'Min' : (masterOps[0]?.time_uom || 'Min');
    const hourlyRate = op.hourly_rate || masterOps[0]?.hourly_rate || 0;
    const executionType = op.operation_type || 'In-House';

    await connection.execute(
      `INSERT INTO job_cards 
       (job_card_no, work_order_id, operation_id, workstation_id, planned_qty, status, std_time, time_uom, hourly_rate, operation_name, execution_type, execution_mode, sequence_no, target_warehouse_id, cycle_time, setup_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [jcNo, workOrderId, masterOps[0]?.id || null, masterWs[0]?.id || null, wo.quantity, initialStatus, stdTime, timeUom, hourlyRate, op.operation_name, executionType, executionType, sequenceNo, targetWarehouseId, cycleTime, setupTime]
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

    // 1. Get production plan item id to revert status
    const [woRows] = await connection.query('SELECT production_plan_item_id FROM work_orders WHERE id = ?', [id]);
    if (woRows.length === 0) throw new Error('Work Order not found');
    const productionPlanItemId = woRows[0].production_plan_item_id;

    // 2. Delete associated material issues and their items
    await connection.execute(`
      DELETE mii FROM material_issue_items mii
      JOIN material_issues mi ON mii.issue_id = mi.id
      WHERE mi.work_order_id = ?
    `, [id]);
    await connection.execute('DELETE FROM material_issues WHERE work_order_id = ?', [id]);

    // 3. Delete associated job cards
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

const generateWoNumber = async (connection) => {
  const conn = connection || pool;
  const [rows] = await conn.query('SELECT COUNT(*) as count FROM work_orders');
  const count = rows[0].count + 1;
  const random = Math.floor(Math.random() * 1000); // Add randomness for fast loops
  return `WO-${String(count).padStart(5, '0')}-${random}`;
};

module.exports = {
  listWorkOrders,
  createWorkOrdersFromPlan,
  createWorkOrder,
  getWorkOrderById,
  updateWorkOrderStatus,
  deleteWorkOrder,
  generateWoNumber,
  getWorkOrderMaterialRequirements,
  updateMaterialConsumption
};
