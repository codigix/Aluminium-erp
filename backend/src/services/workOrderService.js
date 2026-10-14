const pool = require('../config/db');
const bomService = require('./bomService');
const stockService = require('./stockService');
const { nextDocumentNumber } = require('../utils/documentNumber');
const { logProductionEvent } = require('./productionAuditService');
const {
  QTY_TOLERANCE,
  productionError,
  canTransitionWorkOrder,
  WORK_ORDER_BLOCKED_FOR_ACTIVITY,
  isSubcontractJobCard
} = require('../config/productionWorkflow');

const listWorkOrders = async () => {
  const [rows] = await pool.query(
    `SELECT wo.*, COALESCE(so.project_name, o_dir.project_name) as project_name, w.workstation_name, COALESCE(c.company_name, c_dir.company_name) as client_name,
            COALESCE(
              CASE WHEN cd.drawing_type IS NOT NULL AND cd.drawing_type != '' THEN cd.drawing_type END,
              CASE WHEN soi.item_group IS NOT NULL AND soi.item_group != '' THEN soi.item_group END,
              CASE WHEN soic.item_group IS NOT NULL AND soic.item_group != '' THEN soic.item_group END,
              CASE WHEN sb.material_type IS NOT NULL AND sb.material_type != '' THEN sb.material_type END,
              soi_item.item_group,
              ''
            ) as item_group,
            COALESCE(
              CASE WHEN cd.drawing_type IS NOT NULL AND cd.drawing_type != '' THEN cd.drawing_type END,
              CASE WHEN soi.drawing_type IS NOT NULL AND soi.drawing_type != '' THEN soi.drawing_type END,
              CASE WHEN soic.item_group IS NOT NULL AND soic.item_group != '' THEN soic.item_group END,
              CASE WHEN sb.material_type IS NOT NULL AND sb.material_type != '' THEN sb.material_type END,
              soi_item.drawing_type,
              ''
            ) as drawing_type,
            COALESCE(soi_parent.description, oi_parent.description, soi_source.description, soi_fallback.description, oi_fallback.description, wo_parent.item_name, wo.source_fg) as source_fg,
            (SELECT COUNT(*) FROM job_cards WHERE work_order_id = wo.id) as total_job_cards,
            (SELECT COUNT(*) FROM job_cards WHERE work_order_id = wo.id AND status = 'COMPLETED') as completed_job_cards,
            (SELECT COUNT(*) FROM job_cards WHERE work_order_id = wo.id AND status = 'ON_HOLD') as held_job_cards,
            (SELECT COUNT(*) FROM job_cards WHERE work_order_id = wo.id AND status = 'IN_PROGRESS') as running_job_cards,
            pp.plan_code,
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
     LEFT JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
     LEFT JOIN sales_order_items soi_item ON (soi.id IS NULL AND wo.item_code = soi_item.item_code)
     LEFT JOIN stock_balance sb ON wo.item_code = sb.item_code
     LEFT JOIN (
       SELECT component_code, MAX(item_group) as item_group 
       FROM sales_order_item_components 
       GROUP BY component_code
     ) soic ON wo.item_code = soic.component_code
     LEFT JOIN customer_drawings cd ON wo.item_code = cd.drawing_no
     LEFT JOIN sales_orders so ON (
       (soi.id IS NOT NULL AND soi.sales_order_id = so.id) OR
       (soi.id IS NULL AND soi_parent.id IS NOT NULL AND soi_parent.sales_order_id = so.id) OR
       (soi.id IS NULL AND soi_parent.id IS NULL AND wo.sales_order_id = so.id)
     )
     LEFT JOIN companies c ON so.company_id = c.id
     LEFT JOIN orders o_dir ON wo.sales_order_id = o_dir.id AND o_dir.source_type = 'DIRECT' AND soi.id IS NULL AND soi_parent.id IS NULL
     LEFT JOIN companies c_dir ON o_dir.client_id = c_dir.id
     LEFT JOIN production_plans pp ON wo.plan_id = pp.id
     LEFT JOIN workstations w ON wo.workstation_id = w.id
     ORDER BY batch_latest_id DESC, CASE WHEN wo.source_type = 'SA' OR wo.source_type = 'PART' THEN 0 ELSE 1 END ASC, wo.id ASC`
  );
  return rows;
};

const createWorkOrdersFromPlan = async (planId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Fetch Plan Details & LIVE operations
    const [plans] = await connection.query('SELECT * FROM production_plans WHERE id = ?', [planId]);
    if (plans.length === 0) throw new Error('Production Plan not found');
    const plan = plans[0];

    // Fetch LIVE operations from BOM (via productionPlanService)
    const productionPlanService = require('./productionPlanService');
    const livePlanData = await productionPlanService.getProductionPlanById(planId);
    const planOps = (livePlanData && livePlanData.operations && livePlanData.operations.length > 0)
      ? livePlanData.operations
      : (await connection.query('SELECT * FROM production_plan_operations WHERE plan_id = ? ORDER BY step_no ASC', [planId]))[0];

    // 2. Fetch Finished Goods
    const [items] = await connection.query('SELECT * FROM production_plan_items WHERE plan_id = ?', [planId]);
    
    // 3. Fetch Sub Assemblies
    const [subAssemblies] = await connection.query('SELECT * FROM production_plan_sub_assemblies WHERE plan_id = ?', [planId]);

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
        'SELECT id, status FROM work_orders WHERE plan_id = ? AND item_code = ? AND source_type = ?',
        [planId, itemCode, sourceType]
      );
      if (existing.length > 0) {
        const woId = existing[0].id;
        // If WO is still DRAFT/PENDING, update its job cards to reflect latest updated BOM operations
        if (existing[0].status === 'DRAFT' || existing[0].status === 'PENDING') {
          await connection.execute('DELETE FROM job_cards WHERE work_order_id = ? AND status = "PENDING"', [woId]);
          await createJobCardsForWorkOrder(woId, connection, 'PENDING', planOps);
        }
        return woId;
      }

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
      
      // Create Job Cards for both Finished Goods (FG) and Sub-Assemblies (SA) using LIVE operations
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

    // 2. Process Finished Goods / Parts SECOND
    for (const item of items) {
      const isPartItem = Boolean(livePlanData?.is_part_plan) ||
                         (item.item_group && item.item_group.toLowerCase() === 'part') ||
                         (String(item.item_code || '').toUpperCase().startsWith('PART-'));
      const woSourceType = isPartItem ? 'PART' : 'FG';
      const woId = await createWO(item, woSourceType);
      if (woId) {
        createdWorkOrders.push(woId);
        if (!parentWoId && !isPartItem) parentWoId = woId; // Use first FG as parent for linking
      }
    }

    // 3. Link SAs to parent FG if applicable
    if (parentWoId && saWorkOrderIds.length > 0) {
      // Fetch parent info to update SAs
      const [parents] = await connection.query('SELECT item_name FROM work_orders WHERE id = ?', [parentWoId]);
      const parentName = parents.length > 0 ? parents[0].item_name : null;

      await connection.query(
        'UPDATE work_orders SET parent_wo_id = ?, source_fg = COALESCE(source_fg, ?) WHERE id IN (?)',
        [parentWoId, parentName, saWorkOrderIds]
      );
    }

    // Record which work orders feed which assembly; unlinked ones stay independent
    await require('./productionFlowService').syncDependencies(connection, planId);

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
    productionPlanItemId, salesOrderId, salesOrderItemId, 
    workstationId, quantity, startDate, endDate, priority, remarks,
    status = 'RELEASED'
  } = data;

  if (!(parseFloat(quantity) > 0)) {
    throw productionError('Work Order quantity must be greater than zero', 400);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // The number is always issued here, inside the transaction, so a stale or
    // duplicated number from the form can never collide
    const woNumber = await generateWoNumber(connection);

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
    `SELECT wo.*, COALESCE(so.project_name, o_dir.project_name) as project_name, 
            COALESCE(soi.item_code, wo.item_code) as item_code, 
            COALESCE(soi.description, wo.item_name) as description, 
            w.workstation_name
     FROM work_orders wo
     LEFT JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
     LEFT JOIN sales_orders so ON (
       (soi.id IS NOT NULL AND soi.sales_order_id = so.id) OR
       (soi.id IS NULL AND wo.sales_order_id = so.id)
     )
     LEFT JOIN orders o_dir ON wo.sales_order_id = o_dir.id AND o_dir.source_type = 'DIRECT' AND (soi.id IS NULL OR soi.sales_order_id != wo.sales_order_id) OR
       (soi.id IS NULL AND wo.sales_order_id = so.id)
     )
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

  const [returnedRows] = await pool.query(
    `SELECT item_code, SUM(quantity) as returned_qty FROM work_order_material_returns WHERE work_order_id = ? GROUP BY item_code`,
    [id]
  );
  const returnedMap = {};
  returnedRows.forEach(row => {
    returnedMap[row.item_code] = parseFloat(row.returned_qty || 0);
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
      issued_qty: issued.toFixed(3),
      consumed_qty: consumed.toFixed(3),
      returned_qty: (returnedMap[actualItemCode] || returnedMap[m.item_code] || 0).toFixed(3),
      on_floor_qty: (issued - consumed - (returnedMap[actualItemCode] || returnedMap[m.item_code] || 0)).toFixed(3),
      total_stock: totalStock.toFixed(3),
      remaining_qty: (totalStock - consumed).toFixed(3)
    };
  });
};

// Per material: issued to the work order, consumed, returned (incl. offcut / scrap) and what is
// still on the shop floor. Matched on item code.
const getMaterialBalances = async (connection, workOrderId) => {
  const [issued] = await connection.query(
    `SELECT mii.item_code, MAX(mii.material_name) AS material_name, MAX(mii.uom) AS uom, SUM(mii.quantity) AS qty
     FROM material_issue_items mii JOIN material_issues mi ON mii.issue_id = mi.id
     WHERE mi.work_order_id = ? GROUP BY mii.item_code`,
    [workOrderId]
  );
  const [consumed] = await connection.query(
    'SELECT item_code, SUM(quantity) AS qty FROM work_order_material_consumption WHERE work_order_id = ? GROUP BY item_code',
    [workOrderId]
  );
  const [returned] = await connection.query(
    `SELECT item_code, SUM(CASE WHEN return_type = 'SCRAP' THEN 0 ELSE quantity END) AS to_stock,
            SUM(CASE WHEN return_type = 'SCRAP' THEN quantity ELSE 0 END) AS scrapped
     FROM work_order_material_returns WHERE work_order_id = ? GROUP BY item_code`,
    [workOrderId]
  );

  const consumedMap = new Map(consumed.map(r => [r.item_code, parseFloat(r.qty) || 0]));
  const returnedMap = new Map(returned.map(r => [r.item_code, { toStock: parseFloat(r.to_stock) || 0, scrapped: parseFloat(r.scrapped) || 0 }]));

  const rows = issued.map(r => {
    const issuedQty = parseFloat(r.qty) || 0;
    const consumedQty = consumedMap.get(r.item_code) || 0;
    const ret = returnedMap.get(r.item_code) || { toStock: 0, scrapped: 0 };
    return {
      item_code: r.item_code,
      material_name: r.material_name,
      uom: r.uom,
      issued: issuedQty,
      consumed: consumedQty,
      returned_to_stock: ret.toStock,
      scrapped: ret.scrapped,
      on_floor: Math.round((issuedQty - consumedQty - ret.toStock - ret.scrapped) * 1000) / 1000
    };
  });

  // Consumption / returns recorded against material that was never issued
  for (const [code, qty] of consumedMap) {
    if (!issued.some(r => r.item_code === code)) {
      rows.push({ item_code: code, material_name: null, uom: null, issued: 0, consumed: qty, returned_to_stock: 0, scrapped: 0, on_floor: -qty });
    }
  }
  return rows;
};

const getMaterialReconciliation = async (workOrderId) => {
  const [woRows] = await pool.query('SELECT id, wo_number, status, plan_id FROM work_orders WHERE id = ?', [workOrderId]);
  if (woRows.length === 0) throw productionError('Work Order not found', 404);
  const items = await getMaterialBalances(pool, workOrderId);
  return {
    workOrderId: woRows[0].id,
    woNumber: woRows[0].wo_number,
    status: woRows[0].status,
    items,
    outstanding: items.filter(r => r.on_floor > QTY_TOLERANCE).length
  };
};

// Consumption only records usage against material already issued to this work order.
// The stock itself was deducted once, when it left the store, so nothing is posted here.
const updateMaterialConsumption = async (workOrderId, consumptionData, userId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [woRows] = await connection.query('SELECT wo_number, status FROM work_orders WHERE id = ? FOR UPDATE', [workOrderId]);
    if (woRows.length === 0) throw productionError('Work Order not found', 404);
    if (WORK_ORDER_BLOCKED_FOR_ACTIVITY.includes(woRows[0].status)) {
      throw productionError(`Cannot record material consumption: Work Order is ${woRows[0].status}`);
    }
    const woNumber = woRows[0].wo_number || workOrderId;

    if (!Array.isArray(consumptionData)) {
      throw productionError('Consumption data must be a list of items', 400);
    }

    const balances = await getMaterialBalances(connection, workOrderId);
    const onFloor = new Map(balances.map(r => [r.item_code, r.on_floor]));

    for (const item of consumptionData) {
      const consumedQty = parseFloat(item.quantity || 0);
      if (Number.isNaN(consumedQty) || consumedQty < 0) {
        throw productionError(`Invalid consumption quantity for ${item.material_name || item.item_code}`, 400);
      }
      if (consumedQty <= 0) continue;
      if (!item.item_code) {
        throw productionError(`Consumption for ${item.material_name || 'material'} needs an item code`, 400);
      }

      const available = onFloor.get(item.item_code) || 0;
      if (consumedQty > available + QTY_TOLERANCE) {
        throw productionError(
          `Cannot consume ${consumedQty} of ${item.material_name || item.item_code}: only ${Math.max(0, available)} is issued and unused on ${woNumber}. Issue the material to this work order first.`
        );
      }
      onFloor.set(item.item_code, available - consumedQty);

      await connection.execute(
        `INSERT INTO work_order_material_consumption
         (work_order_id, item_code, material_name, material_type, quantity, uom, created_by, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [workOrderId, item.item_code, item.material_name, item.material_type, consumedQty, item.uom, userId, item.remarks || `Consumed for WO ${woNumber}`]
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

// Unused material goes back to stock; offcut re-enters stock as remnant; scrap is written off.
const returnMaterial = async (workOrderId, items, userId = null) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw productionError('Add at least one material to return', 400);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [woRows] = await connection.query('SELECT wo_number, status FROM work_orders WHERE id = ? FOR UPDATE', [workOrderId]);
    if (woRows.length === 0) throw productionError('Work Order not found', 404);
    const woNumber = woRows[0].wo_number;

    const balances = await getMaterialBalances(connection, workOrderId);
    const onFloor = new Map(balances.map(r => [r.item_code, r.on_floor]));
    const created = [];

    for (const item of items) {
      const qty = parseFloat(item.quantity);
      const type = String(item.returnType || item.return_type || 'RETURN').toUpperCase();
      if (!['RETURN', 'OFFCUT', 'SCRAP'].includes(type)) {
        throw productionError(`Unknown return type "${type}"`, 400);
      }
      const code = item.item_code || item.itemCode;
      if (!code) throw productionError('A return needs the item code of the issued material', 400);
      if (!(qty > 0)) throw productionError(`Return quantity for ${item.material_name || code} must be greater than zero`, 400);

      const available = onFloor.get(code) || 0;
      if (qty > available + QTY_TOLERANCE) {
        throw productionError(`Cannot return ${qty} of ${item.material_name || code}: only ${Math.max(0, available)} is issued and unused on ${woNumber}.`);
      }
      onFloor.set(code, available - qty);

      const [result] = await connection.execute(
        `INSERT INTO work_order_material_returns
         (work_order_id, item_code, material_name, material_type, quantity, uom, return_type, warehouse, remarks, returned_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [workOrderId, code, item.material_name || item.materialName || null, item.material_type || item.materialType || null,
         qty, item.uom || null, type, item.warehouse || null, item.remarks || null, userId]
      );

      if (type !== 'SCRAP') {
        await stockService.addStockLedgerEntry(
          code,
          'IN',
          qty,
          'PRODUCTION_RETURN',
          result.insertId,
          `RET-${result.insertId}`,
          {
            connection,
            remarks: `${type === 'OFFCUT' ? 'Offcut' : 'Unused material'} returned from WO ${woNumber}`,
            userId,
            warehouse: item.warehouse || undefined,
            materialName: item.material_name || item.materialName,
            materialType: item.material_type || item.materialType,
            unit: item.uom
          }
        );
      }

      await logProductionEvent(connection, {
        entityType: 'MATERIAL_RETURN', entityId: result.insertId, action: type,
        newValue: `${qty} ${item.uom || ''} ${item.material_name || code} from ${woNumber}`, reason: item.remarks || null, userId
      });
      created.push(result.insertId);
    }

    await connection.commit();
    return { success: true, returnIds: created };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const generateJobCardNo = async (connection) => nextDocumentNumber(connection, 'JOB_CARD');

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

  const [woDetails] = await connection.query(
    'SELECT drawing_no, item_code, drawing_type FROM sales_order_items WHERE id = ?',
    [wo.sales_order_item_id]
  );
  const woDrawing = woDetails[0]?.drawing_no || wo.bom_no;
  const woSoiCode = woDetails[0]?.item_code;
  const woDrawingType = (woDetails[0]?.drawing_type || '').toUpperCase();

  const targetCode = (wo.item_code || '').toUpperCase().trim();
  const targetDrawing = (woDrawing || '').toUpperCase().trim();
  const targetSoiCode = (woSoiCode || '').toUpperCase().trim();
  const targetName = (wo.item_name || '').toUpperCase().trim();
  const targetSourceFg = (wo.source_fg || '').toUpperCase().trim();
  const isPart = (wo.source_type === 'PART' || targetCode.startsWith('PART-') || woDrawingType === 'PART');
  const isFG = wo.source_type === 'FG' || (!isPart && !wo.parent_wo_id);

  // Determine if this Work Order is an internal child component within an assembly
  let isInternalChildPart = Boolean(
    wo.parent_wo_id || 
    wo.source_type === 'SA' ||
    (wo.source_fg && targetSourceFg !== targetCode && targetSourceFg !== targetName)
  );

  if (!isInternalChildPart && wo.plan_id) {
    const [planItems] = await connection.query(
      `SELECT 'FG' as type, item_code FROM production_plan_items WHERE plan_id = ?
       UNION
       SELECT 'SA' as type, item_code FROM production_plan_sub_assemblies WHERE plan_id = ?`,
      [wo.plan_id, wo.plan_id]
    );
    const hasOtherFg = planItems.some(pi => pi.type === 'FG' && (pi.item_code || '').toUpperCase().trim() !== targetCode);
    const hasSa = planItems.some(pi => pi.type === 'SA');
    if ((hasOtherFg || hasSa) && (isPart || wo.source_type === 'PART' || wo.source_type === 'SA')) {
      isInternalChildPart = true;
    }
  }

  if (providedOperations && Array.isArray(providedOperations) && providedOperations.length > 0) {
    // 1. Check if operations in providedOperations explicitly target this item
    const specificToThisWo = providedOperations.filter(op => {
      const opSource = (op.source_item || op.sourceItem || '').toUpperCase().trim();
      if (!opSource) return false;
      return (
        opSource === targetCode ||
        (targetDrawing && opSource === targetDrawing) ||
        (targetSoiCode && opSource === targetSoiCode) ||
        (targetName && opSource === targetName) ||
        (targetSourceFg && opSource === targetSourceFg)
      );
    });

    if (specificToThisWo.length > 0) {
      operationsToUse = specificToThisWo;
      // Also append any generic operations (e.g. Main Item) if not already present
      // BUT do NOT append Shipment or Dispatch to internal child parts!
      const genericOps = providedOperations.filter(op => {
        const opSource = (op.source_item || op.sourceItem || '').toUpperCase().trim();
        const opName = (op.operation_name || op.operationName || '').toUpperCase().trim();
        const isShipment = opName === 'SHIPMENT' || opName === 'DISPATCH';
        if (isInternalChildPart && isShipment) return false;
        const isGeneric = (!opSource || opSource === 'MAIN ITEM') || (!isInternalChildPart && isShipment);
        return isGeneric && !operationsToUse.some(o => (o.operation_name || o.operationName) === (op.operation_name || op.operationName));
      });
      operationsToUse = [...operationsToUse, ...genericOps];
    } else {
      // If no operation explicitly mentions this item code, check if operations are generic for the entire plan
      // E.g. for a single-item plan, all operations belong to this item
      operationsToUse = providedOperations;
    }

    if (isInternalChildPart) {
      operationsToUse = operationsToUse.filter(op => {
        const name = (op.operation_name || op.operationName || '').toLowerCase().trim();
        return name !== 'shipment' && name !== 'dispatch';
      });
    }

    operationsToUse = operationsToUse.map(op => ({
      operation_name: op.operation_name || op.operationName,
      workstation: op.workstation,
      base_time: op.base_time || op.cycle_time_min || op.baseTime,
      net_time: op.net_time || op.netTime || op.base_time || op.cycle_time_min || op.baseTime,
      time_uom: op.time_uom || op.timeUom || 'Min',
      hourly_rate: op.hourly_rate || op.hourlyRate,
      operation_type: op.process_type || op.processType || op.operation_type || op.operationType || 'In-House',
      execution_type: op.process_type || op.processType || op.operation_type || op.operationType || 'In-House',
      cycle_time_min: op.cycle_time_min || op.cycleTimeMin || 0,
      setup_time_min: op.setup_time_min || op.setupTimeMin || 0,
      target_warehouse: op.target_warehouse || op.targetWarehouse || null
    }));
  }

  // Fallback: Fetch directly from BOM operations if no operations were matched from providedOperations
  if (operationsToUse.length === 0) {
    let fallbackOps = [];
    if (wo.sales_order_item_id) {
      fallbackOps = await bomService.getItemOperations(wo.sales_order_item_id, wo.item_code);
    }
    if (!fallbackOps || fallbackOps.length === 0) {
      fallbackOps = await bomService.getItemOperations(null, wo.item_code, wo.bom_no);
    }
    if (fallbackOps && fallbackOps.length > 0) {
      let filteredFallback = fallbackOps;
      if (isInternalChildPart) {
        filteredFallback = fallbackOps.filter(op => {
          const name = (op.operation_name || '').toLowerCase().trim();
          return name !== 'shipment' && name !== 'dispatch';
        });
      }
      operationsToUse = filteredFallback.map(op => ({
        ...op,
        operation_name: op.operation_name,
        execution_type: op.operation_type || 'In-House'
      }));
    }
  }

  // Ensure Shipment as final operation ONLY for parent Assembly/FG or standalone customer parts
  if (!isInternalChildPart) {
    const { ensureShipmentAsFinalOperation } = require('./productionPlanService');
    operationsToUse = ensureShipmentAsFinalOperation(operationsToUse, {
      sourceItem: targetCode || 'Main Item',
      isPartPlan: isPart,
      itemGroup: isPart ? 'Part' : 'Assembly',
      itemType: isPart ? 'PART' : 'FG',
      isInternalChildPart: false
    });
  } else {
    // For internal child parts, eliminate Shipment and re-index steps sequentially
    operationsToUse = operationsToUse
      .filter(op => {
        const name = (op.operation_name || op.operationName || '').toLowerCase().trim();
        return name !== 'shipment' && name !== 'dispatch';
      })
      .map((op, idx) => ({
        ...op,
        step_no: idx + 1,
        step: String(idx + 1).padStart(2, '0')
      }));
  }

  // 4. Create Job Cards for each defined operation
  for (let i = 0; i < operationsToUse.length; i++) {
    const op = operationsToUse[i];
    const sequenceNo = i + 1;

    // Do not create duplicate Job Cards when the same Work Order / Operation already has a Job Card
    const [existingOpJc] = await connection.query(
      'SELECT id FROM job_cards WHERE work_order_id = ? AND LOWER(TRIM(operation_name)) = LOWER(TRIM(?))',
      [workOrderId, op.operation_name]
    );
    if (existingOpJc.length > 0) continue;
    const [masterOps] = await connection.query(
      'SELECT id, std_time, time_uom, hourly_rate FROM operations WHERE LOWER(TRIM(operation_name)) = LOWER(TRIM(?))',
      [op.operation_name]
    );
    // Routings store the workstation code (WS-0009) far more often than its name, so accept either;
    // matching the name only left most job cards without a machine
    const [masterWs] = await connection.query(
      'SELECT id FROM workstations WHERE LOWER(TRIM(workstation_name)) = LOWER(TRIM(?)) OR LOWER(TRIM(workstation_code)) = LOWER(TRIM(?)) LIMIT 1',
      [op.workstation, op.workstation]
    );

    // Fetch warehouse ID if target_warehouse is provided
    let targetWarehouseId = null;
    const targetWhName = op.target_warehouse || op.targetWarehouse;
    if (targetWhName) {
      const [whRows] = await connection.query(
        'SELECT id FROM warehouses WHERE LOWER(TRIM(warehouse_name)) = LOWER(TRIM(?))',
        [targetWhName]
      );
      if (whRows.length > 0) targetWarehouseId = whRows[0].id;
    } else if (isInternalChildPart && sequenceNo === operationsToUse.length) {
      // Completed internal child parts transfer to Assembly Staging / Store warehouse
      const [stagingWh] = await connection.query(
        "SELECT id FROM warehouses WHERE LOWER(TRIM(warehouse_name)) LIKE '%staging%' OR LOWER(TRIM(warehouse_name)) LIKE '%assembly%' OR LOWER(TRIM(warehouse_name)) LIKE '%store%' LIMIT 1"
      );
      if (stagingWh.length > 0) targetWarehouseId = stagingWh[0].id;
    }

    const jcNo = await generateJobCardNo(connection);
    let stdTime = parseFloat(op.cycle_time_min || 0);
    if (!stdTime) {
      stdTime = op.net_time || op.base_time || masterOps[0]?.std_time || 0;
      if (op.net_time) {
        stdTime = parseFloat(op.net_time) * 60;
      }
    }

    const cycleTime = op.cycle_time_min || (masterOps[0]?.std_time && masterOps[0]?.time_uom === 'Min' ? masterOps[0]?.std_time : 0);
    const setupTime = op.setup_time_min || 0;

    const timeUom = (op.net_time || op.base_time || op.cycle_time_min) ? 'Min' : (masterOps[0]?.time_uom || 'Min');
    const hourlyRate = op.hourly_rate || masterOps[0]?.hourly_rate || 0;
    const executionType = op.operation_type || op.execution_type || 'In-House';
    const executionMode = isSubcontractJobCard({ execution_type: executionType }) ? 'Outsource' : 'In-house';

    // Retain full Work Order target quantity on each operation in the routing
    const initialPlannedQty = parseFloat(wo.quantity || 1);

    await connection.execute(
      `INSERT INTO job_cards 
       (job_card_no, work_order_id, operation_id, workstation_id, planned_qty, status, std_time, time_uom, hourly_rate, operation_name, execution_type, execution_mode, sequence_no, target_warehouse_id, cycle_time, setup_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        jcNo,
        workOrderId,
        masterOps[0]?.id || null,
        masterWs[0]?.id || null,
        initialPlannedQty,
        initialStatus,
        stdTime,
        timeUom,
        hourlyRate,
        op.operation_name,
        executionType,
        executionMode,
        sequenceNo,
        targetWarehouseId,
        cycleTime,
        setupTime
      ]
    );
  }
};
const updateWorkOrderStatus = async (id, status, userId = null, reason = null) => {
  const targetStatus = String(status || '').trim().toUpperCase();
  const validStatuses = ['DRAFT', 'RELEASED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
  if (!validStatuses.includes(targetStatus)) {
    throw productionError(`Invalid Work Order status "${status}"`, 400);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [woRows] = await connection.query('SELECT status FROM work_orders WHERE id = ? FOR UPDATE', [id]);
    if (woRows.length === 0) throw productionError('Work Order not found', 404);
    const currentStatus = woRows[0].status || 'DRAFT';

    if (currentStatus === targetStatus) {
      await connection.commit();
      return;
    }
    if (!canTransitionWorkOrder(currentStatus, targetStatus)) {
      throw productionError(`Work Order cannot move from ${currentStatus} to ${targetStatus}`);
    }

    const [jobCards] = await connection.query(
      'SELECT id, status, COALESCE(produced_qty, 0) AS produced_qty FROM job_cards WHERE work_order_id = ?',
      [id]
    );
    const liveJobCards = jobCards.filter(jc => jc.status !== 'CANCELLED');

    if (targetStatus === 'COMPLETED') {
      const open = liveJobCards.filter(jc => jc.status !== 'COMPLETED');
      if (open.length > 0) {
        throw productionError(`Cannot complete Work Order: ${open.length} job card(s) are not completed`);
      }
    }

    if (targetStatus === 'CANCELLED') {
      const onFloor = (await getMaterialBalances(connection, id)).filter(row => row.on_floor > QTY_TOLERANCE);
      if (onFloor.length > 0) {
        throw productionError(`Cannot cancel Work Order: ${onFloor.map(r => `${r.material_name || r.item_code} (${r.on_floor})`).join(', ')} is still issued and unused. Return it to stock first.`);
      }
      const started = jobCards.filter(jc => parseFloat(jc.produced_qty) > 0 || jc.status === 'COMPLETED');
      if (started.length > 0) {
        throw productionError('Cannot cancel Work Order: production is already recorded. Put it ON_HOLD instead.');
      }
      await connection.execute(
        "UPDATE job_cards SET status = 'CANCELLED' WHERE work_order_id = ? AND status != 'COMPLETED'",
        [id]
      );
    }

    await connection.execute('UPDATE work_orders SET status = ? WHERE id = ?', [targetStatus, id]);

    if (targetStatus === 'RELEASED') {
      // Move any DRAFT job cards to PENDING
      await connection.execute('UPDATE job_cards SET status = "PENDING" WHERE work_order_id = ? AND status = "DRAFT"', [id]);

      // Also ensure JCs exist (if they weren't created earlier for some reason)
      await createJobCardsForWorkOrder(id, connection, 'PENDING');
    }

    await logProductionEvent(connection, {
      entityType: 'WORK_ORDER', entityId: Number(id), action: 'STATUS_CHANGE',
      oldValue: currentStatus, newValue: targetStatus, reason, userId
    });

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Edits the planning data of a work order. What may change depends on how far it has progressed:
// quantity is fixed by the production plan (or once any operation has started); dates, priority
// and remarks can always be corrected until the work order is closed.
const updateWorkOrder = async (id, data, userId = null) => {
  const { quantity, startDate, endDate, priority, remarks, workstationId, status } = data;

  const [existingRows] = await pool.query('SELECT * FROM work_orders WHERE id = ?', [id]);
  if (existingRows.length === 0) throw productionError('Work Order not found', 404);
  const current = existingRows[0];

  // A status change goes through the state machine first, so an invalid move changes nothing
  if (status && String(status).toUpperCase() !== current.status) {
    await updateWorkOrderStatus(id, status, userId, 'Changed from the work order form');
  }

  const [[latest]] = await pool.query('SELECT status FROM work_orders WHERE id = ?', [id]);
  if (['COMPLETED', 'CANCELLED'].includes(latest.status)) {
    const noFieldChanges = [quantity, startDate, endDate, priority, remarks, workstationId].every(v => v === undefined);
    if (noFieldChanges) return true;
    throw productionError(`Work Order ${current.wo_number} is ${latest.status} and can no longer be edited`);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('SELECT id FROM work_orders WHERE id = ? FOR UPDATE', [id]);

    const updates = [];
    const params = [];
    const audit = {};

    if (quantity !== undefined && quantity !== null && quantity !== '') {
      const newQty = parseFloat(quantity);
      if (!(newQty > 0)) throw productionError('Quantity must be greater than zero', 400);
      if (Math.abs(newQty - parseFloat(current.quantity)) > QTY_TOLERANCE) {
        if (current.plan_id) {
          throw productionError('Quantity is set by the production plan. Change it on the plan instead.');
        }
        const [[progress]] = await connection.query(
          `SELECT COUNT(*) AS cnt FROM job_cards
           WHERE work_order_id = ? AND (status IN ('IN_PROGRESS', 'COMPLETED', 'PAUSED', 'ON_HOLD') OR COALESCE(produced_qty, 0) > 0)`,
          [id]
        );
        if (Number(progress.cnt) > 0) {
          throw productionError('Quantity cannot be changed once production has started on this work order.');
        }
        updates.push('quantity = ?');
        params.push(newQty);
        audit.quantity = `${current.quantity} -> ${newQty}`;
        // Untouched operations carry the full work order quantity
        await connection.execute(
          "UPDATE job_cards SET planned_qty = ? WHERE work_order_id = ? AND is_rework = 0 AND status IN ('DRAFT', 'PENDING', 'READY') AND COALESCE(produced_qty, 0) = 0",
          [newQty, id]
        );
      }
    }
    if (startDate !== undefined) { updates.push('start_date = ?'); params.push(startDate || null); }
    if (endDate !== undefined) {
      if (endDate && startDate && endDate < startDate) throw productionError('End date cannot be before the start date', 400);
      updates.push('end_date = ?'); params.push(endDate || null);
    }
    if (priority !== undefined && priority !== null && priority !== '') {
      const p = String(priority).toUpperCase();
      if (!['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(p)) throw productionError(`Invalid priority "${priority}"`, 400);
      if (p !== current.priority) audit.priority = `${current.priority} -> ${p}`;
      updates.push('priority = ?'); params.push(p);
    }
    if (remarks !== undefined) { updates.push('remarks = ?'); params.push(remarks || null); }
    if (workstationId !== undefined) { updates.push('workstation_id = ?'); params.push(workstationId || null); }

    if (updates.length > 0) {
      params.push(id);
      await connection.execute(`UPDATE work_orders SET ${updates.join(', ')} WHERE id = ?`, params);
      if (Object.keys(audit).length > 0) {
        await logProductionEvent(connection, { entityType: 'WORK_ORDER', entityId: Number(id), action: 'EDIT', newValue: audit, userId });
      }
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

// Production history (logs, stock movements) must never be silently erased.
// Returns what blocks a delete so the caller can explain it.
const countStartedProduction = async (connection, workOrderId = null) => {
  const scope = workOrderId ? 'AND jc.work_order_id = ?' : '';
  const params = workOrderId ? [workOrderId] : [];
  const woScope = workOrderId ? 'WHERE work_order_id = ?' : '';

  const [[jobs]] = await connection.query(
    `SELECT COUNT(*) AS cnt FROM job_cards jc
     WHERE (jc.status IN ('IN_PROGRESS', 'COMPLETED', 'PAUSED', 'ON_HOLD') OR COALESCE(jc.produced_qty, 0) > 0
            OR EXISTS (SELECT 1 FROM job_card_time_logs tl WHERE tl.job_card_id = jc.id)
            OR EXISTS (SELECT 1 FROM job_card_quality_logs ql WHERE ql.job_card_id = jc.id))
       ${scope}`,
    params
  );
  const [[issues]] = await connection.query(`SELECT COUNT(*) AS cnt FROM material_issues ${woScope}`, params);
  const [[consumption]] = await connection.query(`SELECT COUNT(*) AS cnt FROM work_order_material_consumption ${woScope}`, params);

  return {
    startedJobCards: Number(jobs.cnt),
    materialIssues: Number(issues.cnt),
    consumptionEntries: Number(consumption.cnt)
  };
};

const describeStartedProduction = ({ startedJobCards, materialIssues, consumptionEntries }) =>
  `${startedJobCards} job card(s) started or logged, ${materialIssues} material issue(s), ${consumptionEntries} consumption entr${consumptionEntries === 1 ? 'y' : 'ies'}`;

const deleteWorkOrder = async (id, userId = null) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [woRows] = await connection.query(
      'SELECT production_plan_item_id, status, wo_number FROM work_orders WHERE id = ? FOR UPDATE',
      [id]
    );
    if (woRows.length === 0) throw productionError('Work Order not found', 404);
    const productionPlanItemId = woRows[0].production_plan_item_id;

    const started = await countStartedProduction(connection, id);
    if (started.startedJobCards > 0 || started.materialIssues > 0 || started.consumptionEntries > 0) {
      throw productionError(
        `Work Order ${woRows[0].wo_number} cannot be deleted: ${describeStartedProduction(started)}. Cancel it instead so stock and history stay consistent.`
      );
    }

    // Dissociate payments linked to the job card quality logs to avoid FK constraint fails
    await connection.execute(`
      UPDATE payments p
      JOIN job_card_quality_logs ql ON p.job_card_quality_log_id = ql.id
      JOIN job_cards jc ON ql.job_card_id = jc.id
      SET p.job_card_quality_log_id = NULL
      WHERE jc.work_order_id = ?
    `, [id]);

    await connection.execute('DELETE FROM job_cards WHERE work_order_id = ?', [id]);
    await connection.execute('DELETE FROM work_orders WHERE id = ?', [id]);

    // Revert Production Plan Item status if applicable
    if (productionPlanItemId) {
      await connection.execute(
        'UPDATE production_plan_items SET status = "PENDING" WHERE id = ?',
        [productionPlanItemId]
      );
    }

    await logProductionEvent(connection, {
      entityType: 'WORK_ORDER', entityId: Number(id), action: 'DELETE',
      oldValue: `${woRows[0].wo_number} (${woRows[0].status})`, userId
    });

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// "Reset queue" is only for a clean slate: it refuses to run once any work
// order has production, material issue or consumption behind it.
const deleteAllWorkOrders = async (userId = null) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const started = await countStartedProduction(connection);
    if (started.startedJobCards > 0 || started.materialIssues > 0 || started.consumptionEntries > 0) {
      throw productionError(
        `Cannot delete all Work Orders: ${describeStartedProduction(started)}. Cancel or complete individual work orders instead.`
      );
    }

    // Dissociate payments linked to job card quality logs to avoid FK constraint fails
    await connection.execute(`
      UPDATE payments p
      JOIN job_card_quality_logs ql ON p.job_card_quality_log_id = ql.id
      SET p.job_card_quality_log_id = NULL
    `);

    // Clear outward challans job_card_id
    try {
      await connection.execute('UPDATE outward_challans SET job_card_id = NULL WHERE job_card_id IS NOT NULL');
    } catch (err) {
      // ignore if column or table not present
    }

    await connection.execute('DELETE FROM job_cards');
    const [result] = await connection.execute('DELETE FROM work_orders');

    // Revert production plan items and production plans status to PENDING
    await connection.execute('UPDATE production_plan_items SET status = "PENDING"');
    await connection.execute('UPDATE production_plans SET status = "PENDING" WHERE status = "IN_PROGRESS"');

    await logProductionEvent(connection, {
      entityType: 'WORK_ORDER', action: 'DELETE_ALL', newValue: `${result.affectedRows} work orders`, userId
    });

    await connection.commit();
    return { success: true, deletedCount: result.affectedRows };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// With a connection (open transaction) this issues the next number. Without
// one it only previews the next number and rolls the sequence back, so a form
// that merely displays "next WO number" does not burn numbers.
const generateWoNumber = async (connection) => {
  if (connection) return nextDocumentNumber(connection, 'WORK_ORDER');
  const previewConnection = await pool.getConnection();
  try {
    await previewConnection.beginTransaction();
    const preview = await nextDocumentNumber(previewConnection, 'WORK_ORDER');
    await previewConnection.rollback();
    return preview;
  } catch (error) {
    await previewConnection.rollback();
    throw error;
  } finally {
    previewConnection.release();
  }
};

const cleanUnnecessaryChildPartShipments = async (connectionOrPool = null) => {
  const conn = connectionOrPool || pool;
  try {
    const [redundantJcs] = await conn.query(`
      SELECT 
        jc.id,
        jc.job_card_no,
        jc.work_order_id,
        wo.wo_number,
        wo.item_code
      FROM job_cards jc
      JOIN work_orders wo ON jc.work_order_id = wo.id
      WHERE LOWER(TRIM(jc.operation_name)) IN ('shipment', 'dispatch')
        AND (
          wo.parent_wo_id IS NOT NULL 
          OR wo.source_type = 'SA'
          OR (
            wo.source_fg IS NOT NULL 
            AND UPPER(TRIM(wo.source_fg)) != UPPER(TRIM(wo.item_code))
            AND UPPER(TRIM(wo.source_fg)) != UPPER(TRIM(wo.item_name))
          )
          OR EXISTS (
            SELECT 1 FROM work_orders pwo 
            WHERE pwo.plan_id = wo.plan_id 
              AND pwo.source_type = 'FG' 
              AND pwo.id != wo.id
          )
        )
        AND COALESCE(jc.produced_qty, 0) = 0
        AND COALESCE(jc.accepted_qty, 0) = 0
        AND COALESCE(jc.dispatch_qty, 0) = 0
        AND NOT EXISTS (
          SELECT 1 FROM shipment_orders so WHERE so.job_card_id = jc.id
        )
    `);

    if (redundantJcs.length > 0) {
      const ids = redundantJcs.map(j => j.id);
      console.log(`[cleanUnnecessaryChildPartShipments] Safely removing ${ids.length} redundant child-part shipment job cards:`, ids);
      await conn.query('DELETE FROM job_cards WHERE id IN (?)', [ids]);
    }
    return { success: true, cleanedCount: redundantJcs.length };
  } catch (error) {
    console.error('[cleanUnnecessaryChildPartShipments] Error:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  listWorkOrders,
  createWorkOrdersFromPlan,
  createWorkOrder,
  getWorkOrderById,
  updateWorkOrderStatus,
  updateWorkOrder,
  deleteWorkOrder,
  deleteAllWorkOrders,
  generateWoNumber,
  getWorkOrderMaterialRequirements,
  updateMaterialConsumption,
  returnMaterial,
  getMaterialReconciliation,
  cleanUnnecessaryChildPartShipments
};
