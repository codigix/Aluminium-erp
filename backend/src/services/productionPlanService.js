const pool = require('../config/db');
const bomService = require('./bomService');

const listProductionPlans = async () => {
  const [rows] = await pool.query(
    `SELECT pp.*, u.username as creator_name, 
            COALESCE(o.order_no, o_direct.order_no) as order_no, 
            COALESCE(so.project_name, c_direct.company_name) as project_name,
            COALESCE(ppi.item_code, 
              CASE 
                WHEN o_direct.id IS NOT NULL THEN oi.item_code 
                ELSE COALESCE(soi.item_code, oi.item_code) 
              END
            ) as item_code, 
            COALESCE(ppi.description,
              CASE 
                WHEN o_direct.id IS NOT NULL THEN oi.description 
                ELSE COALESCE(soi.description, oi.description) 
              END
            ) as item_description,
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
     LEFT JOIN (
       SELECT plan_id, item_code, description, sales_order_item_id, sales_order_id
       FROM production_plan_items 
       WHERE id IN (SELECT MIN(id) FROM production_plan_items GROUP BY plan_id)
     ) ppi ON pp.id = ppi.plan_id
     LEFT JOIN sales_order_items soi ON ppi.sales_order_item_id = soi.id AND ppi.sales_order_id = soi.sales_order_id
     LEFT JOIN order_items oi ON ppi.sales_order_item_id = oi.id AND ppi.sales_order_id = oi.order_id
     ORDER BY pp.created_at DESC`
  );
  return rows;
};

const getProductionPlanById = async (id) => {
  const [plans] = await pool.query(
    `SELECT pp.*, u.username as creator_name,
            COALESCE(o_direct.order_no) as order_no,
            COALESCE(ppi_first.item_code) as item_code,
            COALESCE(ppi_first.description) as item_description
     FROM production_plans pp
     LEFT JOIN users u ON pp.created_by = u.id
     LEFT JOIN orders o_direct ON pp.sales_order_id = o_direct.id AND o_direct.quotation_id IS NULL
     LEFT JOIN (
       SELECT plan_id, item_code, description 
       FROM production_plan_items 
       WHERE id IN (SELECT MIN(id) FROM production_plan_items GROUP BY plan_id)
     ) ppi_first ON pp.id = ppi_first.plan_id
     WHERE pp.id = ?`,
    [id]
  );

  if (plans.length === 0) return null;

  const plan = plans[0];

  const [items] = await pool.query(
    `SELECT ppi.*, 
            COALESCE(so.project_name, c_direct.company_name) as project_name, 
            COALESCE(ppi.item_code, 
              CASE 
                WHEN o_direct.id IS NOT NULL THEN oi.item_code 
                ELSE COALESCE(soi.item_code, oi.item_code) 
              END
            ) as item_code, 
            COALESCE(ppi.description, 
              CASE 
                WHEN o_direct.id IS NOT NULL THEN oi.description 
                ELSE COALESCE(soi.description, oi.description) 
              END
            ) as description, 
            CASE 
              WHEN o_direct.id IS NOT NULL THEN oi.drawing_no 
              ELSE COALESCE(soi.drawing_no, oi.drawing_no) 
            END as drawing_no, 
            w.workstation_name,
            COALESCE(ppi.design_qty, soi.quantity, oi.quantity) as design_qty, 
            COALESCE(ppi.uom, soi.unit, 'Nos') as uom,
            COALESCE(o.order_no, o_direct.order_no) as order_no
     FROM production_plan_items ppi
     LEFT JOIN sales_orders so ON ppi.sales_order_id = so.id
     LEFT JOIN orders o_direct ON ppi.sales_order_id = o_direct.id AND o_direct.quotation_id IS NULL
     LEFT JOIN sales_order_items soi ON ppi.sales_order_item_id = soi.id AND ppi.sales_order_id = soi.sales_order_id AND ppi.item_code = soi.item_code
     LEFT JOIN order_items oi ON ppi.sales_order_item_id = oi.id AND ppi.sales_order_id = oi.order_id AND ppi.item_code = oi.item_code
     LEFT JOIN workstations w ON ppi.workstation_id = w.id
     LEFT JOIN (
       SELECT quotation_id, order_no FROM orders 
       WHERE quotation_id IS NOT NULL AND id IN (SELECT MAX(id) FROM orders GROUP BY quotation_id)
     ) o ON o.quotation_id = so.id
     LEFT JOIN companies c_direct ON o_direct.client_id = c_direct.id
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
      salesOrderId, salesOrder, bomNo, bom, targetQty, targetQuantity, namingSeries,
      finishedGoods, subAssemblies, materials, operations 
    } = planData;

    const finalSalesOrderId = salesOrderId || (salesOrder && salesOrder.id) || null;
    const finalBomNo = bomNo || (bom && bom.bomNo) || null;
    const finalTargetQty = targetQty || targetQuantity || (bom && bom.targetQty) || 0;

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
        finalSalesOrderId, 
        finalBomNo, 
        finalTargetQty, 
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
           (plan_id, sales_order_id, sales_order_item_id, item_code, description, bom_no, design_qty, uom, planned_qty, rate, warehouse, planned_start_date, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
          [
            planId,
            item.salesOrderId || finalSalesOrderId,
            item.salesOrderItemId || null,
            item.itemCode || null,
            item.description || item.item_description || null,
            item.bomNo || finalBomNo,
            item.designQty || finalTargetQty || 0,
            item.uom || 'Nos',
            item.plannedQty || finalTargetQty || 0,
            item.rate || 0,
            item.warehouse || null,
            item.plannedStartDate || safeStartDate || null
          ]
        );

        // Update Sales Order status
        const currentSOId = item.salesOrderId || finalSalesOrderId;
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
           (plan_id, item_code, description, design_qty, required_qty, rate, bom_no, target_warehouse, scheduled_date, manufacturing_type, source_fg)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            planId,
            sa.itemCode || sa.subAssemblyItemCode || sa.item_code || null,
            sa.description || sa.item_description || sa.name || null,
            sa.designQty || finalTargetQty || 0,
            sa.requiredQty || 0,
            sa.rate || 0,
            sa.bomNo || sa.bom_no || null,
            sa.targetWarehouse || sa.target_warehouse || null,
            sa.scheduledDate || sa.scheduled_date || safeStartDate || null,
            sa.manufacturingType || sa.manufacturing_type || 'In House',
            sa.sourceFg || sa.source_fg || null
          ]
        );
      }
    }

    // 4. Save Materials
    if (materials) {
      const materialList = Array.isArray(materials) 
        ? materials 
        : [...(materials.coreMaterials || []), ...(materials.explodedComponents || [])];

      for (const mat of materialList) {
        await connection.execute(
          `INSERT INTO production_plan_materials 
           (plan_id, item_code, material_name, design_qty, required_qty, rate, uom, warehouse, bom_ref, source_assembly, material_category, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            planId,
            mat.itemCode || mat.item_code || mat.material_code || mat.item || null,
            mat.materialName || mat.material_name || mat.item || null,
            mat.designQty || finalTargetQty || 0,
            mat.requiredQty || mat.required_qty || 0,
            mat.rate || 0,
            mat.uom || mat.unit || 'Nos',
            mat.warehouse || null,
            mat.bomRef || mat.bom_ref || null,
            mat.sourceAssembly || mat.source_assembly || null,
            mat.category || mat.material_category || (mat.sourceAssembly || mat.source_assembly ? 'EXPLODED' : 'CORE'),
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
            op.baseTime || op.base_time || op.baseTimeHrs || op.base_hour || 0,
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
      salesOrderId, salesOrder, bomNo, bom,
      targetQty, targetQuantity, namingSeries, status,
      items, subAssemblies, materials, operations 
    } = planData;

    const finalSalesOrderId = salesOrderId || (salesOrder && salesOrder.id) || null;
    const finalBomNo = bomNo || (bom && bom.bomNo) || null;
    const finalTargetQty = targetQty || targetQuantity || (bom && bom.targetQty) || 0;

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
        target_qty = ?, naming_series = ?, status = ?,
        sales_order_id = ?, bom_no = ?
      WHERE id = ?`,
      [
        planDate, safeStartDate, safeEndDate, remarks, 
        finalTargetQty, namingSeries || 'PP', status || 'DRAFT',
        finalSalesOrderId, finalBomNo,
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
           (plan_id, sales_order_id, sales_order_item_id, item_code, description, bom_no, design_qty, uom, planned_qty, rate, warehouse, planned_start_date, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            planId,
            item.salesOrderId || finalSalesOrderId,
            item.salesOrderItemId || null,
            item.itemCode || null,
            item.description || item.item_description || null,
            item.bomNo || finalBomNo,
            item.designQty || finalTargetQty || 0,
            item.uom || 'Nos',
            item.plannedQty || finalTargetQty || 0,
            item.rate || 0,
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
           (plan_id, item_code, description, design_qty, required_qty, rate, bom_no, target_warehouse, scheduled_date, manufacturing_type, source_fg)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            planId,
            sa.itemCode || sa.subAssemblyItemCode || sa.item_code || null,
            sa.description || sa.item_description || sa.name || null,
            sa.designQty || finalTargetQty || 0,
            sa.requiredQty || 0,
            sa.rate || 0,
            sa.bomNo || sa.bom_no || null,
            sa.targetWarehouse || sa.target_warehouse || null,
            sa.scheduledDate || sa.scheduled_date || safeStartDate || null,
            sa.manufacturingType || sa.manufacturing_type || 'In House',
            sa.sourceFg || sa.source_fg || null
          ]
        );
      }
    }

    // 5. Re-save Materials
    if (materials) {
      const materialList = Array.isArray(materials) 
        ? materials 
        : [...(materials.coreMaterials || []), ...(materials.explodedComponents || [])];

      for (const mat of materialList) {
        await connection.execute(
          `INSERT INTO production_plan_materials 
           (plan_id, item_code, material_name, design_qty, required_qty, rate, uom, warehouse, bom_ref, source_assembly, material_category, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            planId,
            mat.itemCode || mat.item_code || mat.material_code || mat.item || null,
            mat.materialName || mat.material_name || mat.item || null,
            mat.designQty || finalTargetQty || 0,
            mat.requiredQty || mat.required_qty || 0,
            mat.rate || 0,
            mat.uom || mat.unit || 'Nos',
            mat.warehouse || null,
            mat.bomRef || mat.bom_ref || null,
            mat.sourceAssembly || mat.source_assembly || null,
            mat.materialCategory || mat.material_category || mat.category || (mat.sourceAssembly || mat.source_assembly ? 'EXPLODED' : 'CORE'),
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
            op.baseTime || op.base_time || op.baseTimeHrs || op.base_hour || 0,
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
         SELECT sales_order_id, sales_order_item_id, SUM(planned_qty) as already_planned_qty
         FROM production_plan_items 
         WHERE status != 'CANCELLED'
         GROUP BY sales_order_id, sales_order_item_id
       ) planned ON oi.order_id = planned.sales_order_id AND oi.id = planned.sales_order_item_id
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
       WHERE sales_order_id = ? AND (item_type IN ('FG', 'SFG', 'SA', 'SUB_ASSEMBLY', 'SUB-ASSEMBLY', 'Assembly'))
     ) soi
     LEFT JOIN (
       SELECT sales_order_id, sales_order_item_id, SUM(planned_qty) as already_planned_qty
       FROM production_plan_items 
       WHERE status != 'CANCELLED'
       GROUP BY sales_order_id, sales_order_item_id
     ) planned ON soi.sales_order_id = planned.sales_order_id AND soi.id = planned.sales_order_item_id
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
  // Try to fetch the item details from order_items first (new system)
  let [items] = await pool.query(
    'SELECT id, item_code, drawing_no FROM order_items WHERE id = ?',
    [salesOrderItemId]
  );

  let soItemIdForLookup = null;

  // If not found in order_items, try sales_order_items (the old system)
  if (items.length === 0) {
    [items] = await pool.query(
      'SELECT id, item_code, drawing_no FROM sales_order_items WHERE id = ?',
      [salesOrderItemId]
    );
    soItemIdForLookup = items.length > 0 ? salesOrderItemId : null;
  }

  if (items.length === 0) return null;
  const item = items[0];
  console.log(`[getItemBOMDetails] Exploding BOM for ${item.item_code} / ${item.drawing_no}`);

  const materialMap = new Map();
  const componentMap = new Map();
  const operationMap = new Map();
  const visitedItems = new Set();
  const processedBOMs = new Set();

  // Helper function to recursively explode BOM and flatten results
  const explodeBOM = async (
    itemCode,
    drawingNo,
    soItemId = null,
    parentId = null,
    qtyMultiplier = 1,
    depth = 0,
    parentType = 'FG'
  ) => {
    const currentIdentity = `${itemCode}-${drawingNo || ''}`;

    if (soItemId && depth === 0) {
      // Safety check: Ensure soItemId actually refers to an item with matching identity
      // This prevents ID clashes between order_items and sales_order_items
      const [check] = await pool.query(
        'SELECT item_code, drawing_no FROM sales_order_items WHERE id = ?',
        [soItemId]
      );
      if (check.length > 0) {
        const matches = (check[0].item_code === itemCode) || 
                        (check[0].drawing_no === drawingNo && check[0].drawing_no !== null);
        if (!matches) {
          console.warn(`[explodeBOM] Identity mismatch for soItemId ${soItemId}. Expected ${itemCode}/${drawingNo}, found ${check[0].item_code}/${check[0].drawing_no}. Disregarding soItemId.`);
          soItemId = null;
        }
      } else {
        soItemId = null;
      }
    }

    const bomContextKey = `${currentIdentity}-${soItemId || 'MASTER'}-${parentId || 'TOP'}`;

    if (processedBOMs.has(bomContextKey)) return { materials: [], components: [], operations: [] };
    processedBOMs.add(bomContextKey);
    
    // Fetch data from specific context
    let materials = [];
    let components = [];
    let operations = [];

    console.log(`[explodeBOM] Level ${depth}: ${itemCode} (Drawing: ${drawingNo}), soItemId: ${soItemId}, parentId: ${parentId}, qtyMultiplier: ${qtyMultiplier}`);

    // 1. Try to fetch from Sales Order context OR Master BOM with parent_id
    if (soItemId || parentId) {
      const targetSoId = soItemId || null;
      const [soM] = await pool.query('SELECT * FROM sales_order_item_materials WHERE sales_order_item_id <=> ? AND parent_id <=> ?', [targetSoId, parentId]);
      
      // Join with sales_order_items to get item_type for components
      const [soC] = await pool.query(`
        SELECT c.*, soi.item_type 
        FROM sales_order_item_components c
        LEFT JOIN sales_order_items soi ON (c.component_code = soi.item_code OR (c.drawing_no = soi.drawing_no AND c.drawing_no IS NOT NULL))
        AND soi.sales_order_id = (SELECT sales_order_id FROM sales_order_items WHERE id = ?)
        WHERE c.sales_order_item_id <=> ? AND c.parent_id <=> ?`, [targetSoId || soItemId, targetSoId, parentId]);
      
      // Normalize item_type
      const soCWithTypes = soC.map(c => ({
        ...c,
        item_type: (c.item_type === 'SA' || (c.component_code && c.component_code.startsWith('SA-'))) ? 'Sub Assembly' : (c.item_type || 'FG')
      }));
      
      materials = soM;
      components = soCWithTypes;
      
      // Operations are usually flat for the item, fetch if matches item identity
      const [soO] = await pool.query('SELECT * FROM sales_order_item_operations WHERE sales_order_item_id <=> ? AND (item_code = ? OR (drawing_no = ? AND drawing_no IS NOT NULL))', [targetSoId, itemCode, drawingNo]);
      operations = soO;
    }

    // 2. Granular Fallback to Master BOM or Any BOM (only if still empty and we are looking at a potential standalone item)
    if (materials.length === 0 || components.length === 0 || operations.length === 0) {
      // Fetch Master BOM data
      const masterM = await bomService.getItemMaterials(null, itemCode, drawingNo);
      
      // For master components, we need to try to find their item_type as well
      const masterC = await bomService.getItemComponents(null, itemCode, drawingNo);
      const masterCWithTypes = await Promise.all(masterC.map(async c => {
        const cCode = c.component_code || c.item_code;
        const [typeRow] = await pool.query('SELECT item_type FROM sales_order_items WHERE item_code = ? AND sales_order_id IS NULL LIMIT 1', [cCode]);
        const baseType = typeRow.length > 0 ? typeRow[0].item_type : 'FG';
        return { ...c, item_type: (baseType === 'SA' || cCode.startsWith('SA-')) ? 'Sub Assembly' : baseType };
      }));

      const masterO = await bomService.getItemOperations(null, itemCode, drawingNo);

      // Fetch Any BOM data as secondary fallback
      const anyBOM = (materials.length === 0 && components.length === 0 && operations.length === 0) 
        ? await bomService.findAnyBOM(itemCode, drawingNo) 
        : null;

      if (materials.length === 0) {
        materials = masterM.filter(m => !m.parent_id);
        if (materials.length === 0 && anyBOM) materials = (anyBOM.materials || []).filter(m => !m.parent_id);
      }

      if (components.length === 0) {
        components = masterCWithTypes.filter(c => !c.parent_id);
        if (components.length === 0 && anyBOM) components = (anyBOM.components || []).filter(c => !c.parent_id);
      }

      if (operations.length === 0) {
        operations = masterO;
        if (operations.length === 0 && anyBOM) operations = anyBOM.operations || [];
      }
    }

    console.log(`[explodeBOM] Result for ${itemCode}: ${materials.length} materials, ${components.length} components, ${operations.length} operations`);

    // Process Materials
    materials.forEach(m => {
      // level 0 (FG) and level 1 (direct sub-assemblies) are considered CORE for primary list
      const material_category = (depth <= 1) ? 'CORE' : 'EXPLODED';
      const source_assembly = depth === 0 ? null : itemCode;
      
      const mKey = `${m.material_name}-${m.material_code || ''}-${material_category}-${source_assembly || ''}`;
      const existing = materialMap.get(mKey);
      const reqQty = (m.qty_per_pc || 0) * qtyMultiplier;

      if (existing) {
        existing.required_qty += reqQty;
        existing.totalRequiredQty += reqQty;
      } else {
        materialMap.set(mKey, {
          ...m,
          material_category,
          required_qty: reqQty,
          totalRequiredQty: reqQty,
          source_assembly,
          rate: m.rate || 0,
          bom_ref: m.bom_no || drawingNo || 'BOM-REF'
        });
      }
    });

    // Process Operations
    if (operations.length > 0) {
      const opsWithSource = operations.map(o => ({
        ...o,
        source_item: itemCode,
        itemCode: itemCode,
        base_time: o.cycle_time_min || o.base_time || (o.base_hour ? (parseFloat(o.base_hour) * 60).toFixed(2) : 1)
      }));
      
      // Store in global flat map
      if (!operationMap.has(currentIdentity)) {
        operationMap.set(currentIdentity, opsWithSource);
      }
    }

    // Process Components
    const componentResults = [];
    
    for (const comp of components) {
      const compCode = comp.component_code || comp.item_code;
      const compDrawing = comp.drawing_no;
      const compQty = parseFloat(comp.quantity || 0);
      const totalCompQty = compQty * qtyMultiplier;

      const cKey = `${compCode}-${compDrawing || ''}`;
      
      let nextSoItemId = null;
      let nextParentId = null;

      if (soItemId) {
        const [found] = await pool.query(
          `SELECT id FROM sales_order_items 
           WHERE item_code = ? 
           AND sales_order_id = (SELECT sales_order_id FROM sales_order_items WHERE id = ?) 
           LIMIT 1`,
          [compCode, soItemId]
        );
        
        if (found.length > 0) {
          nextSoItemId = found[0].id;
          nextParentId = null;
        } else {
          nextSoItemId = soItemId;
          nextParentId = comp.id;
        }
      }

      const subDetails = await explodeBOM(
        compCode,
        compDrawing,
        nextSoItemId,
        nextParentId,
        totalCompQty,
        depth + 1,
        'Sub Assembly'
      );
      
      const componentData = {
        ...comp,
        itemCode: compCode,
        item_code: compCode,
        required_qty: totalCompQty,
        bomNo: comp.bom_no || compDrawing || 'BOM-SUB',
        bom_no: comp.bom_no || compDrawing || 'BOM-SUB',
        sourceFg: item.item_code,
        materials: subDetails.materials,
        operations: subDetails.operations
      };

      if (!componentMap.has(cKey)) {
        componentMap.set(cKey, componentData);
      }
      componentResults.push(componentData);
    }

    return {
      materials: materials.map(m => ({
        ...m,
        item_code: m.material_code || m.item_code || m.itemCode || null,
        material_name: m.material_name || m.name || null,
        qty_per_pc: m.qty_per_pc || 0,
        required_qty: (m.qty_per_pc || 0) * qtyMultiplier
      })),
      operations: (operationMap.get(currentIdentity) || []),
      components: componentResults
    };
  };

  await explodeBOM(item.item_code, item.drawing_no, soItemIdForLookup, null, 1, 0, 'FG');

  return {
    materials: Array.from(materialMap.values()),
    components: Array.from(componentMap.values()),
    operations: Array.from(operationMap.values()).flat()
  };
};

const createMaterialRequestFromPlan = async (planId, userId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Fetch Plan Details
    const [plans] = await connection.query(
      'SELECT * FROM production_plans WHERE id = ?',
      [planId]
    );

    if (plans.length === 0) {
      throw new Error('Production Plan not found');
    }

    const plan = plans[0];

    // Check if an MR already exists for this plan to avoid duplicates
    const [existingMrs] = await connection.query(
      "SELECT id FROM material_requests WHERE notes LIKE ?",
      [`%Generated from Production Plan ${plan.plan_code}%`]
    );
    
    if (existingMrs.length > 0) {
      throw new Error(`A Material Request already exists for Production Plan ${plan.plan_code}`);
    }

    // 2. Aggregate everything into a single map
    const aggregatedMap = new Map();

    const addToMap = (itemCode, qty, uom, name, warehouse, defaultWarehouse, category, rate, designQty) => {
      if (!itemCode && !name) return;
      
      const code = (itemCode || name).trim();
      const targetWarehouse = warehouse || defaultWarehouse;
      // Aggregation key: use code to distinguish items. 
      // Now that we have the ACTUAL material code for materials, they will aggregate correctly.
      const key = code.toUpperCase();
      
      // Correct Item Type Mapping
      const mapItemType = (code, cat) => {
        // Force RAW_MATERIAL for material categories
        const materialCategories = ['CORE', 'EXPLODED', 'RAW_MATERIAL', 'COMPONENT'];
        if (materialCategories.includes(String(cat).toUpperCase())) return 'RAW_MATERIAL';

        const c = (code || '').toUpperCase();
        if (c.startsWith('RM-')) return 'RAW_MATERIAL';
        if (c.startsWith('SA-')) return 'SUB_ASSEMBLY';
        if (c.startsWith('FG-')) return 'FG';
        
        // Fallback based on source category
        if (cat === 'FG') return 'FG';
        if (cat === 'SUB_ASSEMBLY') return 'SUB_ASSEMBLY';
        return 'RAW_MATERIAL';
      };

      if (aggregatedMap.has(key)) {
        const existing = aggregatedMap.get(key);
        existing.quantity += Number(qty);
        existing.design_qty = (existing.design_qty || 0) + Number(designQty || 0);
        // Upgrade type to RAW_MATERIAL if it was previously something else but now identified as material
        if (existing.item_type !== 'RAW_MATERIAL') {
          const newType = mapItemType(code, category);
          if (newType === 'RAW_MATERIAL') existing.item_type = 'RAW_MATERIAL';
        }
        if (rate && !existing.unit_rate) existing.unit_rate = rate;
      } else {
        aggregatedMap.set(key, {
          item_code: code,
          quantity: Number(qty),
          design_qty: Number(designQty || 0),
          uom: uom || 'Nos',
          material_name: name || code,
          warehouse: targetWarehouse,
          item_type: mapItemType(code, category),
          unit_rate: rate || 0
        });
      }
    };

    // Step 1: Add Finished Goods (FG)
    const [fgItems] = await connection.query(`
      SELECT ppi.*, COALESCE(ppi.description, soi.description, oi.description, ppi.item_code) as item_name,
             COALESCE(sb.valuation_rate, 0) as stock_rate
      FROM production_plan_items ppi
      LEFT JOIN sales_order_items soi ON ppi.sales_order_item_id = soi.id
      LEFT JOIN order_items oi ON ppi.sales_order_item_id = oi.id
      LEFT JOIN (SELECT item_code, MAX(valuation_rate) as valuation_rate FROM stock_balance GROUP BY item_code) sb ON ppi.item_code = sb.item_code
      WHERE ppi.plan_id = ?
    `, [planId]);

    for (const fg of fgItems) {
      const effectiveRate = fg.rate || fg.stock_rate || 0;
      addToMap(fg.item_code, fg.planned_qty, fg.uom, fg.item_name, fg.warehouse, 'Finished Goods - NC', 'FG', effectiveRate, fg.design_qty);
    }

    // Step 2: Add Sub Assemblies (SA)
    const [saItems] = await connection.query(`
      SELECT sa.*, COALESCE(sa.description, sb.material_name, sa.item_code) as item_name,
             COALESCE(sb.valuation_rate, 0) as stock_rate
      FROM production_plan_sub_assemblies sa
      LEFT JOIN (
        SELECT item_code, MAX(material_name) as material_name, MAX(valuation_rate) as valuation_rate FROM stock_balance GROUP BY item_code
      ) sb ON sa.item_code = sb.item_code
      WHERE sa.plan_id = ?
    `, [planId]);

    for (const sa of saItems) {
      const effectiveRate = sa.rate || sa.stock_rate || 0;
      addToMap(sa.item_code, sa.required_qty, 'Nos', sa.item_name, sa.target_warehouse, 'Work In Progress - NC', 'SUB_ASSEMBLY', effectiveRate, sa.design_qty);
    }

    // Step 3: Add Materials (CORE & EXPLODED)
    const [materials] = await connection.query(`
      SELECT ppm.*, 
             COALESCE(actual_sb.item_code, ppm.item_code) as actual_item_code,
             COALESCE(actual_sb.valuation_rate, 0) as stock_rate
      FROM production_plan_materials ppm
      LEFT JOIN (
        SELECT material_name, MAX(item_code) as item_code, MAX(valuation_rate) as valuation_rate 
        FROM stock_balance 
        GROUP BY material_name
      ) actual_sb ON ppm.material_name = actual_sb.material_name
      WHERE ppm.plan_id = ?
    `, [planId]);

    for (const mat of materials) {
      // Prioritize rate from production_plan_materials (which came from BOM)
      const effectiveRate = mat.rate || mat.stock_rate || 0;
      // Force it to be RAW_MATERIAL because it's from the materials table
      addToMap(mat.actual_item_code, mat.required_qty, mat.uom, mat.material_name, mat.warehouse, 'Store - NC', 'RAW_MATERIAL', effectiveRate, mat.design_qty);
    }

    if (aggregatedMap.size === 0) {
      throw new Error('No items found in this Production Plan to request');
    }

    const aggregatedItems = Array.from(aggregatedMap.values());

    // 4. Generate MR Number
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const [lastMrResult] = await connection.query(
      'SELECT mr_number FROM material_requests WHERE mr_number LIKE ? ORDER BY id DESC LIMIT 1',
      [`MR-${dateStr}-%`]
    );

    let nextNum = 1;
    if (lastMrResult.length > 0) {
      const lastMrNum = lastMrResult[0].mr_number;
      const parts = lastMrNum.split('-');
      const lastSeq = parseInt(parts[parts.length - 1]);
      if (!isNaN(lastSeq)) {
        nextNum = lastSeq + 1;
      }
    }
    const mrNumber = `MR-${dateStr}-${nextNum.toString().padStart(3, '0')}`;

    // 5. Create Material Request Header
    const [mrResult] = await connection.execute(
      `INSERT INTO material_requests (
        mr_number, department, requested_by, required_by, 
        purpose, status, notes, source_warehouse
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mrNumber,
        'Production',
        userId,
        plan.start_date || new Date(),
        'Purchase Request',
        'DRAFT',
        `Generated from Production Plan ${plan.plan_code}`,
        'Consumables Store'
      ]
    );

    const mrId = mrResult.insertId;

    // 6. Create Material Request Items
    for (const item of aggregatedItems) {
      await connection.execute(
        `INSERT INTO material_request_items (
          mr_id, item_code, item_name, item_type, design_qty, quantity, unit_rate, uom, warehouse
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          mrId,
          item.item_code,
          item.material_name,
          item.item_type,
          item.design_qty || 0,
          item.quantity,
          item.unit_rate || 0,
          item.uom,
          item.warehouse
        ]
      );
    }

    // 7. Update Plan Materials Status
    await connection.execute(
      "UPDATE production_plan_materials SET status = 'SUBMITTED' WHERE plan_id = ?",
      [planId]
    );

    await connection.commit();
    return { id: mrId, mr_number: mrNumber, message: 'Material Request created successfully' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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
  deleteProductionPlan,
  createMaterialRequestFromPlan
};
