const pool = require('../config/db');
const bomService = require('./bomService');

const listProductionPlans = async () => {
  const [rows] = await pool.query(
    `SELECT pp.*, u.username as creator_name, 
            COALESCE(o.order_no, o_direct.order_no) as order_no, 
            COALESCE(so.project_name, c_direct.company_name) as project_name,
            COALESCE(c.company_name, c_direct.company_name) as company_name,
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
            (SELECT COUNT(*) FROM job_cards jc JOIN work_orders wo ON jc.work_order_id = wo.id WHERE wo.plan_id = pp.id AND jc.status = 'COMPLETED') as completed_ops,
            (SELECT status FROM material_requests WHERE plan_id = pp.id ORDER BY id DESC LIMIT 1) as mr_status
     FROM production_plans pp
     LEFT JOIN users u ON pp.created_by = u.id
     LEFT JOIN sales_orders so ON pp.sales_order_id = so.id
     LEFT JOIN companies c ON so.company_id = c.id
     LEFT JOIN (
       SELECT quotation_id, order_no, source_type FROM orders 
       WHERE quotation_id IS NOT NULL AND id IN (SELECT MAX(id) FROM orders GROUP BY quotation_id)
     ) o ON (
       (o.source_type = 'DRAWING' AND o.quotation_id = so.id) OR
       (o.source_type = 'DIRECT' AND o.quotation_id = so.customer_po_id)
     )
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
            COALESCE(c.company_name, c_direct.company_name) as company_name,
            COALESCE(ppi_first.item_code) as item_code,
            COALESCE(ppi_first.description) as item_description,
            (SELECT status FROM material_requests WHERE plan_id = pp.id ORDER BY id DESC LIMIT 1) as mr_status
     FROM production_plans pp
     LEFT JOIN users u ON pp.created_by = u.id
     LEFT JOIN sales_orders so ON pp.sales_order_id = so.id
     LEFT JOIN companies c ON so.company_id = c.id
     LEFT JOIN orders o_direct ON pp.sales_order_id = o_direct.id AND o_direct.quotation_id IS NULL
     LEFT JOIN companies c_direct ON o_direct.client_id = c_direct.id
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
       SELECT quotation_id, order_no, source_type FROM orders 
       WHERE quotation_id IS NOT NULL AND id IN (SELECT MAX(id) FROM orders GROUP BY quotation_id)
     ) o ON (
       (o.source_type = 'DRAWING' AND o.quotation_id = so.id) OR
       (o.source_type = 'DIRECT' AND o.quotation_id = so.customer_po_id)
     )
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
  plan.materials = materials.map(m => ({
    ...m,
    dimensions: {
      length: m.length,
      width: m.width,
      thickness: m.thickness,
      diameter: m.diameter,
      outer_diameter: m.outer_diameter
    }
  }));

  // 5. Fetch Operations
  const [operations] = await pool.query(
    `SELECT * FROM production_plan_operations 
     WHERE plan_id = ? 
     ORDER BY 
       CASE 
         WHEN UPPER(item_type) = 'SUB ASSEMBLY' OR UPPER(item_type) = 'SA' THEN 0 
         ELSE 1 
       END ASC, 
       step_no ASC`,
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
           (plan_id, item_code, material_name, design_qty, required_qty, rate, uom, warehouse, bom_ref, source_assembly, material_category, total_wt, is_kg_material, status, length, width, thickness, diameter, outer_diameter)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            planId,
            mat.itemCode || mat.item_code || mat.material_code || mat.item || null,
            mat.materialName || mat.material_name || mat.item || mat.itemCode || mat.item_code || 'Unknown Material',
            mat.designQty || mat.design_qty || finalTargetQty || 0,
            mat.requiredQty || mat.required_qty || 0,
            mat.rate || 0,
            mat.uom || mat.unit || 'Nos',
            mat.warehouse || null,
            mat.bomRef || mat.bom_ref || null,
            mat.sourceAssembly || mat.source_assembly || null,
            mat.category || mat.material_category || (mat.sourceAssembly || mat.source_assembly ? 'EXPLODED' : 'CORE'),
            mat.total_wt || 0,
            mat.is_kg_material ? 1 : 0,
            mat.status || '--',
            mat.dimensions?.length || mat.length || 0,
            mat.dimensions?.width || mat.width || 0,
            mat.dimensions?.thickness || mat.thickness || 0,
            mat.dimensions?.diameter || mat.diameter || 0,
            mat.dimensions?.outer_diameter || mat.outer_diameter || 0
          ]
        );
      }
    }

    // 5. Save Operations
    if (operations && Array.isArray(operations)) {
      for (const op of operations) {
        await connection.execute(
          `INSERT INTO production_plan_operations 
           (plan_id, step_no, operation_name, process_type, workstation, base_time, net_time, source_item, item_type, cycle_time_min, setup_time_min)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            planId,
            op.step || op.stepNo || 0,
            op.operationName || op.operation_name || null,
            op.processType || op.operation_type || 'In-House',
            op.workstation || null,
            op.baseTime || op.base_time || op.baseTimeHrs || op.base_hour || 0,
            op.netTime || op.net_time || 0,
            op.sourceItem || op.source_item || null,
            op.item_type || op.itemType || 'FG',
            op.cycle_time_min || op.cycleTimeMin || 0,
            op.setup_time_min || op.setupTimeMin || 0
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
           (plan_id, item_code, material_name, design_qty, required_qty, rate, uom, warehouse, bom_ref, total_wt, is_kg_material, source_assembly, material_category, status, length, width, thickness, diameter, outer_diameter)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            planId,
            mat.itemCode || mat.item_code || mat.material_code || mat.item || null,
            mat.materialName || mat.material_name || mat.item || mat.itemCode || mat.item_code || 'Unknown Material',
            mat.designQty || mat.design_qty || finalTargetQty || 0,
            mat.requiredQty || mat.required_qty || 0,
            mat.rate || 0,
            mat.uom || mat.unit || 'Nos',
            mat.warehouse || null,
            mat.bomRef || mat.bom_ref || null,
            mat.total_wt || 0,
            mat.is_kg_material ? 1 : 0,
            mat.sourceAssembly || mat.source_assembly || null,
            mat.materialCategory || mat.material_category || mat.category || (mat.sourceAssembly || mat.source_assembly ? 'EXPLODED' : 'CORE'),
            mat.status || '--',
            mat.dimensions?.length || mat.length || 0,
            mat.dimensions?.width || mat.width || 0,
            mat.dimensions?.thickness || mat.thickness || 0,
            mat.dimensions?.diameter || mat.diameter || 0,
            mat.dimensions?.outer_diameter || mat.outer_diameter || 0
          ]
        );
      }
    }

    // 6. Re-save Operations
    if (operations && Array.isArray(operations)) {
      for (const op of operations) {
        await connection.execute(
          `INSERT INTO production_plan_operations 
           (plan_id, step_no, operation_name, process_type, workstation, base_time, net_time, source_item, item_type, cycle_time_min, setup_time_min)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            planId,
            op.step || op.stepNo || 0,
            op.operationName || op.operation_name || null,
            op.processType || op.operation_type || 'In-House',
            op.workstation || null,
            op.baseTime || op.base_time || op.baseTimeHrs || op.base_hour || 0,
            op.netTime || op.net_time || 0,
            op.sourceItem || op.itemCode || op.source_item || null,
            op.item_type || op.itemType || 'FG',
            op.cycle_time_min || op.cycleTimeMin || 0,
            op.setup_time_min || op.setupTimeMin || 0
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
             soi.parent_bom_id as parent_bom_id,
             COALESCE(planned.already_planned_qty, 0) as already_planned_qty
      FROM sales_order_items soi
      JOIN sales_orders so ON soi.sales_order_id = so.id
      JOIN (
        SELECT quotation_id, order_no, source_type FROM orders 
        WHERE quotation_id IS NOT NULL AND id IN (SELECT MAX(id) FROM orders GROUP BY quotation_id)
      ) o ON (
        (o.source_type = 'DRAWING' AND o.quotation_id = so.id) OR
        (o.source_type = 'DIRECT' AND o.quotation_id = so.customer_po_id)
      )
      LEFT JOIN (
        SELECT sales_order_item_id, SUM(planned_qty) as already_planned_qty
        FROM production_plan_items 
        WHERE status != 'CANCELLED'
        GROUP BY sales_order_item_id
      ) planned ON soi.id = planned.sales_order_item_id
      WHERE (soi.status IS NULL OR TRIM(UPPER(soi.status)) NOT IN ('REJECTED', 'CANCELLED')) 
      AND (TRIM(UPPER(soi.item_type)) IN ('FG', 'FINISHED GOODS', 'FINISHED_GOODS', 'ASSEMBLY'))
      AND (COALESCE(planned.already_planned_qty, 0) < soi.quantity)
      AND soi.parent_bom_id IS NULL
      AND soi.item_code != 'XXX'
      AND soi.item_code IS NOT NULL
      AND soi.item_code != ''
      AND soi.item_code NOT LIKE '%XXX%'
      AND soi.item_code NOT LIKE '%NO CODE%'

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
             soi.parent_bom_id as parent_bom_id,
             COALESCE(planned.already_planned_qty, 0) as already_planned_qty
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN companies c ON o.client_id = c.id
      LEFT JOIN sales_order_items soi ON (TRIM(oi.drawing_no) = TRIM(soi.drawing_no) AND soi.sales_order_id = o.quotation_id)
      LEFT JOIN (
        SELECT sales_order_item_id, SUM(planned_qty) as already_planned_qty
        FROM production_plan_items 
        WHERE status != 'CANCELLED'
        GROUP BY sales_order_item_id
      ) planned ON oi.id = planned.sales_order_item_id
      WHERE o.quotation_id IS NULL 
      AND (TRIM(UPPER(oi.type)) IN ('FG', 'FINISHED GOODS', 'FINISHED_GOODS', 'ASSEMBLY'))
      AND (COALESCE(planned.already_planned_qty, 0) < oi.quantity)
      AND (soi.parent_bom_id IS NULL)
      AND oi.item_code != 'XXX'
      AND oi.item_code IS NOT NULL
      AND oi.item_code != ''
      AND oi.item_code NOT LIKE '%XXX%'
      AND oi.item_code NOT LIKE '%NO CODE%'
    ) combined
    ORDER BY production_priority DESC, created_at ASC`
  );
  return rows;
};

const getProductionReadySalesOrders = async () => {
  const [rows] = await pool.query(
    `SELECT combined.* FROM (
      SELECT o.id, 
              o.order_no, 
              COALESCE(so.project_name, c.company_name, '') as project_name, 
              cp.po_number, 
              c.company_name, 
              o.created_at
       FROM orders o
       LEFT JOIN sales_orders so ON (
         (o.source_type = 'DRAWING' AND o.quotation_id = so.id) OR
         (o.source_type = 'DIRECT' AND o.quotation_id = so.customer_po_id)
       )
       LEFT JOIN companies c ON o.client_id = c.id
       LEFT JOIN customer_pos cp ON (
         (o.source_type = 'DIRECT' AND o.quotation_id = cp.id) OR
         (o.source_type = 'DRAWING' AND so.customer_po_id = cp.id)
       )
       WHERE 
         -- Only show Sales Orders starting with ORD-
         o.order_no LIKE 'ORD-%'
         -- 1. Has at least one FG/Assembly item
         AND (EXISTS (
           SELECT 1 FROM order_items oi 
           WHERE oi.order_id = o.id 
           AND TRIM(UPPER(oi.type)) IN ('FG', 'FINISHED GOODS', 'FINISHED_GOODS', 'ASSEMBLY')
         ) OR EXISTS (
           SELECT 1 FROM sales_order_items soi 
           WHERE soi.sales_order_id = so.id 
           AND TRIM(UPPER(soi.item_type)) IN ('FG', 'FINISHED GOODS', 'FINISHED_GOODS', 'ASSEMBLY')
         ))
         -- 2. Exclude rejected or cancelled sales orders
         AND (o.quotation_id IS NULL OR so.status NOT IN ('REJECTED', 'CANCELLED'))
         -- 3. Must have at least one BOM record with cost > 0
         AND (
           (o.quotation_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM sales_order_items soi
             WHERE soi.sales_order_id = so.id
               AND soi.bom_cost > 0
           ))
           OR
           (o.quotation_id IS NULL AND EXISTS (
             SELECT 1 FROM order_items oi
             JOIN sales_order_items soi ON TRIM(soi.drawing_no) = TRIM(oi.drawing_no)
             WHERE oi.order_id = o.id
               AND soi.sales_order_id IS NULL
               AND soi.bom_cost > 0
           ))
         )
         -- 4. Exclude if any required drawing has no completed BOM
         AND NOT EXISTS (
           SELECT 1 FROM order_items oi
           WHERE oi.order_id = o.id
             AND TRIM(UPPER(oi.type)) IN ('FG', 'FINISHED GOODS', 'FINISHED_GOODS', 'ASSEMBLY')
             AND (oi.item_code IS NULL OR (oi.item_code != 'XXX' AND oi.item_code NOT LIKE '%XXX%' AND oi.item_code NOT LIKE '%NO CODE%'))
             AND (
               (o.quotation_id IS NOT NULL AND NOT EXISTS (
                 SELECT 1 FROM sales_order_items soi
                 WHERE soi.sales_order_id = so.id
                   AND TRIM(soi.drawing_no) = TRIM(oi.drawing_no)
                   AND soi.bom_cost > 0
               ))
               OR
               (o.quotation_id IS NULL AND NOT EXISTS (
                 SELECT 1 FROM sales_order_items soi
                 WHERE soi.sales_order_id IS NULL
                   AND TRIM(soi.drawing_no) = TRIM(oi.drawing_no)
                   AND soi.bom_cost > 0
               ))
             )
         )
    ) AS combined
    GROUP BY combined.id, combined.order_no, combined.project_name, combined.po_number, combined.company_name, combined.created_at
    ORDER BY combined.created_at DESC`
  );
  return rows;
};

const getSalesOrderFullDetails = async (id) => {
  // Try to find in orders table first (new system)
  const [orders] = await pool.query(
    `SELECT o.*, c.company_name, cp.po_number, o.order_no, 
            so.id as sales_order_id, so.project_name
     FROM orders o
     LEFT JOIN sales_orders so ON (
       (o.source_type = 'DRAWING' AND o.quotation_id = so.id) OR
       (o.source_type = 'DIRECT' AND o.quotation_id = so.customer_po_id)
     )
     LEFT JOIN companies c ON o.client_id = c.id
     LEFT JOIN customer_pos cp ON (
       (o.source_type = 'DIRECT' AND o.quotation_id = cp.id) OR
       (o.source_type = 'DRAWING' AND so.customer_po_id = cp.id)
     )
     WHERE o.id = ?`,
    [id]
  );

  if (orders.length > 0) {
    const order = orders[0];

    // Fetch items from order_items
    const [items] = await pool.query(
      `SELECT * FROM (
        SELECT COALESCE(soi.id, oi.id) as id,
                COALESCE(soi.id, oi.id) as sales_order_item_id,
                oi.id as order_item_id,
                oi.order_id as sales_order_id,
                oi.item_code as item_code,
                oi.type as item_type,
                oi.drawing_no as drawing_no,
                COALESCE(soi.revision_no, oi.drawing_no) as bom_no,
                oi.description,
                oi.quantity as quantity,
                oi.quantity as design_qty,
                'Nos' as unit,
                soi.status,
                soi.created_at,
                soi.parent_bom_id as parent_bom_id,
                COALESCE(planned.already_planned_qty, 0) as already_planned_qty,
                ROW_NUMBER() OVER (PARTITION BY TRIM(oi.drawing_no), TRIM(oi.item_code) ORDER BY soi.bom_cost DESC, soi.id DESC) as rn
         FROM order_items oi
         LEFT JOIN sales_order_items soi ON (
           TRIM(oi.drawing_no) = TRIM(soi.drawing_no) 
           AND soi.sales_order_id = (
             SELECT DISTINCT so.id FROM sales_orders so
             JOIN orders o ON (
               (o.source_type = 'DRAWING' AND o.quotation_id = so.id) OR
               (o.source_type = 'DIRECT' AND o.quotation_id = so.customer_po_id)
             )
             WHERE o.id = oi.order_id
             LIMIT 1
           )
         )
         LEFT JOIN (
           SELECT sales_order_id, sales_order_item_id, SUM(planned_qty) as already_planned_qty
           FROM production_plan_items 
           WHERE status != 'CANCELLED'
           GROUP BY sales_order_id, sales_order_item_id
         ) planned ON oi.order_id = planned.sales_order_id AND oi.id = planned.sales_order_item_id
         WHERE oi.order_id = ? 
         AND (TRIM(UPPER(oi.type)) IN ('FG', 'FINISHED GOODS', 'FINISHED_GOODS', 'ASSEMBLY') 
              OR TRIM(UPPER(soi.item_type)) IN ('FG', 'FINISHED GOODS', 'FINISHED_GOODS', 'ASSEMBLY'))
         AND (soi.status IS NULL OR TRIM(UPPER(soi.status)) NOT IN ('REJECTED', 'CANCELLED'))
         AND (soi.parent_bom_id IS NULL)
         AND oi.item_code != 'XXX'
         AND oi.item_code IS NOT NULL
         AND oi.item_code != ''
         AND oi.item_code NOT LIKE '%XXX%'
         AND oi.item_code NOT LIKE '%NO CODE%'
      ) t WHERE rn = 1`,
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
       SELECT quotation_id, order_no, source_type FROM orders 
       WHERE quotation_id IS NOT NULL ORDER BY id DESC
     ) o ON (
       (o.source_type = 'DRAWING' AND o.quotation_id = so.id) OR
       (o.source_type = 'DIRECT' AND o.quotation_id = so.customer_po_id)
     )
     WHERE so.id = ?`,
    [id]
  );

  if (soOrders.length === 0) return null;
  const soOrder = soOrders[0];

  const [soItems] = await pool.query(
    `SELECT * FROM (
      SELECT soi.id,
              soi.id as sales_order_item_id,
              soi.sales_order_id,
              soi.item_code as item_code,
              soi.item_type as item_type,
              soi.drawing_no as drawing_no,
              COALESCE(soi.revision_no, soi.drawing_no) as bom_no,
              soi.description,
              soi.quantity as quantity,
              soi.quantity as design_qty,
              soi.unit,
              soi.status,
              soi.rejection_reason,
              soi.parent_bom_id as parent_bom_id,
              COALESCE(planned.already_planned_qty, 0) as already_planned_qty,
              ROW_NUMBER() OVER (PARTITION BY TRIM(soi.drawing_no), TRIM(soi.item_code) ORDER BY soi.bom_cost DESC, soi.id DESC) as rn
       FROM sales_order_items soi
       LEFT JOIN (
         SELECT sales_order_id, sales_order_item_id, SUM(planned_qty) as already_planned_qty
         FROM production_plan_items 
         WHERE status != 'CANCELLED'
         GROUP BY sales_order_id, sales_order_item_id
       ) planned ON soi.sales_order_id = planned.sales_order_id AND soi.id = planned.sales_order_item_id
       WHERE soi.sales_order_id = ? 
       AND (TRIM(UPPER(soi.item_type)) IN ('FG', 'FINISHED GOODS', 'FINISHED_GOODS', 'ASSEMBLY'))
       AND TRIM(UPPER(COALESCE(soi.item_group, ''))) NOT IN ('SUB ASSEMBLY', 'SUB_ASSEMBLY', 'SA')
       AND (soi.status IS NULL OR TRIM(UPPER(soi.status)) NOT IN ('REJECTED', 'CANCELLED'))
       AND (soi.parent_bom_id IS NULL)
       AND soi.item_code != 'XXX'
       AND soi.item_code IS NOT NULL
       AND soi.item_code != ''
       AND soi.item_code NOT LIKE '%XXX%'
       AND soi.item_code NOT LIKE '%NO CODE%'
    ) t WHERE rn = 1
    ORDER BY id DESC`,
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
  // 1. Try to fetch from sales_order_items directly - this is now our primary BOM header
  let [items] = await pool.query(
    'SELECT id, item_code, drawing_no, sales_order_id FROM sales_order_items WHERE id = ?',
    [salesOrderItemId]
  );

  let soItemIdForLookup = null;

  if (items.length > 0) {
    const item = items[0];
    soItemIdForLookup = item.id;

    // Check if THIS specific ID has any materials or operations. 
    // If not, try to find another ID in the same order with the same item identity that HAS materials.
    const [hasData] = await pool.query(
      `SELECT id FROM sales_order_item_materials WHERE sales_order_item_id = ? 
       UNION 
       SELECT id FROM sales_order_item_operations WHERE sales_order_item_id = ? 
       LIMIT 1`,
      [soItemIdForLookup, soItemIdForLookup]
    );

    if (hasData.length === 0) {
      console.log(`[getItemBOMDetails] ID ${soItemIdForLookup} has no materials/operations, searching for alternatives in SO ${item.sales_order_id}`);
      const [altMatch] = await pool.query(
        `SELECT soi.id 
         FROM sales_order_items soi
         LEFT JOIN sales_order_item_materials som ON soi.id = som.sales_order_item_id
         LEFT JOIN sales_order_item_operations soo ON soi.id = soo.sales_order_item_id
         WHERE soi.sales_order_id = ? 
         AND (soi.item_code = ? OR (soi.drawing_no = ? AND soi.drawing_no IS NOT NULL))
         GROUP BY soi.id
         HAVING COUNT(som.id) > 0 OR COUNT(soo.id) > 0
         ORDER BY (COUNT(som.id) + COUNT(soo.id)) DESC, soi.id DESC`,
        [item.sales_order_id, item.item_code, item.drawing_no]
      );

      if (altMatch.length > 0) {
        console.log(`[getItemBOMDetails] Found ${altMatch.length} alternative SO Item IDs with data, using most recent`);
        soItemIdForLookup = altMatch[0].id;
      } else {
        // Fallback: Try to find any MASTER BOM for this drawing/item code
        const [masterMatch] = await pool.query(
          `SELECT soi.id 
           FROM sales_order_items soi
           JOIN sales_order_item_materials som ON soi.id = som.sales_order_item_id
           WHERE (soi.item_code = ? OR (soi.drawing_no = ? AND soi.drawing_no IS NOT NULL)) AND soi.sales_order_id IS NULL 
           ORDER BY soi.id DESC LIMIT 1`,
          [item.item_code, item.drawing_no]
        );
        if (masterMatch.length > 0) {
          console.log(`[getItemBOMDetails] Found MASTER Item ID ${masterMatch[0].id} with data`);
          soItemIdForLookup = masterMatch[0].id;
        } else {
          // ULTIMATE FALLBACK: Find the SINGLE matching item with most data
          const [globalMatches] = await pool.query(
            `SELECT soi.id 
             FROM sales_order_items soi
             LEFT JOIN sales_order_item_materials som ON soi.id = som.sales_order_item_id
             LEFT JOIN sales_order_item_components soc ON soi.id = soc.sales_order_item_id
             WHERE (soi.item_code = ? OR (soi.drawing_no = ? AND soi.drawing_no IS NOT NULL))
             GROUP BY soi.id
             HAVING (COUNT(som.id) + COUNT(soc.id)) > 0
             ORDER BY (COUNT(soc.id) * 5 + COUNT(som.id)) DESC, soi.id DESC LIMIT 1`,
            [item.item_code, item.drawing_no]
          );

          if (globalMatches.length > 0) {
            console.log(`[getItemBOMDetails] Found global match ID ${globalMatches[0].id}, using its data`);
            soItemIdForLookup = globalMatches[0].id;
          }
        }
      }
    }
  } else {
    // 2. Fallback to order_items (new system)
    [items] = await pool.query(
      'SELECT id, item_code, drawing_no, order_id FROM order_items WHERE id = ?',
      [salesOrderItemId]
    );

    if (items.length > 0) {
      const item = items[0];

      // For order_items, we need to find the linked BOM header in sales_order_items
      // Try to find a sales_order_item with the same drawing_no in the same "sales order" 
      // OR directly linked to this order_id (sometimes they are stored that way)
      // IMPROVED: Join with materials to ensure we pick an ID that actually HAS data
      const [soMatch] = await pool.query(
        `SELECT soi.id 
         FROM sales_order_items soi
         LEFT JOIN orders o ON (
           (o.source_type = 'DRAWING' AND o.quotation_id = soi.sales_order_id) OR
           (o.source_type = 'DIRECT' AND o.quotation_id = (
             SELECT customer_po_id FROM sales_orders WHERE id = soi.sales_order_id
           ))
         )
         LEFT JOIN sales_order_item_materials som ON soi.id = som.sales_order_item_id
         LEFT JOIN sales_order_item_operations soo ON soi.id = soo.sales_order_item_id
         WHERE (
           o.id = ? 
           OR soi.sales_order_id = ? 
           OR soi.sales_order_id = (
             SELECT DISTINCT so.id FROM sales_orders so
             JOIN orders ord ON (
               (ord.source_type = 'DRAWING' AND ord.quotation_id = so.id) OR
               (ord.source_type = 'DIRECT' AND ord.quotation_id = so.customer_po_id)
             )
             WHERE ord.id = ?
             LIMIT 1
           )
         ) 
         AND (soi.drawing_no = ? OR soi.item_code = ?) AND soi.drawing_no IS NOT NULL
         GROUP BY soi.id
         ORDER BY 
           (COUNT(som.id) + COUNT(soo.id)) DESC,
           (soi.item_code = ?) DESC,
           soi.id DESC`,
        [item.order_id, item.order_id, item.order_id, item.drawing_no, item.item_code, item.item_code]
      );

      if (soMatch.length > 0) {
        soItemIdForLookup = soMatch[0].id;
      } else {
        // Fallback: Try to find a MASTER BOM for this drawing
        const [masterMatch] = await pool.query(
          `SELECT id FROM sales_order_items 
           WHERE (drawing_no = ? OR item_code = ?) AND sales_order_id IS NULL 
           ORDER BY id DESC LIMIT 1`,
          [item.drawing_no, item.item_code]
        );
        if (masterMatch.length > 0) {
          soItemIdForLookup = masterMatch[0].id;
        } else {
          // ULTIMATE FALLBACK: Find the SINGLE matching item with most data
          const [globalMatches] = await pool.query(
            `SELECT soi.id 
             FROM sales_order_items soi
             LEFT JOIN sales_order_item_materials som ON soi.id = som.sales_order_item_id
             LEFT JOIN sales_order_item_components soc ON soi.id = soc.sales_order_item_id
             WHERE (soi.item_code = ? OR (soi.drawing_no = ? AND soi.drawing_no IS NOT NULL))
             GROUP BY soi.id
             HAVING (COUNT(som.id) + COUNT(soc.id)) > 0
             ORDER BY (COUNT(soc.id) * 5 + COUNT(som.id)) DESC, soi.id DESC LIMIT 1`,
            [item.item_code, item.drawing_no]
          );
          if (globalMatches.length > 0) {
            console.log(`[getItemBOMDetails] Found global match ID ${globalMatches[0].id} (from order_items fallback)`);
            soItemIdForLookup = globalMatches[0].id;
          }
        }
      }
    }
  }

  if (!soItemIdForLookup && items.length > 0) {
     console.log(`[getItemBOMDetails] No soItemIdForLookup found for ${items[0].item_code}, but item exists in items table.`);
  }

  if (items.length === 0) return null;
  const item = items[0];
  console.log(`[getItemBOMDetails] Exploding BOM for ${item.item_code} / ${item.drawing_no} using lookup ID: ${soItemIdForLookup}`);

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

    // Safety check: Ensure soItemId actually refers to an item with matching identity
    // If soItemId is an array, we validate the first one or treat them as a collective
    if (soItemId && depth === 0) {
      const firstId = Array.isArray(soItemId) ? soItemId[0] : soItemId;
      const [check] = await pool.query(
        'SELECT item_code, drawing_no FROM sales_order_items WHERE id = ?',
        [firstId]
      );
      if (check.length > 0) {
        const matches = (drawingNo && check[0].drawing_no === drawingNo) || (check[0].item_code === itemCode);
        if (!matches) {
          console.warn(`[explodeBOM] Identity mismatch for soItemId ${firstId}. Expected ${itemCode}/${drawingNo}, found ${check[0].item_code}/${check[0].drawing_no}.`);
          if (!Array.isArray(soItemId)) soItemId = null;
        }
      }
    }

    const bomContextKey = `${currentIdentity}-${Array.isArray(soItemId) ? soItemId.sort().join(',') : (soItemId || 'MASTER')}-${parentId || 'TOP'}`;

    if (processedBOMs.has(bomContextKey)) return { materials: [], components: [], operations: [] };
    processedBOMs.add(bomContextKey);

    // Fetch data from specific context
    let materials = [];
    let components = [];
    let operations = [];

    console.log(`[explodeBOM] Level ${depth}: ${itemCode} (Drawing: ${drawingNo}), soItemId: ${soItemId}, parentId: ${parentId}, qtyMultiplier: ${qtyMultiplier}`);

    // 1. Try to fetch from Sales Order context OR Master BOM with parent_id
    if (soItemId || parentId) {
      const isArray = Array.isArray(soItemId);
      const targetSoIds = isArray ? soItemId : [soItemId || null];
      const refId = isArray ? soItemId[0] : (soItemId || null);

      const [soM] = await pool.query('SELECT * FROM sales_order_item_materials WHERE sales_order_item_id IN (?) AND parent_id <=> ?', [targetSoIds, parentId]);

      // Join with sales_order_items to get item_type for components
      const [soC] = await pool.query(`
        SELECT c.*, 
               MAX(soi.item_type) as item_type, 
               MAX(soi.item_group) as item_group,
               MAX(soi.drawing_no) as drawing_no
        FROM sales_order_item_components c
        LEFT JOIN sales_order_items soi ON c.component_code = soi.item_code
        AND soi.sales_order_id <=> (SELECT sales_order_id FROM sales_order_items WHERE id = ? LIMIT 1)
        WHERE c.sales_order_item_id IN (?) AND c.parent_id <=> ?
        GROUP BY c.id`, [refId, targetSoIds, parentId]);

      // De-duplicate components by component_code + drawing_no
      const uniqueComps = new Map();
      soC.forEach(c => {
        const key = `${c.component_code}-${c.drawing_no || ''}`;
        if (!uniqueComps.has(key)) uniqueComps.set(key, c);
      });

      // Normalize item_type
      const soCWithTypes = Array.from(uniqueComps.values()).map(c => ({
        ...c,
        item_type: (c.item_type === 'SA' || c.item_type === 'SFG' || c.item_group === 'Sub Assembly' || c.item_group === 'SUB_ASSEMBLY' || c.item_group === 'SFG' || (c.component_code && (c.component_code.startsWith('SA-') || c.component_code.startsWith('SFG-')))) ? 'Sub Assembly' : (c.item_type || 'FG')
      }));

      materials = soM;
      components = soCWithTypes;

      // Operations are usually flat for the item, fetch if matches item identity
      const [soO] = await pool.query(`
        SELECT * FROM sales_order_item_operations 
        WHERE sales_order_item_id IN (?) 
        AND (
          TRIM(UPPER(item_code)) = TRIM(UPPER(?)) 
          OR (TRIM(UPPER(drawing_no)) = TRIM(UPPER(?)) AND drawing_no IS NOT NULL)
        )`, [targetSoIds, itemCode, drawingNo]);
      operations = soO;
    }

    // 2. Granular Fallback to Master BOM or Any BOM (for missing parts)
    if (materials.length === 0 || components.length === 0 || operations.length === 0) {
      console.log(`[explodeBOM] Partial or missing SO data for ${itemCode}, checking fallback (ParentId: ${parentId})`);

      const fetchMissing = async (refId) => {
        if (materials.length === 0) {
          const m = await bomService.getItemMaterials(refId, itemCode, drawingNo);
          materials = parentId ? m.filter(x => x.parent_id == parentId) : m.filter(x => !x.parent_id);
        }
        if (components.length === 0) {
          const c = await bomService.getItemComponents(refId, itemCode, drawingNo);
          components = parentId ? c.filter(x => x.parent_id == parentId) : c.filter(x => !x.parent_id);
        }
        if (operations.length === 0) {
          operations = await bomService.getItemOperations(refId, itemCode, drawingNo);
        }
      };

      // Try with the provided context first
      if (soItemId) await fetchMissing(soItemId);

      // If still missing any part, use generic Master BOM lookup (NULL ID)
      if (materials.length === 0 || components.length === 0 || operations.length === 0) {
        await fetchMissing(null);
      }

      // 3. ULTIMATE GLOBAL FALLBACK: If STILL empty, try to find ANY Sales Order Item with this identity that HAS data
      if (materials.length === 0 && components.length === 0 && operations.length === 0 && !parentId) {
        console.log(`[explodeBOM] Still empty for ${itemCode}, trying ULTIMATE GLOBAL fallback`);
        const [globalMatch] = await pool.query(
          `SELECT soi.id 
           FROM sales_order_items soi
           LEFT JOIN sales_order_item_materials som ON soi.id = som.sales_order_item_id
           LEFT JOIN sales_order_item_components soc ON soi.id = soc.sales_order_item_id
           WHERE (soi.item_code = ? OR (soi.drawing_no = ? AND soi.drawing_no IS NOT NULL))
           GROUP BY soi.id
           ORDER BY (COUNT(som.id) + COUNT(soc.id)) DESC, soi.id DESC LIMIT 1`,
          [itemCode, drawingNo]
        );

        if (globalMatch.length > 0) {
          const gId = globalMatch[0].id;
          console.log(`[explodeBOM] Found GLOBAL fallback ID ${gId} for ${itemCode}`);
          const [gM] = await pool.query('SELECT * FROM sales_order_item_materials WHERE sales_order_item_id = ? AND parent_id IS NULL', [gId]);
          const [gC] = await pool.query(`
            SELECT c.*, MAX(soi.item_type) as item_type, MAX(soi.item_group) as item_group
            FROM sales_order_item_components c
            LEFT JOIN sales_order_items soi ON (c.component_code = soi.item_code OR (c.drawing_no = soi.drawing_no AND c.drawing_no IS NOT NULL))
            WHERE c.sales_order_item_id = ? AND c.parent_id IS NULL
            GROUP BY c.id`, [gId]);
          const [gO] = await pool.query('SELECT * FROM sales_order_item_operations WHERE sales_order_item_id = ?', [gId]);

          materials = gM;
          components = gC.map(c => ({
            ...c,
            item_type: (c.item_type === 'SA' || c.item_type === 'SFG' || c.item_group === 'Sub Assembly' || c.item_group === 'SUB_ASSEMBLY' || c.item_group === 'SFG' || (c.component_code && (c.component_code.startsWith('SA-') || c.component_code.startsWith('SFG-')))) ? 'Sub Assembly' : (c.item_type || 'FG')
          }));
          operations = gO;
        }
      }

      // Map item types for all components (including those from fallbacks)
      components = components.map(c => ({
        ...c,
        item_type: (c.item_type === 'SA' || c.item_type === 'SFG' || c.item_group === 'Sub Assembly' || c.item_group === 'SUB_ASSEMBLY' || c.item_group === 'SFG' || (c.component_code && (c.component_code.startsWith('SA-') || c.component_code.startsWith('SFG-')))) ? 'Sub Assembly' : (c.item_type || 'FG')
      }));
    }

    console.log(`[explodeBOM] Result for ${itemCode}: ${materials.length} materials, ${components.length} components, ${operations.length} operations`);

    // Process Materials
    materials.forEach(m => {
      // level 0 (FG) and level 1 (direct sub-assemblies) are considered CORE for primary list
      const material_category = (depth <= 1) ? 'CORE' : 'EXPLODED';
      const source_assembly = depth === 0 ? null : itemCode;

      const weight = (m.weight_per_unit && parseFloat(m.weight_per_unit) > 0) ? parseFloat(m.weight_per_unit) : 0;
      const scrapFactor = (m.scrap_percent && parseFloat(m.scrap_percent) > 0) ? (1 + parseFloat(m.scrap_percent) / 100) : 1;
      const total_wt = weight * scrapFactor;

      const itemGroup = (m.item_group || '').toUpperCase().replace(/_/g, ' ');
      const uom = (m.uom || '').toUpperCase();
      const isKgMaterial = (itemGroup.includes('RAW MATERIAL') || itemGroup.includes('CONSUMABLE')) && uom === 'KG';

      const baseQtyPerFG = isKgMaterial ? ((parseFloat(m.qty_per_pc) || 1) * total_wt) : (parseFloat(m.qty_per_pc) || 1);

      const matName = m.material_name || m.name || m.item || 'Unknown Material';
      const matCode = m.material_code || m.item_code || m.itemCode || '';
      const mKey = `${matName}-${matCode}`;

      const existing = materialMap.get(mKey);
      const reqQty = baseQtyPerFG * qtyMultiplier;

      if (existing) {
        existing.required_qty += reqQty;
        existing.totalRequiredQty += reqQty;
        // Prioritize CORE category
        if (material_category === 'CORE') {
          existing.material_category = 'CORE';
        }
      } else {
        materialMap.set(mKey, {
          ...m,
          material_name: matName,
          material_code: matCode,
          item_code: matCode,
          material_category,
          required_qty: reqQty,
          totalRequiredQty: reqQty,
          source_assembly,
          rate: m.rate || 0,
          bom_ref: m.bom_no || m.bom_ref || drawingNo || 'BOM-REF',
          total_wt: total_wt,
          is_kg_material: isKgMaterial
        });
      }
    });

    // Process Operations
    if (operations.length > 0) {
      const opsWithSource = operations.map(o => {
        const cycle = parseFloat(o.cycle_time_min || o.base_time || 0);
        const setup = parseFloat(o.setup_time_min || 0);
        const totalMins = cycle + setup;

        return {
          ...o,
          source_item: itemCode,
          // CRITICAL: At the root level (depth === 0), we MUST use the itemCode 
          // that was passed in to ensure it matches the Production Plan's item identifier.
          // This handles cases where BOM operations are defined under a different code 
          // (e.g. OTH-LEDCEILING-0001) but the Plan uses a Drawing Number as code (e.g. 900001105).
          itemCode: depth === 0 ? itemCode : (o.itemCode || o.item_code || itemCode),
          item_type: parentType,
          process_type: o.operation_type || 'In-House',
          base_time: (totalMins / 60).toFixed(4), // Convert to hours
          net_time: (totalMins / 60).toFixed(4)   // Convert to hours
        };
      });

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
        const targetIds = Array.isArray(soItemId) ? soItemId : [soItemId];
        const [found] = await pool.query(
          `SELECT id FROM sales_order_items 
           WHERE item_code = ? 
           AND (
             sales_order_id IN (
               SELECT id FROM sales_orders 
               WHERE id IN (SELECT sales_order_id FROM sales_order_items WHERE id IN (?))
               OR (customer_po_id IS NOT NULL AND customer_po_id IN (
                 SELECT customer_po_id FROM sales_orders 
                 WHERE id IN (SELECT sales_order_id FROM sales_order_items WHERE id IN (?))
               ))
             )
           )
           ORDER BY id DESC
           LIMIT 1`,
          [compCode, targetIds, targetIds]
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
      materials: materials.map(m => {
        const weight = (m.weight_per_unit && parseFloat(m.weight_per_unit) > 0) ? parseFloat(m.weight_per_unit) : 0;
        const scrapFactor = (m.scrap_percent && parseFloat(m.scrap_percent) > 0) ? (1 + parseFloat(m.scrap_percent) / 100) : 1;
        const total_wt = weight * scrapFactor;

        const itemGroup = (m.item_group || '').toUpperCase().replace(/_/g, ' ');
        const uom = (m.uom || '').toUpperCase();
        const isKgMaterial = (itemGroup.includes('RAW MATERIAL') || itemGroup.includes('CONSUMABLE')) && uom === 'KG';

        const baseQtyPerFG = isKgMaterial ? ((parseFloat(m.qty_per_pc) || 1) * total_wt) : (parseFloat(m.qty_per_pc) || 1);

        return {
          ...m,
          item_code: m.material_code || m.item_code || m.itemCode || null,
          material_name: m.material_name || m.name || null,
          qty_per_pc: m.qty_per_pc || 0,
          required_qty: baseQtyPerFG * qtyMultiplier,
          total_wt: total_wt,
          is_kg_material: isKgMaterial
        };
      }),
      operations: (operationMap.get(currentIdentity) || []),
      components: componentResults
    };
  };

  await explodeBOM(item.item_code, item.drawing_no, soItemIdForLookup, null, 1, 0, 'FG');

  // 2. Fetch dimensions from stock_balance for materials and components
  const finalMaterials = Array.from(materialMap.values());
  const finalComponents = Array.from(componentMap.values());

  const enrichWithDimensions = async (list, codeField) => {
    for (const item of list) {
      const itemCode = item[codeField];
      const matName = item.material_name || item.materialName;

      let query = 'SELECT length, width, thickness, diameter, outer_diameter, density, weight_per_unit, unit FROM stock_balance WHERE ';
      const params = [];

      if (itemCode) {
        query += 'item_code = ? ';
        params.push(itemCode);
      } else if (matName) {
        query += 'material_name = ? ';
        params.push(matName);
      } else {
        continue;
      }

      const [stockData] = await pool.query(query + ' LIMIT 1', params);
      if (stockData.length > 0) {
        const s = stockData[0];
        item.dimensions = {
          length: s.length,
          width: s.width,
          thickness: s.thickness,
          diameter: s.diameter,
          outer_diameter: s.outer_diameter,
          density: s.density
        };
        item.weight_per_unit = s.weight_per_unit;
        // Ensure unit/uom is consistent
        if (!item.uom && !item.unit) {
          item.uom = s.unit || 'Nos';
        }
      }
    }
  };

  await enrichWithDimensions(finalMaterials, 'material_code');
  await enrichWithDimensions(finalComponents, 'item_code');

  return {
    materials: finalMaterials,
    components: finalComponents,
    operations: Array.from(operationMap.values()).flat().sort((a, b) => {
      // 1. Put Sub-Assemblies (SA) BEFORE Finished Goods (FG)
      const typeA = (a.item_type || a.itemType || 'FG').toUpperCase();
      const typeB = (b.item_type || b.itemType || 'FG').toUpperCase();

      const isA_SA = typeA === 'SUB ASSEMBLY' || typeA === 'SA';
      const isB_SA = typeB === 'SUB ASSEMBLY' || typeB === 'SA';

      if (isA_SA && !isB_SA) return -1;
      if (!isA_SA && isB_SA) return 1;

      // 2. Same type? Sort by step number
      return (a.step_no || a.step || 0) - (b.step_no || b.step || 0);
    })
  };
};

const getMaterialRequestItemsForPlan = async (planId) => {
  const [plans] = await pool.query(
    'SELECT * FROM production_plans WHERE id = ?',
    [planId]
  );

  if (plans.length === 0) {
    throw new Error('Production Plan not found');
  }

  const plan = plans[0];
  const planCode = plan.plan_code;
  const aggregatedMap = new Map();

  const addToMap = (itemCode, qty, uom, name, warehouse, category, rate, designQty, currentBalance, isFulfilled, requestExists, dimensions = {}) => {
    if (!itemCode && !name) return;

    const code = (itemCode || name).trim();
    const key = code.toUpperCase();

    // Skip SFG, FG and PART items from material request
    const c = code.toUpperCase();
    const cat = (category || '').toUpperCase();
    if (
      c.startsWith('PART-') || c.startsWith('SA-') || c.startsWith('FG-') || c.startsWith('SFG-') || c.startsWith('ASSEMBLY') ||
      cat.includes('PART') || cat.includes('ASSEMBLY') || cat.includes('SA') || cat.includes('SFG') || cat.includes('FG') || cat.includes('FINISHED')
    ) {
      return;
    }

    const mapItemType = (code, cat) => {
      const materialCategories = ['CORE', 'EXPLODED', 'RAW_MATERIAL', 'COMPONENT'];
      if (materialCategories.includes(String(cat).toUpperCase())) return 'RAW_MATERIAL';

      const c = (code || '').toUpperCase();
      if (c.startsWith('RM-')) return 'RAW_MATERIAL';
      if (c.startsWith('SA-') || c.startsWith('SFG-')) return 'SUB_ASSEMBLY';
      if (c.startsWith('FG-')) return 'FG';

      if (cat === 'FG') return 'FG';
      if (cat === 'SUB_ASSEMBLY') return 'SUB_ASSEMBLY';
      return 'RAW_MATERIAL';
    };

    if (aggregatedMap.has(key)) {
      const existing = aggregatedMap.get(key);
      existing.quantity += Number(qty);
      existing.design_qty = (existing.design_qty || 0) + Number(designQty || 0);
      // Ensure inventory is updated if the new source has a higher value (e.g. from fulfilled MR)
      if (Number(currentBalance) > existing.inventory) {
        existing.inventory = Number(currentBalance);
        existing.is_fulfilled = isFulfilled || existing.is_fulfilled;
        existing.request_exists = requestExists || existing.request_exists;
      }
      if (existing.item_type !== 'RAW_MATERIAL') {
        const newType = mapItemType(code, category);
        if (newType === 'RAW_MATERIAL') existing.item_type = 'RAW_MATERIAL';
      }
      if (rate && !existing.unit_rate) existing.unit_rate = rate;
      // Merge dimensions if not already present
      if (dimensions && Object.keys(dimensions).length > 0 && !existing.dimensions) {
        existing.dimensions = dimensions;
      }
    } else {
      aggregatedMap.set(key, {
        item_code: code,
        quantity: Number(qty),
        design_qty: Number(designQty || 0),
        uom: uom || 'Nos',
        material_name: name || code,
        warehouse: warehouse,
        item_type: mapItemType(code, category),
        unit_rate: rate || 0,
        inventory: Math.max(0, Number(currentBalance || 0)),
        is_fulfilled: !!isFulfilled,
        request_exists: !!requestExists,
        dimensions: dimensions || {}
      });
    }
  };

  // Step 1: Add Materials (ONLY materials should be in Material Request)
  const [materials] = await pool.query(`
    SELECT ppm.*, 
           COALESCE(actual_sb.item_code, ppm.item_code) as actual_item_code,
           COALESCE(actual_sb.valuation_rate, 0) as stock_rate,
           COALESCE(actual_sb.current_balance, 0) as current_balance,
           COALESCE(issued.issued_qty, 0) as issued_qty,
           COALESCE(mr_data.status_rank, 0) as status_rank,
           COALESCE(NULLIF(ppm.length, 0), actual_sb.length, 0) as length, 
           COALESCE(NULLIF(ppm.width, 0), actual_sb.width, 0) as width, 
           COALESCE(NULLIF(ppm.thickness, 0), actual_sb.thickness, 0) as thickness, 
           COALESCE(NULLIF(ppm.diameter, 0), actual_sb.diameter, 0) as diameter, 
           COALESCE(NULLIF(ppm.outer_diameter, 0), actual_sb.outer_diameter, 0) as outer_diameter
    FROM production_plan_materials ppm
    LEFT JOIN (
        SELECT 
            material_name, 
            MAX(item_code) as item_code, 
            MAX(valuation_rate) as valuation_rate, 
            SUM(current_balance) as current_balance,
            MAX(length) as length, 
            MAX(width) as width, 
            MAX(thickness) as thickness, 
            MAX(diameter) as diameter, 
            MAX(outer_diameter) as outer_diameter
        FROM stock_balance 
        GROUP BY material_name
    ) actual_sb ON ppm.material_name = actual_sb.material_name OR ppm.item_code = actual_sb.item_code
    LEFT JOIN (
    SELECT 
        mii.item_code, 
        mii.material_name,
        SUM(mii.quantity) as issued_qty
    FROM material_issue_items mii
    JOIN material_issues mi ON mii.issue_id = mi.id
    JOIN work_orders wo ON mi.work_order_id = wo.id
    WHERE wo.plan_id = ?
    GROUP BY mii.item_code, mii.material_name
) issued 
ON (ppm.item_code = issued.item_code OR ppm.material_name = issued.material_name)
    LEFT JOIN (
        SELECT 
            LOWER(TRIM(mri.item_code)) as join_item_code,
            LOWER(TRIM(mri.item_name)) as join_item_name,
            MAX(CASE mr.status 
                WHEN 'COMPLETED' THEN 5
                WHEN 'FULFILLED' THEN 4
                WHEN 'Fulfilled' THEN 4
                WHEN 'PROCESSING' THEN 3
                WHEN 'Approved ' THEN 2
                WHEN 'DRAFT' THEN 1
                ELSE 0 END) as status_rank
        FROM material_requests mr
        JOIN material_request_items mri ON mr.id = mri.mr_id
        WHERE mr.plan_id = ? OR mr.notes LIKE ?
        GROUP BY join_item_code, join_item_name
    ) mr_data ON (
        (ppm.item_code IS NOT NULL AND LOWER(TRIM(ppm.item_code)) = mr_data.join_item_code) OR 
        (ppm.material_name IS NOT NULL AND LOWER(TRIM(ppm.material_name)) = mr_data.join_item_name)
    )
    WHERE ppm.plan_id = ?
  `, [planId, planId, `%${planCode}%`, planId]);

  for (const mat of materials) {
    const code = (mat.actual_item_code || mat.item_code || '').toUpperCase();
    if (code.startsWith('PART-') || code.startsWith('SA-') || code.startsWith('FG-') || code.startsWith('SFG-') || code.startsWith('ASSEMBLY')) continue;

    // If material request is fulfilled or completed, show full quantity as available
    const isFulfilled = (mat.status_rank || 0) >= 4;
    const requestExists = (mat.status_rank || 0) > 0;
    const effectiveInventory = isFulfilled
      ? Math.max(Number(mat.required_qty), Number(mat.current_balance) + Number(mat.issued_qty))
      : Number(mat.current_balance) + Number(mat.issued_qty);

    addToMap(
      mat.actual_item_code,
      mat.required_qty,
      mat.uom,
      mat.material_name,
      mat.warehouse,
      'RAW_MATERIAL',
      mat.rate || mat.stock_rate || 0,
      mat.design_qty,
      effectiveInventory,
      isFulfilled,
      requestExists,
      {
        length: mat.length,
        width: mat.width,
        thickness: mat.thickness,
        diameter: mat.diameter,
        outer_diameter: mat.outer_diameter
      }
    );
  }

  return {
    plan_code: plan.plan_code,
    start_date: plan.start_date,
    items: Array.from(aggregatedMap.values())
  };
};

const createMaterialRequestFromPlan = async (planId, userId, customItems = null) => {
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

    // 2. Aggregate materials into separate maps based on purpose
    const purchaseMap = new Map();
    const issueMap = new Map();

    const addToPurposeMap = (map, itemCode, qty, uom, name, warehouse, category, rate, designQty) => {
      if (!itemCode && !name || qty <= 0) return;

      const code = (itemCode || name).trim();
      const key = code.toUpperCase();

      // Skip SFG, FG and PART items from material request
      const c = code.toUpperCase();
      const cat = (category || '').toUpperCase();
      if (
        c.startsWith('PART-') || c.startsWith('SA-') || c.startsWith('FG-') || c.startsWith('SFG-') || c.startsWith('ASSEMBLY') ||
        cat.includes('PART') || cat.includes('ASSEMBLY') || cat.includes('SA') || cat.includes('SFG') || cat.includes('FG') || cat.includes('FINISHED')
      ) {
        return;
      }

      if (map.has(key)) {
        const existing = map.get(key);
        existing.quantity += Number(qty);
        existing.design_qty = (existing.design_qty || 0) + Number(designQty || 0);
      } else {
        map.set(key, {
          item_code: code,
          quantity: Number(qty),
          design_qty: Number(designQty || 0),
          uom: uom || 'Nos',
          material_name: name || code,
          warehouse: warehouse || 'Consumables Store',
          item_type: 'RAW_MATERIAL',
          unit_rate: rate || 0
        });
      }
    };

    if (customItems && Array.isArray(customItems)) {
      // Use items provided from frontend
      for (const item of customItems) {
        // Simplified: Request full quantity for everything in a single map
        const code = (item.item_code || item.material_name || '').trim();
        const req = Number(item.quantity || 0);
        const uom = item.uom;
        const name = item.material_name || item.item_name;
        const wh = item.warehouse || 'Consumables Store';
        const rate = item.unit_rate || 0;
        const design = item.design_qty || 0;
        const cat = item.item_type || item.category || 'RAW_MATERIAL';

        addToPurposeMap(purchaseMap, code, req, uom, name, wh, cat, rate, design);
      }
    } else {
      // Automatic logic for non-custom items
      const [materials] = await connection.query(`
        SELECT ppm.*, 
               COALESCE(actual_sb.item_code, ppm.item_code) as actual_item_code,
               COALESCE(actual_sb.valuation_rate, 0) as stock_rate,
               COALESCE(actual_sb.current_balance, 0) as current_balance,
               COALESCE(issued.issued_qty, 0) as issued_qty
        FROM production_plan_materials ppm
        LEFT JOIN (
          SELECT material_name, MAX(item_code) as item_code, MAX(valuation_rate) as valuation_rate, SUM(current_balance) as current_balance
          FROM stock_balance 
          GROUP BY material_name
        ) actual_sb ON ppm.material_name = actual_sb.material_name OR ppm.item_code = actual_sb.item_code
        LEFT JOIN (
          SELECT 
              mii.item_code, 
              mii.material_name,
              SUM(mii.quantity) as issued_qty
          FROM material_issue_items mii
          JOIN material_issues mi ON mii.issue_id = mi.id
          JOIN work_orders wo ON mi.work_order_id = wo.id
          WHERE wo.plan_id = ?
          GROUP BY mii.item_code, mii.material_name
        ) issued ON (ppm.item_code = issued.item_code OR ppm.material_name = issued.material_name)
        WHERE ppm.plan_id = ?
      `, [planId, planId]);

      for (const mat of materials) {
        const effectiveRate = mat.rate || mat.stock_rate || 0;
        const required = Number(mat.required_qty);

        // Simplified: Request full quantity for everything
        addToPurposeMap(purchaseMap, mat.actual_item_code, required, mat.uom, mat.material_name, mat.warehouse, mat.material_category, effectiveRate, mat.design_qty);
      }
    }

    if (purchaseMap.size === 0 && issueMap.size === 0) {
      throw new Error('No materials found to request');
    }

    const createdMRs = [];

    // Helper to create MR header and items
    const createMR = async (itemsMap, purpose) => {
      if (itemsMap.size === 0) return null;

      const items = Array.from(itemsMap.values());

      // Generate MR Number
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

      // Create Material Request Header
      const [mrResult] = await connection.execute(
        `INSERT INTO material_requests (
          mr_number, department, requested_by, required_by, 
          purpose, status, notes, source_warehouse, plan_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          mrNumber,
          'Production',
          userId,
          plan.start_date || new Date(),
          purpose,
          'DRAFT',
          `Generated from Production Plan ${plan.plan_code} (All Materials)`,
          'Consumables Store',
          planId
        ]
      );

      const mrId = mrResult.insertId;

      // Create Material Request Items
      for (const item of items) {
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

      return { id: mrId, mr_number: mrNumber };
    };

    // Use 'Material Issue' as the default purpose so it shows up in Inventory
    const unifiedMR = await createMR(purchaseMap, 'Material Issue');
    if (unifiedMR) createdMRs.push(unifiedMR);

    // issueMap should be empty now based on previous change, but for safety:
    const issueMR = await createMR(issueMap, 'Material Issue');
    if (issueMR) createdMRs.push(issueMR);

    // 7. Update Plan Materials Status
    await connection.execute(
      "UPDATE production_plan_materials SET status = 'SUBMITTED' WHERE plan_id = ?",
      [planId]
    );

    await connection.commit();

    return {
      mrs: createdMRs,
      message: `Created ${createdMRs.length} Material Request(s): ${createdMRs.map(m => m.mr_number).join(', ')}`
    };
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

    // 1. Delete related Job Cards first
    await connection.execute(
      `DELETE FROM job_cards 
       WHERE work_order_id IN (SELECT id FROM work_orders WHERE plan_id = ?)`,
      [id]
    );

    // 2. Delete related Work Orders
    await connection.execute('DELETE FROM work_orders WHERE plan_id = ?', [id]);

    // 3. Delete the Production Plan itself
    // Note: Tables linked with ON DELETE CASCADE (plan_items, materials, etc.) 
    // will be automatically deleted when the plan is deleted.
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
  createMaterialRequestFromPlan,
  getMaterialRequestItemsForPlan
};
