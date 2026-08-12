const pool = require('../config/db');
const bomService = require('./bomService');

const listProductionPlans = async () => {
  const [rows] = await pool.query(
    `SELECT pp.*, u.username as creator_name, 
            COALESCE(o.order_no, so.so_number, 'Direct Order') as order_no, 
            COALESCE(o.project_name, so.project_name, '—') as project_name,
            COALESCE(c_ord.company_name, c_so.company_name, '—') as company_name,
            COALESCE(o.project_name, so.project_name, '—') as so_project_name,
            COALESCE(o.project_name, so.project_name, '—') as o_project_name,
            COALESCE(o.project_name, so.project_name, '—') as o_direct_project_name,
            COALESCE(
              cd_bom.drawing_no,
              oi.drawing_no,
              soi.drawing_no,
              CASE WHEN pp.bom_no NOT REGEXP '^[0-9]+$' THEN pp.bom_no ELSE NULL END
            ) as drawing_no,
            COALESCE(ppi.item_code, oi.item_code, soi.item_code) as item_code, 
            COALESCE(ppi.description,
              cd_bom.description,
              oi.description,
              soi.description
            ) as item_description,
            (SELECT COUNT(*) FROM work_orders WHERE plan_id = pp.id) as wo_count,
            (SELECT COUNT(*) FROM job_cards jc JOIN work_orders wo ON jc.work_order_id = wo.id WHERE wo.plan_id = pp.id) as total_ops,
            (SELECT COUNT(*) FROM job_cards jc JOIN work_orders wo ON jc.work_order_id = wo.id WHERE wo.plan_id = pp.id AND jc.status = 'COMPLETED') as completed_ops,
            (SELECT status FROM material_requests WHERE plan_id = pp.id ORDER BY id DESC LIMIT 1) as mr_status,
            (SELECT id FROM material_requests WHERE plan_id = pp.id ORDER BY id DESC LIMIT 1) as mr_id
     FROM production_plans pp
     LEFT JOIN users u ON pp.created_by = u.id
     LEFT JOIN (
       SELECT plan_id, item_code, description, sales_order_item_id, sales_order_id
       FROM production_plan_items 
       WHERE id IN (SELECT MIN(id) FROM production_plan_items GROUP BY plan_id)
     ) ppi ON pp.id = ppi.plan_id
     LEFT JOIN orders o ON pp.sales_order_id = o.id
     LEFT JOIN companies c_ord ON o.client_id = c_ord.id
     LEFT JOIN sales_orders so ON pp.sales_order_id = so.id
     LEFT JOIN companies c_so ON so.company_id = c_so.id
     LEFT JOIN order_items oi ON ppi.sales_order_item_id = oi.id AND ppi.sales_order_id = oi.order_id
     LEFT JOIN sales_order_items soi ON ppi.sales_order_item_id = soi.id AND ppi.sales_order_id = soi.sales_order_id
     LEFT JOIN customer_drawings cd_bom ON (
       (pp.bom_no REGEXP '^[0-9]+$' AND cd_bom.id = CAST(pp.bom_no AS UNSIGNED)) OR
       (cd_bom.drawing_no = pp.bom_no)
     )
     ORDER BY pp.created_at DESC`
  );

  const enrichedRows = rows.map(row => {
    const candidates = [
      row.so_project_name,
      row.o_project_name,
      row.o_direct_project_name
    ].filter(Boolean).map(s => s.trim());

    // Find Project ID (starts with PRO-)
    const projectId = candidates.find(c => c.toUpperCase().startsWith('PRO-')) || null;

    // Find Project Name (does not start with PRO- and is distinct from projectId)
    const projectName = candidates.find(c => !c.toUpperCase().startsWith('PRO-') && c !== projectId) || null;

    return {
      ...row,
      project_id: projectId,
      project_name: projectName || row.project_name
    };
  });

  return enrichedRows;
};

const getProductionPlanById = async (id) => {
  const [plans] = await pool.query(
    `SELECT pp.*, u.username as creator_name,
            COALESCE(o.order_no, so.so_number, 'Direct Order') as order_no,
            COALESCE(c_ord.company_name, c_so.company_name, '—') as company_name,
            COALESCE(ppi_first.item_code) as item_code,
            COALESCE(ppi_first.description) as item_description,
            (SELECT status FROM material_requests WHERE plan_id = pp.id ORDER BY id DESC LIMIT 1) as mr_status,
            (SELECT id FROM material_requests WHERE plan_id = pp.id ORDER BY id DESC LIMIT 1) as mr_id
     FROM production_plans pp
     LEFT JOIN users u ON pp.created_by = u.id
     LEFT JOIN (
       SELECT plan_id, item_code, description, sales_order_item_id, sales_order_id
       FROM production_plan_items 
       WHERE id IN (SELECT MIN(id) FROM production_plan_items GROUP BY plan_id)
     ) ppi_first ON pp.id = ppi_first.plan_id
     LEFT JOIN orders o ON pp.sales_order_id = o.id
     LEFT JOIN companies c_ord ON o.client_id = c_ord.id
     LEFT JOIN sales_orders so ON pp.sales_order_id = so.id
     LEFT JOIN companies c_so ON so.company_id = c_so.id
     WHERE pp.id = ?`,
    [id]
  );

  if (plans.length === 0) return null;

  const plan = plans[0];

  const [items] = await pool.query(
    `SELECT ppi.*, 
            COALESCE(o.project_name, so.project_name, '—') as project_name, 
            COALESCE(ppi.item_code, oi.item_code, soi.item_code) as item_code, 
            COALESCE(ppi.description, oi.description, soi.description) as description, 
            COALESCE(oi.drawing_no, soi.drawing_no) as drawing_no, 
            COALESCE(ppi.design_qty, oi.quantity, soi.quantity) as design_qty, 
            COALESCE(ppi.uom, soi.unit, 'Nos') as uom,
            COALESCE(o.order_no, so.so_number, 'Direct Order') as order_no
     FROM production_plan_items ppi
     LEFT JOIN orders o ON ppi.sales_order_id = o.id
     LEFT JOIN sales_orders so ON ppi.sales_order_id = so.id
     LEFT JOIN order_items oi ON ppi.sales_order_item_id = oi.id AND ppi.sales_order_id = oi.order_id
     LEFT JOIN sales_order_items soi ON ppi.sales_order_item_id = soi.id AND ppi.sales_order_id = soi.sales_order_id
     LEFT JOIN workstations w ON ppi.workstation_id = w.id
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
    `SELECT ppm.*, MAX(s.name) as shape_type
     FROM production_plan_materials ppm
     LEFT JOIN sales_order_item_materials som ON (
          LOWER(TRIM(REPLACE(ppm.material_name, '\t', ''))) = LOWER(TRIM(REPLACE(som.material_name, '\t', '')))
         AND ABS(COALESCE(ppm.length, 0) - COALESCE(som.length, 0)) < 0.0001
         AND ABS(COALESCE(ppm.width, 0) - COALESCE(som.width, 0)) < 0.0001
         AND ABS(COALESCE(ppm.thickness, 0) - COALESCE(som.thickness, 0)) < 0.0001
         AND ABS(COALESCE(ppm.diameter, 0) - COALESCE(som.diameter, 0)) < 0.0001
         AND ABS(COALESCE(ppm.outer_diameter, 0) - COALESCE(som.outer_diameter, 0)) < 0.0001
     )
     LEFT JOIN shapes s ON som.shape_id = s.id
     WHERE ppm.plan_id = ?
     GROUP BY ppm.id`,
    [id]
  );
  plan.materials = materials.map(m => {
    let shapeType = m.shape_type || '';
    if (m.bom_ref && m.bom_ref.startsWith('MANUAL:')) {
      shapeType = m.bom_ref.substring(7);
    }
    return {
      ...m,
      shape_type: shapeType,
      shape_name: shapeType,
      shape: shapeType,
      dimensions: {
        length: m.length,
        width: m.width,
        thickness: m.thickness,
        diameter: m.diameter,
        outer_diameter: m.outer_diameter
      }
    };
  });

  // 5. Fetch Operations — always load LIVE from BOM (sales_order_item_operations) so that
  //    any BOM Process Routing update is immediately reflected in Configure Work Order.
  //    Fallback to stored production_plan_operations if no BOM operations exist.

  let operations = [];

  // Collect all unique plan items to fetch live BOM operations.
  // Key insight: production_plan_items.sales_order_item_id references order_items (not sales_order_items).
  // The BOM operations live in sales_order_item_operations keyed to sales_order_items.id.
  // We look up by drawing_no: order_items.drawing_no → sales_order_items (latest with that drawing_no).
  // Put sub-assemblies (parts) first so part operations precede FG assembly operations
  const allPlanItems = [...(subAssemblies || []), ...items];
  const seenDrawingKeys = new Set();
  const seenOpIds = new Set(); // dedup only by row ID — allows same-named ops (e.g., 2x Cutting)
  const bomOpsList = [];

  for (const planItem of allPlanItems) {
    const soiId = planItem.sales_order_item_id;
    const itemCode = planItem.item_code;
    const bomNo = planItem.bom_no;

    const dedupeKey = soiId || bomNo || itemCode;
    if (!dedupeKey || seenDrawingKeys.has(dedupeKey)) continue;
    seenDrawingKeys.add(dedupeKey);

    // Step 1: get drawing_no from order_items using soiId
    let drawingNo = null;
    if (soiId) {
      const [orderItem] = await pool.query(
        `SELECT drawing_no FROM order_items WHERE id = ? LIMIT 1`,
        [soiId]
      );
      if (orderItem.length > 0 && orderItem[0].drawing_no) {
        drawingNo = orderItem[0].drawing_no;
      }
    }
    if (!drawingNo) drawingNo = itemCode;

    // Step 2: find the latest sales_order_item matching bom_no, soiId, drawing_no, or item_code
    let latestSoiId = null;
    if (bomNo && !isNaN(bomNo)) {
      const [byBomId] = await pool.query(`SELECT id FROM sales_order_items WHERE id = ? LIMIT 1`, [bomNo]);
      if (byBomId.length > 0) latestSoiId = byBomId[0].id;
    }
    if (!latestSoiId && soiId) {
      const [bySoiId] = await pool.query(`SELECT id FROM sales_order_items WHERE id = ? LIMIT 1`, [soiId]);
      if (bySoiId.length > 0) latestSoiId = bySoiId[0].id;
    }
    if (!latestSoiId) {
      const searchTerms = [bomNo, drawingNo, itemCode].filter(Boolean);
      if (searchTerms.length > 0) {
        const [bySearch] = await pool.query(
          `SELECT id FROM sales_order_items 
           WHERE TRIM(drawing_no) IN (?) OR TRIM(item_code) IN (?) 
           ORDER BY id DESC LIMIT 1`,
          [searchTerms, searchTerms]
        );
        if (bySearch.length > 0) latestSoiId = bySearch[0].id;
      }
    }

    if (!latestSoiId) continue;

    // Step 3: fetch all operations for that latest BOM item
    const [bomOps] = await pool.query(
      `SELECT soio.*, 
              COALESCE(om.hourly_rate, soio.hourly_rate, 0) as hourly_rate
       FROM sales_order_item_operations soio
       LEFT JOIN operations om ON LOWER(TRIM(om.operation_name)) = LOWER(TRIM(soio.operation_name))
       WHERE soio.sales_order_item_id = ?
       ORDER BY soio.created_at ASC`,
      [latestSoiId]
    );

    for (const op of bomOps) {
      if (seenOpIds.has(op.id)) continue;
      seenOpIds.add(op.id);
      bomOpsList.push({
        id: op.id,
        plan_id: id,
        step_no: bomOpsList.length + 1,
        operation_name: op.operation_name,
        workstation: op.workstation || null,
        process_type: op.operation_type || 'In-House',
        operation_type: op.operation_type || 'In-House',
        cycle_time_min: op.cycle_time_min || 0,
        setup_time_min: op.setup_time_min || 0,
        hourly_rate: op.hourly_rate || 0,
        base_time: op.base_time || 0,
        net_time: op.net_time || 0,
        source_item: planItem.item_code || op.item_code || op.drawing_no || null,
        item_type: planItem.source_type === 'SA' || (bomNo && bomNo !== plan.bom_no) ? 'SA' : (op.item_type || 'FG')
      });
    }
  }

  if (bomOpsList.length > 0) {
    // Use live BOM operations (step_no already indexed during push)
    operations = bomOpsList;
  } else {
    // Fallback: use stored production_plan_operations when no BOM operations found
    const [storedOps] = await pool.query(
      `SELECT ppo.*, COALESCE(om.hourly_rate, 0) as hourly_rate
       FROM production_plan_operations ppo
       LEFT JOIN operations om ON LOWER(TRIM(om.operation_name)) = LOWER(TRIM(ppo.operation_name))
       WHERE ppo.plan_id = ? 
       ORDER BY 
         CASE 
           WHEN UPPER(ppo.item_type) = 'SUB ASSEMBLY' OR UPPER(ppo.item_type) = 'SA' THEN 0 
           ELSE 1 
         END ASC, 
         ppo.step_no ASC`,
      [id]
    );
    operations = storedOps;
  }

  // Always append Shipment as the last operation if not already present
  const hasShipment = operations.some(op => {
    const name = String(op.operation_name || '').toLowerCase();
    return name === 'shipment' || name === 'dispatch';
  });
  if (!hasShipment) {
    operations.push({
      id: 999999,
      plan_id: id,
      step_no: operations.length + 1,
      operation_name: 'Shipment',
      workstation: 'Dispatch',
      process_type: 'In-House',
      operation_type: 'In-House',
      cycle_time_min: 0,
      setup_time_min: 0,
      hourly_rate: 0,
      base_time: 0,
      net_time: 0,
      source_item: 'Main Item'
    });
  }

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

    if (finalSalesOrderId && finalBomNo) {
      // Find all related sales order IDs (both design and execution orders)
      const [relatedIdsRows] = await connection.query(
        `SELECT DISTINCT id FROM (
          SELECT ? as id
          UNION
          SELECT so.id FROM sales_orders so
          JOIN orders o ON (
            (o.source_type = 'DRAWING' AND o.quotation_id = so.id) OR
            (o.source_type = 'DIRECT' AND o.quotation_id = so.customer_po_id)
          )
          WHERE o.id = ?
          UNION
          SELECT o.id FROM orders o
          JOIN sales_orders so ON (
            (o.source_type = 'DRAWING' AND o.quotation_id = so.id) OR
            (o.source_type = 'DIRECT' AND o.quotation_id = so.customer_po_id)
          )
          WHERE so.id = ?
        ) as tmp WHERE id IS NOT NULL`,
        [finalSalesOrderId, finalSalesOrderId, finalSalesOrderId]
      );
      const relatedIds = relatedIdsRows.map(r => r.id);

      if (relatedIds.length > 0) {
        const [existing] = await connection.query(
          'SELECT id FROM production_plans WHERE sales_order_id IN (?) AND TRIM(LOWER(bom_no)) = TRIM(LOWER(?))',
          [relatedIds, finalBomNo]
        );
        if (existing.length > 0) {
          throw new Error('Production Plan already exists for the selected Sales Order and Drawing. Duplicate Production Plans are not allowed.');
        }
      }
    }

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
      LEFT JOIN sales_order_items soi ON (
        TRIM(oi.drawing_no) = TRIM(soi.drawing_no) 
        AND soi.sales_order_id = (
          SELECT DISTINCT so.id FROM sales_orders so
          JOIN orders ord ON (
            (ord.source_type = 'DRAWING' AND ord.quotation_id = so.id) OR
            (ord.source_type = 'DIRECT' AND ord.quotation_id = so.customer_po_id)
          )
          WHERE ord.id = oi.order_id
          LIMIT 1
        )
      )
      LEFT JOIN (
        SELECT sales_order_item_id, SUM(planned_qty) as already_planned_qty
        FROM production_plan_items 
        WHERE status != 'CANCELLED'
        GROUP BY sales_order_item_id
      ) planned ON oi.id = planned.sales_order_item_id
      WHERE (
        (SELECT DISTINCT so.id FROM sales_orders so
         JOIN orders ord ON (
           (ord.source_type = 'DRAWING' AND ord.quotation_id = so.id) OR
           (ord.source_type = 'DIRECT' AND ord.quotation_id = so.customer_po_id)
         )
         WHERE ord.id = oi.order_id
         LIMIT 1
        ) IS NULL
      )
      AND (TRIM(UPPER(oi.type)) IN ('FG', 'FINISHED GOODS', 'FINISHED_GOODS', 'ASSEMBLY', 'PART', 'STANDARD') OR oi.drawing_no IS NOT NULL)
      AND (soi.parent_bom_id IS NULL OR soi.id IS NULL)
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
              COALESCE(o.project_name, so.project_name, c.company_name, '') as project_name, 
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
         o.order_no LIKE 'ORD%'
         -- 1. Has at least one FG/Assembly/Part item
         AND (EXISTS (
           SELECT 1 FROM order_items oi 
           WHERE oi.order_id = o.id 
           AND (TRIM(UPPER(oi.type)) IN ('FG', 'FINISHED GOODS', 'FINISHED_GOODS', 'ASSEMBLY', 'PART', 'STANDARD') OR oi.drawing_no IS NOT NULL)
         ) OR EXISTS (
           SELECT 1 FROM sales_order_items soi 
           WHERE soi.sales_order_id = so.id 
           AND (TRIM(UPPER(soi.item_type)) IN ('FG', 'FINISHED GOODS', 'FINISHED_GOODS', 'ASSEMBLY', 'PART') OR soi.drawing_no IS NOT NULL)
         ))
         -- 2. Exclude rejected or cancelled sales orders
         AND (o.quotation_id IS NULL OR so.status IS NULL OR so.status NOT IN ('REJECTED', 'CANCELLED'))
         -- 3. Must have at least one BOM record with cost > 0
         AND EXISTS (
           SELECT 1 FROM order_items oi
           JOIN sales_order_items soi ON TRIM(soi.drawing_no) = TRIM(oi.drawing_no)
           WHERE oi.order_id = o.id
             AND soi.bom_cost > 0
         )
         -- 4. Exclude if any required drawing has no completed BOM
         AND NOT EXISTS (
           SELECT 1 FROM order_items oi
           WHERE oi.order_id = o.id
             AND (TRIM(UPPER(oi.type)) IN ('FG', 'FINISHED GOODS', 'FINISHED_GOODS', 'ASSEMBLY', 'PART', 'STANDARD') OR oi.drawing_no IS NOT NULL)
             AND (oi.item_code IS NULL OR (oi.item_code != 'XXX' AND oi.item_code NOT LIKE '%XXX%' AND oi.item_code NOT LIKE '%NO CODE%'))
             AND NOT EXISTS (
               SELECT 1 FROM sales_order_items soi
               WHERE TRIM(soi.drawing_no) = TRIM(oi.drawing_no)
                 AND soi.bom_cost > 0
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
           AND (
             soi.sales_order_id = (
               SELECT DISTINCT so.id FROM sales_orders so
               JOIN orders o ON (
                 (o.source_type = 'DRAWING' AND o.quotation_id = so.id) OR
                 (o.source_type = 'DIRECT' AND o.quotation_id = so.customer_po_id)
               )
               WHERE o.id = oi.order_id
               LIMIT 1
             )
             OR (
               (SELECT DISTINCT so.id FROM sales_orders so
                JOIN orders o ON (
                  (o.source_type = 'DRAWING' AND o.quotation_id = so.id) OR
                  (o.source_type = 'DIRECT' AND o.quotation_id = so.customer_po_id)
                )
                WHERE o.id = oi.order_id
                LIMIT 1
               ) IS NULL
               AND soi.bom_cost > 0
             )
           )
         )
          LEFT JOIN (
            SELECT sales_order_id, TRIM(item_code) as item_code, SUM(planned_qty) as already_planned_qty
            FROM production_plan_items 
            WHERE status != 'CANCELLED'
            GROUP BY sales_order_id, TRIM(item_code)
          ) planned ON (
            (planned.sales_order_id = oi.order_id OR (soi.sales_order_id IS NOT NULL AND planned.sales_order_id = soi.sales_order_id))
            AND TRIM(planned.item_code) = TRIM(oi.item_code)
          )
         WHERE oi.order_id = ? 
         AND (TRIM(UPPER(oi.type)) IN ('FG', 'FINISHED GOODS', 'FINISHED_GOODS', 'ASSEMBLY', 'PART', 'STANDARD') OR oi.drawing_no IS NOT NULL)
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

  const globalItemCache = new Map();

  let salesOrderId = item.sales_order_id || null;
  if (!salesOrderId && item.order_id) {
    const [ord] = await pool.query(
      `SELECT DISTINCT so.id FROM sales_orders so
       JOIN orders o ON (
         (o.source_type = 'DRAWING' AND o.quotation_id = so.id) OR
         (o.source_type = 'DIRECT' AND o.quotation_id = so.customer_po_id)
       )
       WHERE o.id = ? LIMIT 1`,
      [item.order_id]
    );
    if (ord.length > 0) salesOrderId = ord[0].id;
  }

  let allSoMaterials = [];
  let allSoComponents = [];
  let allSoOperations = [];
  let allSoItems = [];

  if (salesOrderId) {
    [allSoMaterials] = await pool.query(
      `SELECT m.*, s.name as shape_type, s.name as shape_name, s.name as shape,
              i.item_code as actual_item_code
       FROM sales_order_item_materials m
       LEFT JOIN shapes s ON m.shape_id = s.id
       LEFT JOIN (
         SELECT material_name, MIN(item_code) as item_code,
                MAX(length) as length, MAX(width) as width, MAX(thickness) as thickness,
                MAX(diameter) as diameter, MAX(outer_diameter) as outer_diameter
         FROM stock_balance 
         GROUP BY material_name, length, width, thickness, diameter, outer_diameter
       ) i ON LOWER(TRIM(m.material_name)) = LOWER(TRIM(i.material_name))
         AND (ABS(COALESCE(i.length, 0) - COALESCE(m.length, 0)) < 0.0001)
         AND (ABS(COALESCE(i.width, 0) - COALESCE(m.width, 0)) < 0.0001)
         AND (ABS(COALESCE(i.thickness, 0) - COALESCE(m.thickness, 0)) < 0.0001)
         AND (ABS(COALESCE(i.diameter, 0) - COALESCE(m.diameter, 0)) < 0.0001)
         AND (ABS(COALESCE(i.outer_diameter, 0) - COALESCE(m.outer_diameter, 0)) < 0.0001)
       WHERE m.sales_order_item_id IN (SELECT id FROM sales_order_items WHERE sales_order_id = ?)`,
      [salesOrderId]
    );

    [allSoComponents] = await pool.query(
      `SELECT * FROM sales_order_item_components 
       WHERE sales_order_item_id IN (SELECT id FROM sales_order_items WHERE sales_order_id = ?)`,
      [salesOrderId]
    );

    [allSoOperations] = await pool.query(
      `SELECT * FROM sales_order_item_operations 
       WHERE sales_order_item_id IN (SELECT id FROM sales_order_items WHERE sales_order_id = ?)`,
      [salesOrderId]
    );

    [allSoItems] = await pool.query(
      'SELECT id, item_code, description, drawing_no, item_type, item_group FROM sales_order_items WHERE sales_order_id = ?',
      [salesOrderId]
    );
  }

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

      const hasPrefetched = allSoItems.some(x => targetSoIds.includes(x.id));

      if (hasPrefetched && allSoMaterials.length > 0) {
        materials = allSoMaterials.filter(m => targetSoIds.includes(m.sales_order_item_id) && m.parent_id === parentId);
      } else {
        const [soM] = await pool.query(`
          SELECT m.*, s.name as shape_type, s.name as shape_name, s.name as shape,
                 i.item_code as actual_item_code
          FROM sales_order_item_materials m
          LEFT JOIN shapes s ON m.shape_id = s.id
          LEFT JOIN (
            SELECT material_name, MIN(item_code) as item_code,
                   MAX(length) as length, MAX(width) as width, MAX(thickness) as thickness,
                   MAX(diameter) as diameter, MAX(outer_diameter) as outer_diameter
            FROM stock_balance 
            GROUP BY material_name, length, width, thickness, diameter, outer_diameter
          ) i ON LOWER(TRIM(m.material_name)) = LOWER(TRIM(i.material_name))
            AND (ABS(COALESCE(i.length, 0) - COALESCE(m.length, 0)) < 0.0001)
            AND (ABS(COALESCE(i.width, 0) - COALESCE(m.width, 0)) < 0.0001)
            AND (ABS(COALESCE(i.thickness, 0) - COALESCE(m.thickness, 0)) < 0.0001)
            AND (ABS(COALESCE(i.diameter, 0) - COALESCE(m.diameter, 0)) < 0.0001)
            AND (ABS(COALESCE(i.outer_diameter, 0) - COALESCE(m.outer_diameter, 0)) < 0.0001)
          WHERE m.sales_order_item_id IN (?) AND m.parent_id <=> ?
        `, [targetSoIds, parentId]);
        materials = soM;
      }

      if (hasPrefetched && allSoComponents.length > 0) {
        const matchingComps = allSoComponents.filter(c => targetSoIds.includes(c.sales_order_item_id) && c.parent_id === parentId);
        const uniqueComps = new Map();
        matchingComps.forEach(c => {
          const key = `${c.component_code}-${c.drawing_no || ''}`;
          if (!uniqueComps.has(key)) {
            const soi = allSoItems.find(x => x.item_code === c.component_code);
            const item_type = soi ? soi.item_type : null;
            const item_group = soi ? soi.item_group : null;
            const drawing_no = soi ? soi.drawing_no : null;
            uniqueComps.set(key, {
              ...c,
              item_type: (item_type === 'SA' || item_type === 'SFG' || item_group === 'Sub Assembly' || item_group === 'SUB_ASSEMBLY' || item_group === 'SFG' || (c.component_code && (c.component_code.startsWith('SA-') || c.component_code.startsWith('SFG-')))) ? 'Sub Assembly' : (item_type || 'FG'),
              item_group,
              drawing_no
            });
          }
        });
        components = Array.from(uniqueComps.values());
      } else {
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

        const uniqueComps = new Map();
        soC.forEach(c => {
          const key = `${c.component_code}-${c.drawing_no || ''}`;
          if (!uniqueComps.has(key)) uniqueComps.set(key, c);
        });

        components = Array.from(uniqueComps.values()).map(c => ({
          ...c,
          item_type: (c.item_type === 'SA' || c.item_type === 'SFG' || c.item_group === 'Sub Assembly' || c.item_group === 'SUB_ASSEMBLY' || c.item_group === 'SFG' || (c.component_code && (c.component_code.startsWith('SA-') || c.component_code.startsWith('SFG-')))) ? 'Sub Assembly' : (c.item_type || 'FG')
        }));
      }

      if (hasPrefetched && allSoOperations.length > 0) {
        operations = allSoOperations.filter(o => 
          targetSoIds.includes(o.sales_order_item_id) && 
          (
            (o.item_code && o.item_code.trim().toUpperCase() === itemCode.trim().toUpperCase()) ||
            (o.drawing_no && drawingNo && o.drawing_no.trim().toUpperCase() === drawingNo.trim().toUpperCase())
          )
        );
      } else {
        const [soO] = await pool.query(`
          SELECT * FROM sales_order_item_operations 
          WHERE sales_order_item_id IN (?) 
          AND (
            TRIM(UPPER(item_code)) = TRIM(UPPER(?)) 
            OR (TRIM(UPPER(drawing_no)) = TRIM(UPPER(?)) AND drawing_no IS NOT NULL)
          )`, [targetSoIds, itemCode, drawingNo]);
        operations = soO;
      }
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
          const [gM] = await pool.query(`
            SELECT m.*, s.name as shape_type, s.name as shape_name, s.name as shape,
                   i.item_code as actual_item_code
            FROM sales_order_item_materials m
            LEFT JOIN shapes s ON m.shape_id = s.id
            LEFT JOIN (
              SELECT material_name, MIN(item_code) as item_code,
                     MAX(length) as length, MAX(width) as width, MAX(thickness) as thickness,
                     MAX(diameter) as diameter, MAX(outer_diameter) as outer_diameter
              FROM stock_balance 
              GROUP BY material_name, length, width, thickness, diameter, outer_diameter
            ) i ON LOWER(TRIM(m.material_name)) = LOWER(TRIM(i.material_name))
              AND (ABS(COALESCE(i.length, 0) - COALESCE(m.length, 0)) < 0.0001)
              AND (ABS(COALESCE(i.width, 0) - COALESCE(m.width, 0)) < 0.0001)
              AND (ABS(COALESCE(i.thickness, 0) - COALESCE(m.thickness, 0)) < 0.0001)
              AND (ABS(COALESCE(i.diameter, 0) - COALESCE(m.diameter, 0)) < 0.0001)
              AND (ABS(COALESCE(i.outer_diameter, 0) - COALESCE(m.outer_diameter, 0)) < 0.0001)
            WHERE m.sales_order_item_id = ? AND m.parent_id IS NULL
          `, [gId]);
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
      const material_category = 'CORE';
      const source_assembly = depth === 0 ? null : itemCode;

      const calculateWeightFromDimensions = (item) => {
        let weightVal = (item.weight_per_unit && parseFloat(item.weight_per_unit) > 0) ? parseFloat(item.weight_per_unit) : 0;
        if (weightVal === 0) {
          const len = parseFloat(item.length || 0);
          const wid = parseFloat(item.width || 0);
          const thk = parseFloat(item.thickness || 0);
          const dia = parseFloat(item.diameter || 0);
          const od = parseFloat(item.outer_diameter || 0);
          const density = parseFloat(item.density || 7.85);
          const shapeStr = String(item.shape_type || item.shape_name || item.shape || item.material_name || '').trim().toLowerCase();

          if (shapeStr.includes('threaded') || shapeStr.includes('thread')) {
            const dVal = dia > 0 ? dia : od;
            const pVal = parseFloat(item.thread_pitch || item.threadPitch || 0);
            if (dVal > 0 && pVal > 0 && pVal < dVal && len > 0) {
              const tensileArea = 0.7854 * Math.pow(dVal - (0.9382 * pVal), 2);
              weightVal = (tensileArea * len * density) / 1000000;
            }
          } else if (len > 0 && wid > 0 && thk > 0) {
            weightVal = (len * wid * thk * density) / 1000000;
          } else if (len > 0 && dia > 0) {
            weightVal = (Math.PI * Math.pow(dia, 2) / 4 * len * density) / 1000000;
          }
        }
        return weightVal;
      };

      const weight = calculateWeightFromDimensions(m);
      const scrapFactor = (m.scrap_percent && parseFloat(m.scrap_percent) > 0) ? (1 + parseFloat(m.scrap_percent) / 100) : 1;
      const total_wt = weight * scrapFactor;

      const itemGroup = (m.item_group || '').toUpperCase().replace(/_/g, ' ');
      const uom = (m.uom || '').toUpperCase();
      const isKgMaterial = (itemGroup.includes('RAW MATERIAL') || itemGroup.includes('CONSUMABLE')) && uom === 'KG';

      const baseQtyPerFG = isKgMaterial ? ((parseFloat(m.qty_per_pc) || 1) * total_wt) : (parseFloat(m.qty_per_pc) || 1);

      const matName = m.description || m.material_name || m.name || m.item || 'Unknown Material';
      const matCode = m.actual_item_code || m.material_code || m.item_code || m.itemCode || '';
      const len = Number(m.length) || 0;
      const wid = Number(m.width) || 0;
      const thk = Number(m.thickness) || 0;
      const dia = Number(m.diameter) || 0;
      const od = Number(m.outer_diameter) || 0;
      const mKey = `${matName}-${matCode}-${len}-${wid}-${thk}-${dia}-${od}`;

      const existing = materialMap.get(mKey);
      const reqQty = baseQtyPerFG * qtyMultiplier;

      if (existing) {
        existing.required_qty += reqQty;
        existing.totalRequiredQty += reqQty;
        
        // Merge BOM reference
        const newRef = m.bom_no || m.bom_ref || drawingNo;
        if (newRef && existing.bom_ref && !existing.bom_ref.includes(newRef)) {
          existing.bom_ref = `${existing.bom_ref}, ${newRef}`;
        }
        
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
      let compDrawing = comp.drawing_no;
      const compQty = parseFloat(comp.quantity || 0);
      const totalCompQty = compQty * qtyMultiplier;

      const cKey = `${compCode}-${compDrawing || ''}`;

      let nextSoItemId = null;
      let nextParentId = null;

      if (soItemId) {
        const targetIds = Array.isArray(soItemId) ? soItemId : [soItemId];
        let found = [];
        const hasPrefetched = allSoItems.some(x => targetIds.includes(x.id));

        if (hasPrefetched && allSoItems.length > 0) {
          const match = allSoItems.find(x => x.item_code === compCode);
          if (match) found = [match];
        } else {
          const [dbFound] = await pool.query(
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
          found = dbFound;
        }

        if (found.length > 0) {
          nextSoItemId = found[0].id;
          nextParentId = null;
        } else {
          // Fallback: Search by normalized description / code in the same sales order context
          let soItems = [];
          if (hasPrefetched && allSoItems.length > 0) {
            soItems = allSoItems;
          } else {
            [soItems] = await pool.query(
              `SELECT id, item_code, description, drawing_no, item_type, item_group FROM sales_order_items 
               WHERE sales_order_id IN (
                 SELECT id FROM sales_orders 
                 WHERE id IN (SELECT sales_order_id FROM sales_order_items WHERE id IN (?))
                 OR (customer_po_id IS NOT NULL AND customer_po_id IN (
                   SELECT customer_po_id FROM sales_orders 
                   WHERE id IN (SELECT sales_order_id FROM sales_order_items WHERE id IN (?))
                 ))
               )`,
              [targetIds, targetIds]
            );
          }

          const normalize = (str) => {
            if (!str) return '';
            return str.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');
          };

          const compDescNorm = normalize(comp.description);
          const compCodeNorm = normalize(compCode);

          let fallbackMatch = null;
          for (const soi of soItems) {
            const soiDescNorm = normalize(soi.description);
            const soiCodeNorm = normalize(soi.item_code);

            if (
              (compDescNorm && soiDescNorm && compDescNorm === soiDescNorm) ||
              (compCodeNorm && soiCodeNorm && compCodeNorm === soiCodeNorm)
            ) {
              fallbackMatch = soi;
              break;
            }
          }

          if (fallbackMatch) {
            nextSoItemId = fallbackMatch.id;
            nextParentId = null;
          } else {
            // Fallback 2: Cached Global Lookup across all Sales Order items in the database
            let globalMatchId = globalItemCache.get(compCode);
            if (!globalMatchId) {
              const [dbGlobalMatch] = await pool.query(
                `SELECT id FROM sales_order_items 
                 WHERE (item_code = ? OR (drawing_no = ? AND drawing_no IS NOT NULL))
                 ORDER BY id DESC LIMIT 1`,
                [compCode, compDrawing]
              );
              if (dbGlobalMatch.length > 0) {
                globalMatchId = dbGlobalMatch[0].id;
                globalItemCache.set(compCode, globalMatchId);
              }
            }

            if (globalMatchId) {
              nextSoItemId = globalMatchId;
              nextParentId = null;
            } else {
              nextSoItemId = soItemId;
              nextParentId = comp.id;
            }
          }
        }
      }

      if (nextSoItemId) {
        let details = null;
        if (allSoItems.length > 0) {
          details = allSoItems.find(x => x.id === nextSoItemId);
        } else {
          const [soiDetails] = await pool.query(
            'SELECT item_type, item_group, drawing_no FROM sales_order_items WHERE id = ?',
            [nextSoItemId]
          );
          if (soiDetails.length > 0) details = soiDetails[0];
        }

        if (details) {
          comp.item_type = details.item_type;
          comp.item_group = details.item_group;
          comp.drawing_no = details.drawing_no;
          compDrawing = details.drawing_no;
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

      const isBoughtOut = 
        (comp.item_group && (comp.item_group.toUpperCase().includes('BOUGHT') || comp.item_group.toUpperCase().includes('CONSUMABLE'))) ||
        (compCode && (compCode.toUpperCase().startsWith('BO-') || compCode.toUpperCase().startsWith('BO_') || compCode.toUpperCase().startsWith('CONS-') || compCode.toUpperCase().startsWith('BO:')));

      if (isBoughtOut) {
        const matName = comp.description || comp.component_code || 'Unknown BO Item';
        const matCode = compCode;
        const len = Number(comp.length) || 0;
        const wid = Number(comp.width) || 0;
        const thk = Number(comp.thickness) || 0;
        const dia = Number(comp.diameter) || 0;
        const od = Number(comp.outer_diameter) || 0;
        const mKey = `${matName}-${matCode}-${len}-${wid}-${thk}-${dia}-${od}`;

        const material_category = 'CORE';
        const source_assembly = depth === 0 ? null : itemCode;

        // For Bought Out items, quantity is unit-based (not calculated via dimensions/weight)
        const baseQtyPerFG = parseFloat(comp.quantity || 0) || 1;
        const reqQty = baseQtyPerFG * qtyMultiplier;

        // Rate lookup for Bought Out item if rate is 0
        let boRate = parseFloat(comp.rate || comp.valuation_rate || comp.latest_valuation_rate) || 0;
        if (boRate === 0 && matCode) {
          const [sbRow] = await pool.query(
            'SELECT valuation_rate FROM stock_balance WHERE item_code = ? LIMIT 1',
            [matCode]
          );
          if (sbRow.length > 0) {
            boRate = parseFloat(sbRow[0].valuation_rate) || 0;
          }
        }
        
        // Force UOM of all Bought-Out items to be Nos/NOS
        const boUom = 'Nos';

        const existing = materialMap.get(mKey);
        if (existing) {
          existing.required_qty += reqQty;
          existing.totalRequiredQty += reqQty;
          
          // Merge BOM reference
          const newRef = comp.bom_no || comp.bom_ref || compDrawing;
          if (newRef && existing.bom_ref && !existing.bom_ref.includes(newRef)) {
            existing.bom_ref = `${existing.bom_ref}, ${newRef}`;
          }
          
          if (material_category === 'CORE') {
            existing.material_category = 'CORE';
          }
        } else {
          materialMap.set(mKey, {
            ...comp,
            material_name: matName,
            material_code: matCode,
            item_code: matCode,
            material_category,
            required_qty: reqQty,
            totalRequiredQty: reqQty,
            source_assembly,
            rate: boRate,
            bom_ref: comp.bom_no || comp.bom_ref || compDrawing || 'BOM-REF',
            total_wt: 0,
            uom: boUom,
            unit: boUom,
            is_kg_material: false
          });
        }

        // Also push to local materials list so it returns in subDetails.materials
        materials.push({
          ...comp,
          material_name: matName,
          material_code: matCode,
          item_code: matCode,
          qty_per_pc: baseQtyPerFG,
          weight_per_unit: comp.weight_per_unit || 0,
          scrap_percent: comp.scrap_percent || 0,
          item_group: comp.item_group || 'BOUGHT_OUT',
          uom: boUom,
          unit: boUom,
          rate: boRate,
          is_kg_material: false
        });
      }

      if (!componentMap.has(cKey)) {
        componentMap.set(cKey, componentData);
      }
      componentResults.push(componentData);
    }

    return {
      materials: materials.map(m => {
        const calculateWeightFromDimensions = (item) => {
          let weightVal = (item.weight_per_unit && parseFloat(item.weight_per_unit) > 0) ? parseFloat(item.weight_per_unit) : 0;
          if (weightVal === 0) {
            const len = parseFloat(item.length || 0);
            const wid = parseFloat(item.width || 0);
            const thk = parseFloat(item.thickness || 0);
            const dia = parseFloat(item.diameter || 0);
            const od = parseFloat(item.outer_diameter || 0);
            const density = parseFloat(item.density || 7.85);
            const shapeStr = String(item.shape_type || item.shape_name || item.shape || item.material_name || '').trim().toLowerCase();

            if (shapeStr.includes('threaded') || shapeStr.includes('thread')) {
              const dVal = dia > 0 ? dia : od;
              const pVal = parseFloat(item.thread_pitch || item.threadPitch || 0);
              if (dVal > 0 && pVal > 0 && pVal < dVal && len > 0) {
                const tensileArea = 0.7854 * Math.pow(dVal - (0.9382 * pVal), 2);
                weightVal = (tensileArea * len * density) / 1000000;
              }
            } else if (len > 0 && wid > 0 && thk > 0) {
              weightVal = (len * wid * thk * density) / 1000000;
            } else if (len > 0 && dia > 0) {
              weightVal = (Math.PI * Math.pow(dia, 2) / 4 * len * density) / 1000000;
            }
          }
          return weightVal;
        };

        const weight = calculateWeightFromDimensions(m);
        const scrapFactor = (m.scrap_percent && parseFloat(m.scrap_percent) > 0) ? (1 + parseFloat(m.scrap_percent) / 100) : 1;
        const total_wt = weight * scrapFactor;

        const itemGroup = (m.item_group || '').toUpperCase().replace(/_/g, ' ');
        const uom = (m.uom || '').toUpperCase();
        const isKgMaterial = (itemGroup.includes('RAW MATERIAL') || itemGroup.includes('CONSUMABLE')) && uom === 'KG';

        const baseQtyPerFG = isKgMaterial ? ((parseFloat(m.qty_per_pc) || 1) * total_wt) : (parseFloat(m.qty_per_pc) || 1);

        return {
          ...m,
          item_code: m.actual_item_code || m.material_code || m.item_code || m.itemCode || null,
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

const addManualMaterialToPlan = async (planId, item) => {
  const len = Number(item.length) || 0;
  const wid = Number(item.width) || 0;
  const thk = Number(item.thickness) || 0;
  const dia = Number(item.diameter) || 0;
  const od = Number(item.outer_diameter) || 0;
  const dens = Number(item.density) || 0;
  const wpu = Number(item.weight_per_unit) || 0;
  const isKg = (item.uom || '').toUpperCase() === 'KG';

  const shapeName = item.shape_type || item.shape_name || item.shape || '';
  const bomRef = shapeName ? `MANUAL:${shapeName}` : 'MANUAL';

  const [result] = await pool.execute(
    `INSERT INTO production_plan_materials (
      plan_id, item_code, material_name, design_qty, required_qty, rate, uom, warehouse,
      bom_ref, is_kg_material, material_category, status, length, width, thickness,
      diameter, outer_diameter, density, weight_per_unit, is_manual
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CORE', NULL, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      planId,
      item.item_code || item.material_name,
      item.material_name,
      item.design_qty !== undefined && item.design_qty !== null ? Number(item.design_qty) : null,
      Number(item.quantity) || 0,
      Number(item.rate) || 0,
      item.uom || 'Nos',
      item.warehouse || 'Consumables Store',
      bomRef,
      isKg ? 1 : 0,
      len, wid, thk, dia, od, dens, wpu
    ]
  );
  return { id: result.insertId };
};

const removeManualMaterialFromPlan = async (planId, materialId) => {
  const [rows] = await pool.query(
    'SELECT id FROM production_plan_materials WHERE id = ? AND plan_id = ? AND is_manual = 1',
    [materialId, planId]
  );
  if (rows.length === 0) {
    throw new Error('Manual material not found or cannot be deleted');
  }
  await pool.execute('DELETE FROM production_plan_materials WHERE id = ? AND plan_id = ? AND is_manual = 1', [materialId, planId]);
  return true;
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

  const [mrCheck] = await pool.query(
    'SELECT 1 FROM material_requests WHERE plan_id = ? LIMIT 1',
    [planId]
  );
  const hasRequests = mrCheck.length > 0;

  const addToMap = (itemCode, qty, uom, name, warehouse, category, rate, designQty, currentBalance, isFulfilled, requestExists, dimensions = {}, isExistingRequest = false, isManual = false, ppmId = null, shapeType = '') => {
    if (!itemCode && !name) return;

    const code = (itemCode || name).trim();
    const len = Number(dimensions?.length) || 0;
    const wid = Number(dimensions?.width) || 0;
    const thk = Number(dimensions?.thickness) || 0;
    const dia = Number(dimensions?.diameter) || 0;
    const od = Number(dimensions?.outer_diameter) || 0;
    const key = `${code.toUpperCase()}-${len}-${wid}-${thk}-${dia}-${od}`;

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
      if (!isExistingRequest) {
        existing.quantity += Number(qty);
        existing.design_qty = (existing.design_qty || 0) + Number(designQty || 0);
      }
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
      if (shapeType && !existing.shape_type) {
        existing.shape_type = shapeType;
      }
    } else {
      aggregatedMap.set(key, {
        item_code: code,
        quantity: Number(qty),
        design_qty: (designQty !== null && designQty !== undefined) ? Number(designQty) : null,
        uom: uom || 'Nos',
        material_name: name || code,
        warehouse: warehouse,
        item_type: mapItemType(code, category),
        unit_rate: rate || 0,
        inventory: Math.max(0, Number(currentBalance || 0)),
        is_fulfilled: !!isFulfilled,
        request_exists: !!requestExists,
        dimensions: dimensions || {},
        is_manual: !!isManual,
        ppm_id: ppmId,
        shape_type: shapeType || ''
      });
    }
  };

  // Step 1: Add Materials (ONLY materials should be in Material Request)
  const [materials] = await pool.query(`
    SELECT ppm.*, 
           shape_lookup.shape_name as shape_type,
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
        SELECT som.material_name, som.length, som.width, som.thickness, som.diameter, som.outer_diameter,
               MAX(s.name) as shape_name
        FROM sales_order_item_materials som
        LEFT JOIN shapes s ON som.shape_id = s.id
        GROUP BY som.material_name, som.length, som.width, som.thickness, som.diameter, som.outer_diameter
    ) shape_lookup ON (
        LOWER(TRIM(REPLACE(ppm.material_name, '\t', ''))) = LOWER(TRIM(REPLACE(shape_lookup.material_name, '\t', '')))
        AND ABS(COALESCE(ppm.length, 0) - COALESCE(shape_lookup.length, 0)) < 0.0001
        AND ABS(COALESCE(ppm.width, 0) - COALESCE(shape_lookup.width, 0)) < 0.0001
        AND ABS(COALESCE(ppm.thickness, 0) - COALESCE(shape_lookup.thickness, 0)) < 0.0001
        AND ABS(COALESCE(ppm.diameter, 0) - COALESCE(shape_lookup.diameter, 0)) < 0.0001
        AND ABS(COALESCE(ppm.outer_diameter, 0) - COALESCE(shape_lookup.outer_diameter, 0)) < 0.0001
    )
    LEFT JOIN (
         SELECT 
             material_name, 
             length,
             width,
             thickness,
             diameter,
             outer_diameter,
             MAX(item_code) as item_code, 
             MAX(valuation_rate) as valuation_rate, 
             SUM(current_balance) as current_balance
         FROM stock_balance 
         GROUP BY material_name, length, width, thickness, diameter, outer_diameter
     ) actual_sb ON (
          (ppm.material_name = actual_sb.material_name)
          AND (ABS(COALESCE(ppm.length, 0) - COALESCE(actual_sb.length, 0)) < 0.0001)
          AND (ABS(COALESCE(ppm.width, 0) - COALESCE(actual_sb.width, 0)) < 0.0001)
          AND (ABS(COALESCE(ppm.thickness, 0) - COALESCE(actual_sb.thickness, 0)) < 0.0001)
          AND (ABS(COALESCE(ppm.diameter, 0) - COALESCE(actual_sb.diameter, 0)) < 0.0001)
          AND (ABS(COALESCE(ppm.outer_diameter, 0) - COALESCE(actual_sb.outer_diameter, 0)) < 0.0001)
     ) OR (
          (ppm.item_code = actual_sb.item_code AND ppm.item_code NOT LIKE 'PART-%' AND ppm.item_code NOT LIKE 'SA-%' AND ppm.item_code NOT LIKE 'FG-%' AND ppm.item_code NOT LIKE 'SFG-%' AND ppm.item_code NOT LIKE 'ASSEMBLY%')
          AND (ABS(COALESCE(ppm.length, 0) - COALESCE(actual_sb.length, 0)) < 0.0001)
          AND (ABS(COALESCE(ppm.width, 0) - COALESCE(actual_sb.width, 0)) < 0.0001)
          AND (ABS(COALESCE(ppm.thickness, 0) - COALESCE(actual_sb.thickness, 0)) < 0.0001)
          AND (ABS(COALESCE(ppm.diameter, 0) - COALESCE(actual_sb.diameter, 0)) < 0.0001)
          AND (ABS(COALESCE(ppm.outer_diameter, 0) - COALESCE(actual_sb.outer_diameter, 0)) < 0.0001)
     )
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
    ) issued ON (ppm.material_name = issued.material_name) OR (ppm.item_code = issued.item_code AND ppm.item_code NOT LIKE 'PART-%' AND ppm.item_code NOT LIKE 'SA-%' AND ppm.item_code NOT LIKE 'FG-%' AND ppm.item_code NOT LIKE 'SFG-%' AND ppm.item_code NOT LIKE 'ASSEMBLY%')
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
        (ppm.material_name IS NOT NULL AND LOWER(TRIM(ppm.material_name)) = mr_data.join_item_name) OR 
        (ppm.item_code IS NOT NULL AND LOWER(TRIM(ppm.item_code)) = mr_data.join_item_code AND ppm.item_code NOT LIKE 'PART-%' AND ppm.item_code NOT LIKE 'SA-%' AND ppm.item_code NOT LIKE 'FG-%' AND ppm.item_code NOT LIKE 'SFG-%' AND ppm.item_code NOT LIKE 'ASSEMBLY%')
    )
    WHERE ppm.plan_id = ?
  `, [planId, planId, `%${planCode}%`, planId]);

  for (const mat of materials) {
    if (hasRequests && (mat.status_rank || 0) > 0) {
      continue;
    }

    let code = (mat.actual_item_code || '').toUpperCase();
    if (!code || code.startsWith('PART-') || code.startsWith('SA-') || code.startsWith('FG-') || code.startsWith('SFG-') || code.startsWith('ASSEMBLY')) {
      code = (mat.material_name || '').trim().toUpperCase();
    }

    if (!code || code.startsWith('PART-') || code.startsWith('SA-') || code.startsWith('FG-') || code.startsWith('SFG-') || code.startsWith('ASSEMBLY')) {
      continue;
    }

    // If material request is fulfilled or completed, show full quantity as available
    const isFulfilled = (mat.status_rank || 0) >= 4;
    const requestExists = (mat.status_rank || 0) > 0;
    const effectiveInventory = isFulfilled
      ? Math.max(Number(mat.required_qty), Number(mat.current_balance) + Number(mat.issued_qty))
      : Number(mat.current_balance) + Number(mat.issued_qty);

    let shapeType = mat.shape_type || '';
    if (mat.bom_ref && mat.bom_ref.startsWith('MANUAL:')) {
      shapeType = mat.bom_ref.substring(7);
    }

    addToMap(
      code,
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
      },
      false,             // isExistingRequest
      !!mat.is_manual,   // isManual
      mat.id,            // ppmId
      shapeType          // shapeType
    );
  }


  // Step 2: Fetch and add items that are already in a transmitted/created material request for this plan
  const [mrItems] = await pool.query(`
    SELECT mri.*, mri.quantity as required_qty, mr.status,
           ppm.bom_ref as ppm_bom_ref,
           shape_lookup.shape_name as shape_type,
           COALESCE(actual_sb.valuation_rate, 0) as stock_rate,
           COALESCE(actual_sb.current_balance, 0) as current_balance,
           COALESCE(issued.issued_qty, 0) as issued_qty,
           COALESCE(NULLIF(mri.length, 0), actual_sb.length, 0) as length, 
           COALESCE(NULLIF(mri.width, 0), actual_sb.width, 0) as width, 
           COALESCE(NULLIF(mri.thickness, 0), actual_sb.thickness, 0) as thickness, 
           COALESCE(NULLIF(mri.diameter, 0), actual_sb.diameter, 0) as diameter, 
           COALESCE(NULLIF(mri.outer_diameter, 0), actual_sb.outer_diameter, 0) as outer_diameter
    FROM material_requests mr
    JOIN material_request_items mri ON mr.id = mri.mr_id
    LEFT JOIN production_plan_materials ppm ON (
        (mri.item_name = ppm.material_name)
        AND ABS(COALESCE(mri.length, 0) - COALESCE(ppm.length, 0)) < 0.0001
        AND ABS(COALESCE(mri.width, 0) - COALESCE(ppm.width, 0)) < 0.0001
        AND ABS(COALESCE(mri.thickness, 0) - COALESCE(ppm.thickness, 0)) < 0.0001
        AND ABS(COALESCE(mri.diameter, 0) - COALESCE(ppm.diameter, 0)) < 0.0001
        AND ABS(COALESCE(mri.outer_diameter, 0) - COALESCE(ppm.outer_diameter, 0)) < 0.0001
        AND ppm.plan_id = mr.plan_id
    )
    LEFT JOIN (
        SELECT som.material_name, som.length, som.width, som.thickness, som.diameter, som.outer_diameter,
               MAX(s.name) as shape_name
        FROM sales_order_item_materials som
        LEFT JOIN shapes s ON som.shape_id = s.id
        GROUP BY som.material_name, som.length, som.width, som.thickness, som.diameter, som.outer_diameter
    ) shape_lookup ON (
        LOWER(TRIM(mri.item_name)) = LOWER(TRIM(shape_lookup.material_name))
        AND ABS(COALESCE(mri.length, 0) - COALESCE(shape_lookup.length, 0)) < 0.0001
        AND ABS(COALESCE(mri.width, 0) - COALESCE(shape_lookup.width, 0)) < 0.0001
        AND ABS(COALESCE(mri.thickness, 0) - COALESCE(shape_lookup.thickness, 0)) < 0.0001
        AND ABS(COALESCE(mri.diameter, 0) - COALESCE(shape_lookup.diameter, 0)) < 0.0001
        AND ABS(COALESCE(mri.outer_diameter, 0) - COALESCE(shape_lookup.outer_diameter, 0)) < 0.0001
    )
    LEFT JOIN (
        SELECT 
            material_name, 
            length,
            width,
            thickness,
            diameter,
            outer_diameter,
            MAX(item_code) as item_code, 
            MAX(valuation_rate) as valuation_rate, 
            SUM(current_balance) as current_balance
        FROM stock_balance 
        GROUP BY material_name, length, width, thickness, diameter, outer_diameter
    ) actual_sb ON (
        (mri.item_name = actual_sb.material_name)
        AND (ABS(COALESCE(mri.length, 0) - COALESCE(actual_sb.length, 0)) < 0.0001)
        AND (ABS(COALESCE(mri.width, 0) - COALESCE(actual_sb.width, 0)) < 0.0001)
        AND (ABS(COALESCE(mri.thickness, 0) - COALESCE(actual_sb.thickness, 0)) < 0.0001)
        AND (ABS(COALESCE(mri.diameter, 0) - COALESCE(actual_sb.diameter, 0)) < 0.0001)
        AND (ABS(COALESCE(mri.outer_diameter, 0) - COALESCE(actual_sb.outer_diameter, 0)) < 0.0001)
     ) OR (
         mri.item_code = actual_sb.item_code
         AND (ABS(COALESCE(mri.length, 0) - COALESCE(actual_sb.length, 0)) < 0.0001)
         AND (ABS(COALESCE(mri.width, 0) - COALESCE(actual_sb.width, 0)) < 0.0001)
         AND (ABS(COALESCE(mri.thickness, 0) - COALESCE(actual_sb.thickness, 0)) < 0.0001)
         AND (ABS(COALESCE(mri.diameter, 0) - COALESCE(actual_sb.diameter, 0)) < 0.0001)
         AND (ABS(COALESCE(mri.outer_diameter, 0) - COALESCE(actual_sb.outer_diameter, 0)) < 0.0001)
     )
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
    ) issued ON (mri.item_name = issued.material_name) OR (mri.item_code = issued.item_code)
    WHERE mr.plan_id = ? OR mr.notes LIKE ?
  `, [planId, planId, `%${planCode}%`]);

  for (const mri of mrItems) {
    let code = (mri.item_code || '').toUpperCase();
    if (!code || code.startsWith('PART-') || code.startsWith('SA-') || code.startsWith('FG-') || code.startsWith('SFG-') || code.startsWith('ASSEMBLY')) {
      code = (mri.item_name || '').trim().toUpperCase();
    }

    if (!code || code.startsWith('PART-') || code.startsWith('SA-') || code.startsWith('FG-') || code.startsWith('SFG-') || code.startsWith('ASSEMBLY')) {
      continue;
    }

    const isFulfilled = ['COMPLETED', 'FULFILLED'].includes(String(mri.status).toUpperCase());
    const requestExists = true;
    const effectiveInventory = isFulfilled
      ? Math.max(Number(mri.required_qty), Number(mri.current_balance) + Number(mri.issued_qty))
      : Number(mri.current_balance) + Number(mri.issued_qty);

    let shapeType = mri.shape_type || '';
    if (mri.ppm_bom_ref && mri.ppm_bom_ref.startsWith('MANUAL:')) {
      shapeType = mri.ppm_bom_ref.substring(7);
    }

    addToMap(
      code,
      mri.required_qty,
      mri.uom || mri.unit,
      mri.item_name,
      mri.warehouse,
      'RAW_MATERIAL',
      mri.unit_rate || mri.stock_rate || 0,
      mri.design_qty,
      effectiveInventory,
      isFulfilled,
      requestExists,
      {
        length: mri.length,
        width: mri.width,
        thickness: mri.thickness,
        diameter: mri.diameter,
        outer_diameter: mri.outer_diameter
      },
      true, // isExistingRequest
      !!(mri.item_source === 'MANUAL'), // isManual
      null, // ppmId
      shapeType // shapeType
    );
  }

  const [mrRows] = await pool.query(
    'SELECT id, status FROM material_requests WHERE plan_id = ? ORDER BY id DESC LIMIT 1',
    [planId]
  );
  const mrId = mrRows.length > 0 ? mrRows[0].id : null;
  const mrStatus = mrRows.length > 0 ? mrRows[0].status : null;

  return {
    plan_code: plan.plan_code,
    start_date: plan.start_date,
    mr_id: mrId,
    mr_status: mrStatus,
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

    const addToPurposeMap = (map, itemCode, qty, uom, name, warehouse, category, rate, designQty, dimensions = {}, itemSource = 'BOM', remarks = null) => {
      // Allow qty=0 for manually added items (e.g. IN STOCK items) so they appear in the MR for visibility
      if (!itemCode && !name) return;
      if (qty <= 0 && itemSource !== 'MANUAL') return;

      const code = (itemCode || name).trim();
      const len = Number(dimensions?.length) || 0;
      const wid = Number(dimensions?.width) || 0;
      const thk = Number(dimensions?.thickness) || 0;
      const dia = Number(dimensions?.diameter) || 0;
      const od = Number(dimensions?.outer_diameter) || 0;
      const key = `${code.toUpperCase()}-${len}-${wid}-${thk}-${dia}-${od}`;

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
        if (designQty !== null && designQty !== undefined) {
          existing.design_qty = (existing.design_qty || 0) + Number(designQty);
        }
        existing.remarks = existing.remarks || remarks;
      } else {
        map.set(key, {
          item_code: code,
          quantity: Number(qty),
          design_qty: (designQty !== null && designQty !== undefined) ? Number(designQty) : null,
          uom: uom || 'Nos',
          material_name: name || code,
          warehouse: warehouse || 'Consumables Store',
          item_type: 'RAW_MATERIAL',
          unit_rate: rate || 0,
          length: len,
          width: wid,
          thickness: thk,
          diameter: dia,
          outer_diameter: od,
          density: Number(dimensions?.density) || 0,
          weight_per_unit: Number(dimensions?.weight_per_unit) || 0,
          shape_type: dimensions?.shape_type || null,
          item_source: itemSource,
          remarks: remarks
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
        const design = (item.design_qty !== undefined && item.design_qty !== null && item.design_qty !== '') ? item.design_qty : null;
        const remarks = item.remarks || null;
        const cat = item.item_type || item.category || 'RAW_MATERIAL';

        const dimsObj = item.dimensions || {};
        const len = item.length !== undefined ? item.length : dimsObj.length;
        const wid = item.width !== undefined ? item.width : dimsObj.width;
        const thk = item.thickness !== undefined ? item.thickness : dimsObj.thickness;
        const dia = item.diameter !== undefined ? item.diameter : dimsObj.diameter;
        const od = item.outer_diameter !== undefined ? item.outer_diameter : (item.outerDiameter !== undefined ? item.outerDiameter : dimsObj.outer_diameter);
        const dens = item.density !== undefined ? item.density : dimsObj.density;
        const wpu = item.weight_per_unit !== undefined ? item.weight_per_unit : (item.weightPerUnit !== undefined ? item.weightPerUnit : dimsObj.weight_per_unit);
        const shapeType = item.shape_type || item.shape_name || item.shape || null;

        addToPurposeMap(purchaseMap, code, req, uom, name, wh, cat, rate, design, {
          length: len,
          width: wid,
          thickness: thk,
          diameter: dia,
          outer_diameter: od,
          density: dens,
          weight_per_unit: wpu,
          shape_type: shapeType
        }, item.is_manual ? 'MANUAL' : 'BOM', remarks);
      }
    } else {
      // Automatic logic for non-custom items
      const [materials] = await connection.query(`
        SELECT ppm.*, 
               COALESCE(actual_sb.item_code, ppm.item_code) as actual_item_code,
               COALESCE(actual_sb.valuation_rate, 0) as stock_rate,
               COALESCE(actual_sb.current_balance, 0) as current_balance,
               COALESCE(issued.issued_qty, 0) as issued_qty,
               COALESCE(NULLIF(ppm.length, 0), actual_sb.length, 0) as length, 
               COALESCE(NULLIF(ppm.width, 0), actual_sb.width, 0) as width, 
               COALESCE(NULLIF(ppm.thickness, 0), actual_sb.thickness, 0) as thickness, 
               COALESCE(NULLIF(ppm.diameter, 0), actual_sb.diameter, 0) as diameter, 
               COALESCE(NULLIF(ppm.outer_diameter, 0), actual_sb.outer_diameter, 0) as outer_diameter,
               COALESCE(NULLIF(ppm.density, 0), actual_sb.density, 0) as density,
               COALESCE(NULLIF(ppm.weight_per_unit, 0), actual_sb.weight_per_unit, 0) as weight_per_unit,
               COALESCE(
                 shape_lookup.shape_name,
                 (SELECT name FROM shapes WHERE id = actual_sb.shape_id LIMIT 1)
               ) as shape_type
        FROM production_plan_materials ppm
        LEFT JOIN (
          SELECT material_name, MAX(item_code) as item_code, MAX(valuation_rate) as valuation_rate, SUM(current_balance) as current_balance,
                 MAX(length) as length, MAX(width) as width, MAX(thickness) as thickness, MAX(diameter) as diameter, MAX(outer_diameter) as outer_diameter,
                 MAX(density) as density, MAX(weight_per_unit) as weight_per_unit, MAX(shape_id) as shape_id
          FROM stock_balance 
          GROUP BY material_name
        ) actual_sb ON ppm.material_name = actual_sb.material_name OR ppm.item_code = actual_sb.item_code
        LEFT JOIN (
            SELECT som.material_name, som.length, som.width, som.thickness, som.diameter, som.outer_diameter,
                   MAX(s.name) as shape_name
            FROM sales_order_item_materials som
            LEFT JOIN shapes s ON som.shape_id = s.id
            WHERE s.id IS NOT NULL
            GROUP BY som.material_name, som.length, som.width, som.thickness, som.diameter, som.outer_diameter
        ) shape_lookup ON (
            LOWER(TRIM(REPLACE(ppm.material_name, '\t', ''))) = LOWER(TRIM(REPLACE(shape_lookup.material_name, '\t', '')))
            AND ABS(COALESCE(ppm.length, 0) - COALESCE(shape_lookup.length, 0)) < 0.0001
            AND ABS(COALESCE(ppm.width, 0) - COALESCE(shape_lookup.width, 0)) < 0.0001
            AND ABS(COALESCE(ppm.thickness, 0) - COALESCE(shape_lookup.thickness, 0)) < 0.0001
            AND ABS(COALESCE(ppm.diameter, 0) - COALESCE(shape_lookup.diameter, 0)) < 0.0001
            AND ABS(COALESCE(ppm.outer_diameter, 0) - COALESCE(shape_lookup.outer_diameter, 0)) < 0.0001
        )
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

        addToPurposeMap(purchaseMap, mat.actual_item_code, required, mat.uom, mat.material_name, mat.warehouse, mat.material_category, effectiveRate, mat.design_qty, {
          length: mat.length,
          width: mat.width,
          thickness: mat.thickness,
          diameter: mat.diameter,
          outer_diameter: mat.outer_diameter,
          density: mat.density,
          weight_per_unit: mat.weight_per_unit,
          shape_type: mat.shape_type
        }, 'BOM');
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
            mr_id, item_code, item_name, item_type, design_qty, quantity, unit_rate, uom, warehouse,
            length, width, thickness, diameter, outer_diameter, density, weight_per_unit, item_source, remarks, shape_type
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            mrId,
            item.item_code,
            item.material_name,
            item.item_type,
            (item.design_qty !== undefined && item.design_qty !== null && item.design_qty !== '') ? Number(item.design_qty) : null,
            item.quantity,
            item.unit_rate || 0,
            item.uom,
            item.warehouse,
            item.length || 0,
            item.width || 0,
            item.thickness || 0,
            item.diameter || 0,
            item.outer_diameter || 0,
            item.density || 0,
            item.weight_per_unit || 0,
            item.item_source || 'BOM',
            item.remarks || null,
            item.shape_type || null
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
  getMaterialRequestItemsForPlan,
  addManualMaterialToPlan,
  removeManualMaterialFromPlan
};
