const pool = require('../config/db');
const bomService = require('./bomService');

const listProductionPlans = async () => {
  const [rows] = await pool.query(
    `SELECT pp.*, u.username as creator_name, 
            COALESCE(o.order_no, o_direct.order_no) as order_no, 
            COALESCE(so.project_name, c_direct.company_name) as project_name,
            COALESCE(soi.item_code, oi.item_code) as item_code, 
            COALESCE(soi.description, oi.description) as item_description,
            (SELECT COUNT(*) FROM work_orders WHERE plan_id = pp.id) as wo_count,
            (SELECT COUNT(*) FROM job_cards jc JOIN work_orders wo ON jc.work_order_id = wo.id WHERE wo.plan_id = pp.id) as total_ops,
            (SELECT COUNT(*) FROM job_cards jc JOIN work_orders wo ON jc.work_order_id = wo.id WHERE wo.plan_id = pp.id AND jc.status = 'COMPLETED') as completed_ops
     FROM production_plans pp
     LEFT JOIN users u ON pp.created_by = u.id
     LEFT JOIN sales_orders so ON pp.sales_order_id = so.id
     LEFT JOIN (
       SELECT quotation_id, order_no FROM orders 
       WHERE quotation_id IS NOT NULL AND id IN (SELECT MAX(id) FROM orders GROUP BY quotation_id)
     ) o ON o.quotation_id = so.id
     LEFT JOIN orders o_direct ON pp.sales_order_id = o_direct.id AND o_direct.quotation_id IS NULL
     LEFT JOIN companies c_direct ON o_direct.client_id = c_direct.id
     LEFT JOIN sales_order_items soi ON pp.bom_no = soi.id
     LEFT JOIN order_items oi ON pp.bom_no = oi.id
     ORDER BY pp.created_at DESC`
  );
  return rows;
};

const getProductionPlanById = async (id) => {
  const [plans] = await pool.query(
    `SELECT pp.*, u.username as creator_name
     FROM production_plans pp
     LEFT JOIN users u ON pp.created_by = u.id
     WHERE pp.id = ?`,
    [id]
  );

  if (plans.length === 0) return null;

  const plan = plans[0];

  const [items] = await pool.query(
    `SELECT ppi.*, 
            COALESCE(so.project_name, o_direct.customer_name) as project_name, 
            COALESCE(soi.item_code, oi.item_code) as item_code, 
            COALESCE(soi.description, oi.description) as description, 
            COALESCE(soi.drawing_no, oi.drawing_no) as drawing_no, 
            w.workstation_name,
            COALESCE(ppi.design_qty, soi.quantity, oi.qty) as design_qty, 
            COALESCE(ppi.uom, soi.unit, 'Nos') as uom,
            COALESCE(o.order_no, o_direct.order_no) as order_no
     FROM production_plan_items ppi
     LEFT JOIN sales_orders so ON ppi.sales_order_id = so.id
     LEFT JOIN sales_order_items soi ON ppi.sales_order_item_id = soi.id
     LEFT JOIN order_items oi ON ppi.sales_order_item_id = oi.id
     LEFT JOIN workstations w ON ppi.workstation_id = w.id
     LEFT JOIN (
       SELECT quotation_id, order_no FROM orders 
       WHERE quotation_id IS NOT NULL AND id IN (SELECT MAX(id) FROM orders GROUP BY quotation_id)
     ) o ON o.quotation_id = so.id
     LEFT JOIN orders o_direct ON ppi.sales_order_id = o_direct.id AND o_direct.quotation_id IS NULL
     WHERE ppi.plan_id = ?`,
    [id]
  );

  plan.items = items;

  // 3. Fetch Sub-Assemblies
  const [subAssemblies] = await pool.query(
    'SELECT * FROM production_plan_sub_assemblies WHERE plan_id = ?',
    [id]
  );
  plan.subAssemblies = subAssemblies;

  // 4. Fetch Materials
  const [materials] = await pool.query(
    'SELECT * FROM production_plan_materials WHERE plan_id = ?',
    [id]
  );
  plan.materials = materials;

  // 5. Fetch Operations
  const [operations] = await pool.query(
    'SELECT * FROM production_plan_operations WHERE plan_id = ?',
    [id]
  );
  plan.operations = operations;

  return plan;
};

const createProductionPlan = async (planData, createdBy) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { 
      planCode, planDate, startDate, endDate, remarks, 
      salesOrderId, bomNo, targetQty, targetQuantity, namingSeries,
      finishedGoods, subAssemblies, materials, operations 
    } = planData;

    // Fix empty date values to be null
    const safeStartDate = startDate || null;
    const safeEndDate = endDate || null;

    // 1. Save Header
    const [result] = await connection.execute(
      `INSERT INTO production_plans (
        plan_code, plan_date, start_date, end_date, remarks, 
        sales_order_id, bom_no, target_qty, naming_series, 
        created_by, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT')`,
      [
        planCode || null, 
        planDate || null, 
        safeStartDate || null, 
        safeEndDate || null, 
        remarks || null, 
        salesOrderId || null, 
        bomNo || null, 
        targetQty || targetQuantity || 0, 
        namingSeries || 'PP',
        createdBy || null
      ]
    );

    const planId = result.insertId;

    // 2. Save Finished Goods
    if (finishedGoods && Array.isArray(finishedGoods)) {
      for (const item of finishedGoods) {
        await connection.execute(
          `INSERT INTO production_plan_items 
           (plan_id, sales_order_id, sales_order_item_id, item_code, bom_no, design_qty, uom, planned_qty, warehouse, planned_start_date, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
          [
            planId,
            item.salesOrderId || salesOrderId || null,
            item.salesOrderItemId || null,
            item.itemCode || null,
            item.bomNo || bomNo || null,
            item.designQty || targetQty || 0,
            item.uom || 'Nos',
            item.plannedQty || targetQty || 0,
            item.warehouse || null,
            item.plannedStartDate || safeStartDate || null
          ]
        );

        // Update Sales Order status
        const currentSOId = item.salesOrderId || salesOrderId;
        if (currentSOId) {
          // Try updating sales_orders
          const [soResult] = await connection.execute(
            `UPDATE sales_orders SET status = 'IN_PRODUCTION', current_department = 'PRODUCTION' WHERE id = ?`,
            [currentSOId]
          );
          
          // If no rows affected, it might be a DIRECT order in orders table
          if (soResult.affectedRows === 0) {
            await connection.execute(
              `UPDATE orders SET status = 'In Production' WHERE id = ?`,
              [currentSOId]
            );
          }
        }
      }
    }

    // 3. Save Sub Assemblies
    if (subAssemblies && Array.isArray(subAssemblies)) {
      for (const sa of subAssemblies) {
        await connection.execute(
          `INSERT INTO production_plan_sub_assemblies 
           (plan_id, item_code, required_qty, bom_no, target_warehouse, scheduled_date, manufacturing_type)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            planId,
            sa.itemCode || sa.subAssemblyItemCode || null,
            sa.requiredQty || 0,
            sa.bomNo || null,
            sa.targetWarehouse || null,
            sa.scheduledDate || safeStartDate || null,
            sa.manufacturingType || 'In House'
          ]
        );
      }
    }

    // 4. Save Materials
    if (materials && Array.isArray(materials)) {
      for (const mat of materials) {
        await connection.execute(
          `INSERT INTO production_plan_materials 
           (plan_id, item_code, material_name, required_qty, uom, warehouse, bom_ref, source_assembly, material_category, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            planId,
            mat.itemCode || mat.item || null,
            mat.materialName || mat.item || null,
            mat.requiredQty || 0,
            mat.uom || mat.unit || 'Nos',
            mat.warehouse || null,
            mat.bomRef || null,
            mat.sourceAssembly || null,
            mat.category || (mat.sourceAssembly ? 'EXPLODED' : 'CORE'),
            mat.status || '--'
          ]
        );
      }
    }

    // 5. Save Operations
    if (operations && Array.isArray(operations)) {
      for (const op of operations) {
        await connection.execute(
          `INSERT INTO production_plan_operations 
           (plan_id, step_no, operation_name, workstation, base_time, source_item)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            planId,
            op.step || op.stepNo || 0,
            op.operationName || null,
            op.workstation || null,
            op.baseTime || op.base_time || 0,
            op.sourceItem || op.source_item || null
          ]
        );
      }
    }

    await connection.commit();
    return planId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateProductionPlan = async (planId, planData, updatedBy) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { 
      planDate, startDate, endDate, remarks, 
      targetQty, targetQuantity, namingSeries, status,
      items, subAssemblies, materials, operations 
    } = planData;

    // Rule: Production Plan cannot complete until all Work Orders are Completed
    if (status === 'COMPLETED') {
      const [pendingWOs] = await connection.query(
        'SELECT wo_number FROM work_orders WHERE plan_id = ? AND status != "COMPLETED"',
        [planId]
      );
      if (pendingWOs.length > 0) {
        throw new Error(`Cannot complete Production Plan. Some Work Orders are not yet completed: ${pendingWOs.map(wo => wo.wo_number).join(', ')}`);
      }
    }

    const safeStartDate = startDate || null;
    const safeEndDate = endDate || null;

    // 1. Update Header
    await connection.execute(
      `UPDATE production_plans SET 
        plan_date = ?, start_date = ?, end_date = ?, remarks = ?, 
        target_qty = ?, naming_series = ?, status = ?
      WHERE id = ?`,
      [
        planDate, safeStartDate, safeEndDate, remarks, 
        targetQty || targetQuantity || 0, namingSeries || 'PP', status || 'DRAFT',
        planId
      ]
    );

    // 2. Delete existing related records
    await connection.execute(`DELETE FROM production_plan_items WHERE plan_id = ?`, [planId]);
    await connection.execute(`DELETE FROM production_plan_sub_assemblies WHERE plan_id = ?`, [planId]);
    await connection.execute(`DELETE FROM production_plan_materials WHERE plan_id = ?`, [planId]);
    await connection.execute(`DELETE FROM production_plan_operations WHERE plan_id = ?`, [planId]);

    // 3. Re-save Finished Goods (Items)
    if (items && Array.isArray(items)) {
      for (const item of items) {
        await connection.execute(
          `INSERT INTO production_plan_items 
           (plan_id, sales_order_id, sales_order_item_id, item_code, bom_no, design_qty, uom, planned_qty, warehouse, planned_start_date, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            planId,
            item.salesOrderId || null,
            item.salesOrderItemId || null,
            item.itemCode || null,
            item.bomNo || null,
            item.designQty || 0,
            item.uom || 'Nos',
            item.plannedQty || 0,
            item.warehouse || null,
            item.plannedStartDate || safeStartDate || null,
            item.status || 'PENDING'
          ]
        );
      }
    }

    // 4. Re-save Sub Assemblies
    if (subAssemblies && Array.isArray(subAssemblies)) {
      for (const sa of subAssemblies) {
        await connection.execute(
          `INSERT INTO production_plan_sub_assemblies 
           (plan_id, item_code, required_qty, bom_no, target_warehouse, scheduled_date, manufacturing_type)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            planId,
            sa.itemCode || null,
            sa.requiredQty || 0,
            sa.bomNo || null,
            sa.targetWarehouse || null,
            sa.scheduledDate || safeStartDate || null,
            sa.manufacturingType || 'In House'
          ]
        );
      }
    }

    // 5. Re-save Materials
    if (materials && Array.isArray(materials)) {
      for (const mat of materials) {
        await connection.execute(
          `INSERT INTO production_plan_materials 
           (plan_id, item_code, material_name, required_qty, uom, warehouse, bom_ref, source_assembly, material_category, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            planId,
            mat.itemCode || null,
            mat.materialName || null,
            mat.requiredQty || 0,
            mat.uom || 'Nos',
            mat.warehouse || null,
            mat.bomRef || null,
            mat.sourceAssembly || null,
            mat.materialCategory || mat.material_category || mat.category || 'CORE',
            mat.status || '--'
          ]
        );
      }
    }

    // 6. Re-save Operations
    if (operations && Array.isArray(operations)) {
      for (const op of operations) {
        await connection.execute(
          `INSERT INTO production_plan_operations 
           (plan_id, step_no, operation_name, workstation, base_time, source_item)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            planId,
            op.step || op.stepNo || 0,
            op.operationName || op.operation_name || null,
            op.workstation || null,
            op.baseTime || op.base_time || 0,
            op.sourceItem || op.itemCode || op.source_item || null
          ]
        );
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

const getReadySalesOrderItems = async () => {
  // Items that are approved and ready for production
  // Combine items from legacy sales_orders and new orders system
  const [rows] = await pool.query(
    `SELECT * FROM (
      -- Legacy system items
      SELECT so.id as sales_order_id, 
             o.order_no as order_no, 
             so.project_name, 
             so.production_priority, 
             so.created_at,
             soi.id as sales_order_item_id, 
             soi.item_code as item_code, 
             soi.item_type as item_type,
             soi.drawing_no as drawing_no,
             soi.description as description, 
             soi.quantity as total_qty, 
             soi.quantity as design_qty,
             soi.unit as unit,
             COALESCE(planned.already_planned_qty, 0) as already_planned_qty
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY sales_order_id, item_code, drawing_no ORDER BY id DESC) as rn
        FROM sales_order_items
        WHERE status != 'Rejected' AND (item_type IN ('FG', 'SFG'))
      ) soi
      JOIN sales_orders so ON soi.sales_order_id = so.id
      JOIN (
        SELECT quotation_id, order_no FROM orders 
        WHERE quotation_id IS NOT NULL AND id IN (SELECT MAX(id) FROM orders GROUP BY quotation_id)
      ) o ON o.quotation_id = so.id
      LEFT JOIN (
        SELECT sales_order_item_id, SUM(planned_qty) as already_planned_qty
        FROM production_plan_items 
        WHERE status != 'CANCELLED'
        GROUP BY sales_order_item_id
      ) planned ON soi.id = planned.sales_order_item_id
      WHERE soi.rn = 1 AND (COALESCE(planned.already_planned_qty, 0) < soi.quantity)

      UNION ALL

      -- New system items (Direct orders)
      SELECT o.id as sales_order_id,
             o.order_no as order_no,
             c.company_name as project_name,
             0 as production_priority,
             o.created_at,
             oi.id as sales_order_item_id,
             oi.item_code as item_code,
             oi.type as item_type,
             oi.drawing_no as drawing_no,
             oi.description as description,
             oi.quantity as total_qty,
             oi.quantity as design_qty,
             'Nos' as unit,
             COALESCE(planned.already_planned_qty, 0) as already_planned_qty
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN companies c ON o.client_id = c.id
      LEFT JOIN (
        SELECT sales_order_item_id, SUM(planned_qty) as already_planned_qty
        FROM production_plan_items 
        WHERE status != 'CANCELLED'
        GROUP BY sales_order_item_id
      ) planned ON oi.id = planned.sales_order_item_id
      WHERE o.quotation_id IS NULL AND (COALESCE(planned.already_planned_qty, 0) < oi.quantity)
    ) combined
    ORDER BY production_priority DESC, created_at ASC`
  );
  return rows;
};

const getProductionReadySalesOrders = async () => {
  const [rows] = await pool.query(
    `SELECT o.id, 
            o.order_no, 
            COALESCE(so.project_name, c.company_name, '') as project_name, 
            cp.po_number, 
            c.company_name, 
            o.created_at
     FROM orders o
     LEFT JOIN sales_orders so ON o.quotation_id = so.id
     LEFT JOIN companies c ON o.client_id = c.id
     LEFT JOIN customer_pos cp ON so.customer_po_id = cp.id
     WHERE EXISTS (
       SELECT 1 FROM order_items oi WHERE oi.order_id = o.id
     ) OR EXISTS (
       SELECT 1 FROM sales_order_items soi WHERE soi.sales_order_id = so.id
     )
     GROUP BY o.id, so.project_name, c.company_name, cp.po_number, o.created_at, o.order_no
     ORDER BY o.created_at DESC`
  );
  return rows;
};

const getSalesOrderFullDetails = async (id) => {
  // Try to find in orders table first (new system)
  const [orders] = await pool.query(
    `SELECT o.*, c.company_name, cp.po_number, o.order_no, 
            so.id as sales_order_id, so.project_name
     FROM orders o
     LEFT JOIN sales_orders so ON o.quotation_id = so.id
     LEFT JOIN companies c ON o.client_id = c.id
     LEFT JOIN customer_pos cp ON so.customer_po_id = cp.id
     WHERE o.id = ?`,
    [id]
  );

  if (orders.length > 0) {
    const order = orders[0];
    
    // Fetch items from order_items
    const [items] = await pool.query(
      `SELECT oi.id,
              oi.id as sales_order_item_id,
              oi.order_id as sales_order_id,
              oi.item_code as item_code,
              oi.type as item_type,
              oi.drawing_no as drawing_no,
              oi.description,
              oi.quantity as quantity,
              oi.quantity as design_qty,
              'Nos' as unit,
              'Approved' as status,
              COALESCE(planned.already_planned_qty, 0) as already_planned_qty
       FROM order_items oi
       LEFT JOIN (
         SELECT sales_order_item_id, SUM(planned_qty) as already_planned_qty
         FROM production_plan_items 
         WHERE status != 'CANCELLED'
         GROUP BY sales_order_item_id
       ) planned ON oi.id = planned.sales_order_item_id
       WHERE oi.order_id = ?`,
      [id]
    );
    
    order.items = items;
    return order;
  }

  // Fallback to old sales_orders system
  const [soOrders] = await pool.query(
    `SELECT so.*, c.company_name, cp.po_number, o.order_no
     FROM sales_orders so
     LEFT JOIN companies c ON so.company_id = c.id
     LEFT JOIN customer_pos cp ON so.customer_po_id = cp.id
     LEFT JOIN (
       SELECT quotation_id, order_no FROM orders 
       WHERE quotation_id IS NOT NULL ORDER BY id DESC
     ) o ON o.quotation_id = so.id
     WHERE so.id = ?`,
    [id]
  );

  if (soOrders.length === 0) return null;
  const soOrder = soOrders[0];

  const [soItems] = await pool.query(
    `SELECT soi.id,
            soi.id as sales_order_item_id,
            soi.sales_order_id,
            soi.item_code as item_code,
            soi.item_type as item_type,
            soi.drawing_no as drawing_no,
            soi.description,
            soi.quantity as quantity,
            soi.quantity as design_qty,
            soi.unit,
            soi.status,
            soi.rejection_reason,
            COALESCE(planned.already_planned_qty, 0) as already_planned_qty
     FROM (
       SELECT *, ROW_NUMBER() OVER (PARTITION BY sales_order_id, drawing_no ORDER BY id DESC) as rn
       FROM sales_order_items
       WHERE sales_order_id = ? AND (item_type IN ('FG', 'SFG'))
     ) soi
     LEFT JOIN (
       SELECT sales_order_item_id, SUM(planned_qty) as already_planned_qty
       FROM production_plan_items 
       WHERE status != 'CANCELLED'
       GROUP BY sales_order_item_id
     ) planned ON soi.id = planned.sales_order_item_id
     WHERE soi.rn = 1`,
    [id]
  );

  soOrder.items = soItems;
  return soOrder;
};

const generatePlanCode = async () => {
  const [rows] = await pool.query('SELECT MAX(id) as maxId FROM production_plans');
  const nextId = (rows[0].maxId || 0) + 1;
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  
  // Try to find a code that doesn't exist yet, just in case
  let suffix = nextId;
  let planCode = `PP-${year}${month}-${suffix.toString().padStart(4, '0')}`;
  
  let exists = true;
  while (exists) {
    const [check] = await pool.query('SELECT id FROM production_plans WHERE plan_code = ?', [planCode]);
    if (check.length === 0) {
      exists = false;
    } else {
      suffix++;
      planCode = `PP-${year}${month}-${suffix.toString().padStart(4, '0')}`;
    }
  }
  
  return planCode;
};

const getItemBOMDetails = async (salesOrderItemId) => {
  // Try to fetch the item details from sales_order_items first
  let [items] = await pool.query(
    'SELECT id, item_code, drawing_no FROM sales_order_items WHERE id = ?',
    [salesOrderItemId]
  );

  let soItemId = salesOrderItemId;

  // If not found, try order_items (the new system)
  if (items.length === 0) {
    [items] = await pool.query(
      'SELECT id, item_code, drawing_no FROM order_items WHERE id = ?',
      [salesOrderItemId]
    );
    // For order_items, we don't have SO-specific materials/components/operations 
    // in sales_order_item_* tables yet, so we treat it as no SO context
    soItemId = null; 
  }

  if (items.length === 0) return null;
  const item = items[0];

  // Helper function to recursively fetch BOM details
  const fetchRecursiveBOM = async (itemCode, drawingNo, soItemId = null, parentId = null) => {
    let materials = [];
    let components = [];
    let operations = [];

    // 1. Try to fetch SO-specific data if soItemId is provided
    if (soItemId) {
      const [soMaterials] = await pool.query(
        'SELECT * FROM sales_order_item_materials WHERE sales_order_item_id = ? AND parent_id <=> ?',
        [soItemId, parentId]
      );
      const [soComponents] = await pool.query(
        'SELECT * FROM sales_order_item_components WHERE sales_order_item_id = ? AND parent_id <=> ?',
        [soItemId, parentId]
      );
      
      materials = soMaterials;
      components = soComponents;

      // Operations are usually top-level (parentId is null)
      if (parentId === null) {
        const [soOperations] = await pool.query(
          'SELECT * FROM sales_order_item_operations WHERE sales_order_item_id = ?',
          [soItemId]
        );
        operations = soOperations;
      }
    }

    // 2. Fallback to Master BOM per category
    // Always attempt fallback if we found nothing in the Sales Order context, 
    // or if we are already in the Master context.
    const isInMasterContext = !soItemId;
    const targetParentIdStr = String(parentId || '');

    if (materials.length === 0) {
      const masterMaterials = await bomService.getItemMaterials(null, itemCode, drawingNo);
      materials = masterMaterials.filter(m => String(m.parent_id || '') === targetParentIdStr);
    }
    if (components.length === 0) {
      const masterComponents = await bomService.getItemComponents(null, itemCode, drawingNo);
      components = masterComponents.filter(c => String(c.parent_id || '') === targetParentIdStr);
    }
    // Operations can exist at any level, but usually they are top-level for an assembly
    if (operations.length === 0) {
      const masterOperations = await bomService.getItemOperations(null, itemCode, drawingNo);
      // For Master operations, they usually don't have parent_id in the table, 
      // but they are linked to the itemCode/drawingNo.
      // We only take them if we are at the top level of that identity.
      if (targetParentIdStr === '') {
        operations = masterOperations;
      }
    }

    // 3. Recursively resolve components
    const resolvedComponents = await Promise.all(components.map(async (comp) => {
      // 1. Try to find nested children in the SAME context first (for multi-level within one BOM)
      let subDetails = await fetchRecursiveBOM(itemCode, drawingNo, soItemId, comp.id);

      // 2. ALSO attempt a standalone explosion if the component has its own identity
      // This is crucial for items like "Side Bracket" which have their own Master BOMs
      const compCode = comp.component_code || comp.item_code;
      const compDrawing = comp.drawing_no;
      
      if (compCode || compDrawing) {
        let soItem = [];
        if (soItemId) {
          [soItem] = await pool.query(
            `SELECT id FROM sales_order_items 
             WHERE (item_code = ? OR (drawing_no = ? AND drawing_no IS NOT NULL))
             AND sales_order_id = (SELECT sales_order_id FROM sales_order_items WHERE id = ?) 
             LIMIT 1`,
            [compCode, compDrawing, soItemId]
          );
        }

        const standaloneDetails = await fetchRecursiveBOM(
          compCode, 
          compDrawing, 
          soItem.length > 0 ? soItem[0].id : null, 
          null
        );
        
        // Merge Strategy: Combine results from nested context and standalone context
        if (standaloneDetails) {
          // 1. Merge Materials: Append materials from standalone explosion
          // We use a Set to avoid duplicates if they were already in subDetails
          const existingMatKeys = new Set(subDetails.materials.map(m => `${m.material_name}-${m.item_code}`));
          standaloneDetails.materials.forEach(m => {
            const key = `${m.material_name}-${m.item_code}`;
            if (!existingMatKeys.has(key)) subDetails.materials.push(m);
          });

          // 2. Merge Components: Append sub-components
          const existingCompKeys = new Set(subDetails.components.map(c => c.component_code || c.item_code));
          standaloneDetails.components.forEach(c => {
            const key = c.component_code || c.item_code;
            if (!existingCompKeys.has(key)) subDetails.components.push(c);
          });

          // 3. Merge Operations: Append manufacturing steps
          const existingOpKeys = new Set(subDetails.operations.map(o => o.operation_name));
          standaloneDetails.operations.forEach(o => {
            if (!existingOpKeys.has(o.operation_name)) subDetails.operations.push(o);
          });
        }
      }

      return {
        ...comp,
        materials: subDetails.materials,
        components: subDetails.components,
        operations: subDetails.operations
      };
    }));

    return { materials, components: resolvedComponents, operations };
  };

  return fetchRecursiveBOM(item.item_code, item.drawing_no, salesOrderItemId, null);
};

const deleteProductionPlan = async (id) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // The tables are linked with ON DELETE CASCADE in db.js, 
    // but it's safer to explicitly handle it if needed or just delete the main record.
    // Based on db.js, production_plan_items, production_plan_sub_assemblies, 
    // production_plan_materials, and production_plan_operations all have 
    // FOREIGN KEY (plan_id) REFERENCES production_plans(id) ON DELETE CASCADE.
    
    await connection.execute('DELETE FROM production_plans WHERE id = ?', [id]);

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  listProductionPlans,
  getProductionPlanById,
  createProductionPlan,
  updateProductionPlan,
  getReadySalesOrderItems,
  getProductionReadySalesOrders,
  getSalesOrderFullDetails,
  generatePlanCode,
  getItemBOMDetails,
  deleteProductionPlan
};
