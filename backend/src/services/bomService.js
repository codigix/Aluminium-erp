const pool = require('../config/db');

const getItemMaterials = async (itemId, itemCode = null, drawingNo = null) => {
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  let rows = [];
  
  // Use JOIN with items table to get the correct material item_code and name
  if (parsedItemId) {
    [rows] = await pool.query(
      `SELECT m.*, i.item_code as actual_item_code, i.material_name as actual_item_name
       FROM sales_order_item_materials m
       LEFT JOIN (
         SELECT item_code, material_name FROM stock_balance GROUP BY item_code, material_name
       ) i ON LOWER(TRIM(m.material_name)) = LOWER(TRIM(i.material_name))
       WHERE m.sales_order_item_id = ? 
       ORDER BY m.created_at ASC`,
      [parsedItemId]
    );
  }
  
  // Only fallback to Master/Template if NO specific ID was provided
  // This prevents one version's data from "leaking" into another empty version
  if (!parsedItemId && rows.length === 0 && (itemCode || drawingNo)) {
    let query = `SELECT m.*, i.item_code as actual_item_code, i.material_name as actual_item_name 
                 FROM sales_order_item_materials m 
                 LEFT JOIN (
                   SELECT item_code, material_name FROM stock_balance GROUP BY item_code, material_name
                 ) i ON LOWER(TRIM(m.material_name)) = LOWER(TRIM(i.material_name)) 
                 WHERE `;
    let params = [];

    if (itemCode && drawingNo) {
      query += `m.item_code = ? AND m.drawing_no = ? AND (m.sales_order_item_id IS NULL OR EXISTS (SELECT 1 FROM sales_order_items WHERE id = m.sales_order_item_id AND sales_order_id IS NULL))`;
      params = [itemCode, drawingNo];
    } else if (itemCode) {
      query += `m.item_code = ? AND (m.sales_order_item_id IS NULL OR EXISTS (SELECT 1 FROM sales_order_items WHERE id = m.sales_order_item_id AND sales_order_id IS NULL))`;
      params = [itemCode];
    } else {
      query += `m.drawing_no = ? AND (m.sales_order_item_id IS NULL OR EXISTS (SELECT 1 FROM sales_order_items WHERE id = m.sales_order_item_id AND sales_order_id IS NULL))`;
      params = [drawingNo];
    }

    [rows] = await pool.query(query + ' ORDER BY m.created_at ASC', params);
  }

  return rows.map(row => ({
    ...row,
    item_code: row.actual_item_code || row.item_code,
    material_name: row.actual_item_name || row.material_name,
    qty: row.qty_per_pc || row.qty,
    weightPerUnit: row.weight_per_unit,
    scrapPercent: row.scrap_percent,
    // Add snake_case aliases
    weight_per_unit: row.weight_per_unit,
    scrap_percent: row.scrap_percent
  }));
};

const getItemComponents = async (itemId, itemCode = null, drawingNo = null) => {
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  let rows = [];
  
  if (parsedItemId) {
    [rows] = await pool.query(
      'SELECT * FROM sales_order_item_components WHERE sales_order_item_id = ? ORDER BY created_at ASC',
      [parsedItemId]
    );
  }
  
  // Only fallback to Master/Template if NO specific ID was provided
  if (!parsedItemId && rows.length === 0 && (itemCode || drawingNo)) {
    let query = 'SELECT * FROM sales_order_item_components WHERE ';
    let params = [];

    if (itemCode && drawingNo) {
      query += `item_code = ? AND drawing_no = ? AND (sales_order_item_id IS NULL OR EXISTS (SELECT 1 FROM sales_order_items WHERE id = sales_order_item_id AND sales_order_id IS NULL))`;
      params = [itemCode, drawingNo];
    } else if (itemCode) {
      query += `item_code = ? AND (sales_order_item_id IS NULL OR EXISTS (SELECT 1 FROM sales_order_items WHERE id = sales_order_item_id AND sales_order_id IS NULL))`;
      params = [itemCode];
    } else {
      query += `drawing_no = ? AND (sales_order_item_id IS NULL OR EXISTS (SELECT 1 FROM sales_order_items WHERE id = sales_order_item_id AND sales_order_id IS NULL))`;
      params = [drawingNo];
    }

    [rows] = await pool.query(query + ' ORDER BY created_at ASC', params);
  }
  return rows.map(row => ({
    ...row,
    qty: row.quantity || row.qty,
    quantity: row.quantity || row.qty
  }));
};

const getItemOperations = async (itemId, itemCode = null, drawingNo = null) => {
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  let rows = [];
  
  if (parsedItemId) {
    [rows] = await pool.query(
      'SELECT * FROM sales_order_item_operations WHERE sales_order_item_id = ? ORDER BY created_at ASC',
      [parsedItemId]
    );
  }
  
  // Only fallback to Master/Template if NO specific ID was provided
  if (!parsedItemId && rows.length === 0 && (itemCode || drawingNo)) {
    let query = 'SELECT * FROM sales_order_item_operations WHERE ';
    let params = [];

    if (itemCode && drawingNo) {
      query += `item_code = ? AND drawing_no = ? AND (sales_order_item_id IS NULL OR EXISTS (SELECT 1 FROM sales_order_items WHERE id = sales_order_item_id AND sales_order_id IS NULL))`;
      params = [itemCode, drawingNo];
    } else if (itemCode) {
      query += `item_code = ? AND (sales_order_item_id IS NULL OR EXISTS (SELECT 1 FROM sales_order_items WHERE id = sales_order_item_id AND sales_order_id IS NULL))`;
      params = [itemCode];
    } else {
      query += `drawing_no = ? AND (sales_order_item_id IS NULL OR EXISTS (SELECT 1 FROM sales_order_items WHERE id = sales_order_item_id AND sales_order_id IS NULL))`;
      params = [drawingNo];
    }

    [rows] = await pool.query(query + ' ORDER BY created_at ASC', params);
  }
  return rows.map(row => ({
    ...row,
    operationName: row.operation_name,
    cycleTimeMin: row.cycle_time_min,
    setupTimeMin: row.setup_time_min,
    hourlyRate: row.hourly_rate,
    operationType: row.operation_type,
    targetWarehouse: row.target_warehouse,
    // Add snake_case aliases for frontend calculation logic consistency
    operation_name: row.operation_name,
    cycle_time_min: row.cycle_time_min,
    setup_time_min: row.setup_time_min,
    hourly_rate: row.hourly_rate,
    operation_type: row.operation_type,
    target_warehouse: row.target_warehouse
  }));
};

const getItemScrap = async (itemId, itemCode = null, drawingNo = null) => {
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  let rows = [];
  
  if (parsedItemId) {
    [rows] = await pool.query(
      'SELECT * FROM sales_order_item_scrap WHERE sales_order_item_id = ? ORDER BY created_at ASC',
      [parsedItemId]
    );
  }
  
  // Only fallback to Master/Template if NO specific ID was provided
  if (!parsedItemId && rows.length === 0 && (itemCode || drawingNo)) {
    let query = 'SELECT * FROM sales_order_item_scrap WHERE ';
    let params = [];

    if (itemCode && drawingNo) {
      query += `item_code = ? AND drawing_no = ? AND (sales_order_item_id IS NULL OR EXISTS (SELECT 1 FROM sales_order_items WHERE id = sales_order_item_id AND sales_order_id IS NULL))`;
      params = [itemCode, drawingNo];
    } else if (itemCode) {
      query += `item_code = ? AND (sales_order_item_id IS NULL OR EXISTS (SELECT 1 FROM sales_order_items WHERE id = sales_order_item_id AND sales_order_id IS NULL))`;
      params = [itemCode];
    } else {
      query += `drawing_no = ? AND (sales_order_item_id IS NULL OR EXISTS (SELECT 1 FROM sales_order_items WHERE id = sales_order_item_id AND sales_order_id IS NULL))`;
      params = [drawingNo];
    }

    [rows] = await pool.query(query + ' ORDER BY created_at ASC', params);
  }
  return rows.map(row => ({
    ...row,
    inputQty: row.input_qty,
    lossPercent: row.loss_percent,
    // Add snake_case aliases
    input_qty: row.input_qty,
    loss_percent: row.loss_percent
  }));
};

const addItemMaterial = async (itemId, materialData) => {
  const { 
    itemCode, drawingNo, materialName, materialType, 
    itemGroup, qtyPerPc, uom, rate, warehouse, 
    operation, parentId, description,
    weight_per_unit, scrap_percent
  } = materialData;
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  
  // Raw materials are GLOBAL - they should not be linked to any specific drawing
  const effectiveDrawingNo = itemGroup === 'Raw Material' ? null : (drawingNo || null);

  const [result] = await pool.execute(
    'INSERT INTO sales_order_item_materials (sales_order_item_id, item_code, drawing_no, parent_id, material_name, material_type, item_group, qty_per_pc, uom, rate, warehouse, operation, description, weight_per_unit, scrap_percent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [parsedItemId, itemCode || null, effectiveDrawingNo, parentId || null, materialName || null, materialType || null, itemGroup || null, qtyPerPc || null, uom || null, rate || 0, warehouse || null, operation || null, description || null, weight_per_unit || 0, scrap_percent || 0]
  );
  return result.insertId;
};

const addComponent = async (itemId, componentData) => {
  const { 
    itemCode, drawingNo, componentCode, description, quantity, uom, rate, 
    lossPercent, notes, parentId,
    itemGroup, weight_per_unit, scrap_percent
  } = componentData;
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  const [result] = await pool.execute(
    'INSERT INTO sales_order_item_components (sales_order_item_id, item_code, drawing_no, parent_id, component_code, description, quantity, uom, rate, loss_percent, notes, item_group, weight_per_unit, scrap_percent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      parsedItemId, itemCode || null, drawingNo || null, parentId || null, 
      componentCode || null, description || null, quantity || null, uom || null, 
      rate || null, lossPercent || null, notes || null,
      itemGroup || null, weight_per_unit || 0, scrap_percent || 0
    ]
  );
  return result.insertId;
};

const addOperation = async (itemId, operationData) => {
  const { 
    itemCode, 
    drawingNo, 
    operationName, 
    workstation, 
    cycleTimeMin, 
    setupTimeMin, 
    hourlyRate, 
    operationType,
    operation_type, 
    targetWarehouse 
  } = operationData;
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  const [result] = await pool.execute(
    'INSERT INTO sales_order_item_operations (sales_order_item_id, item_code, drawing_no, operation_name, workstation, cycle_time_min, setup_time_min, hourly_rate, operation_type, target_warehouse) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      parsedItemId, 
      itemCode || null, 
      drawingNo || null, 
      operationName || null, 
      workstation || null, 
      cycleTimeMin || 0, 
      setupTimeMin || 0, 
      hourlyRate || 0, 
      operationType || operation_type || 'In-House', 
      targetWarehouse || null
    ]
  );
  return result.insertId;
};

const addScrap = async (itemId, scrapData) => {
  const { parentItemCode, drawingNo, scrapItemCode, itemCode, itemName, inputQty, lossPercent, rate, parentId } = scrapData;
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  const [result] = await pool.execute(
    'INSERT INTO sales_order_item_scrap (sales_order_item_id, item_code, drawing_no, parent_id, scrap_item_code, item_name, input_qty, loss_percent, rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      parsedItemId, 
      parentItemCode || null, 
      drawingNo || null,
      parentId || null,
      scrapItemCode || itemCode || null, 
      itemName || null, 
      inputQty || 0, 
      lossPercent || 0, 
      rate || 0
    ]
  );
  return result.insertId;
};

const updateItemMaterial = async (materialId, materialData) => {
  const { 
    materialName, material_name, 
    materialType, material_type, 
    itemGroup, item_group, 
    qtyPerPc, qty_per_pc, 
    uom, rate, warehouse, operation, description, 
    weight_per_unit, weightPerUnit, 
    scrap_percent, scrapPercent 
  } = materialData;

  await pool.execute(
    'UPDATE sales_order_item_materials SET material_name = ?, material_type = ?, item_group = ?, qty_per_pc = ?, uom = ?, rate = ?, warehouse = ?, operation = ?, description = ?, weight_per_unit = ?, scrap_percent = ? WHERE id = ?',
    [
      material_name || materialName || null, 
      material_type || materialType || null, 
      item_group || itemGroup || null, 
      qty_per_pc || qtyPerPc || 0, 
      uom || null, 
      rate || 0, 
      warehouse || null, 
      operation || null, 
      description || null, 
      weight_per_unit || weightPerUnit || 0, 
      scrap_percent || scrapPercent || 0, 
      materialId
    ]
  );
};

const updateOperation = async (id, data) => {
  const { 
    operation_name, operationName, 
    workstation, 
    cycle_time_min, cycleTimeMin, 
    setup_time_min, setupTimeMin, 
    hourly_rate, hourlyRate, 
    operation_type, operationType, 
    target_warehouse, targetWarehouse 
  } = data;

  await pool.execute(
    `UPDATE sales_order_item_operations 
     SET operation_name = ?, workstation = ?, cycle_time_min = ?, setup_time_min = ?, hourly_rate = ?, operation_type = ?, target_warehouse = ? 
     WHERE id = ?`,
    [
      operation_name || operationName || null,
      workstation || null,
      cycle_time_min || cycleTimeMin || 0,
      setup_time_min || setupTimeMin || 0,
      hourly_rate || hourlyRate || 0,
      operation_type || operationType || 'In-House',
      target_warehouse || targetWarehouse || null,
      id
    ]
  );
};

const updateComponent = async (id, data) => {
  const { 
    component_code, componentCode, 
    description, quantity, uom, rate, 
    loss_percent, lossPercent, 
    notes, 
    item_group, itemGroup, 
    weight_per_unit, weightPerUnit, 
    scrap_percent, scrapPercent 
  } = data;

  await pool.execute(
    `UPDATE sales_order_item_components 
     SET component_code = ?, description = ?, quantity = ?, uom = ?, rate = ?, loss_percent = ?, notes = ?, item_group = ?, weight_per_unit = ?, scrap_percent = ? 
     WHERE id = ?`,
    [
      component_code || componentCode || null, 
      description || null, 
      quantity || 0, 
      uom || null, 
      rate || 0, 
      loss_percent || lossPercent || 0, 
      notes || null,
      item_group || itemGroup || null,
      weight_per_unit || weightPerUnit || 0,
      scrap_percent || scrapPercent || 0,
      id
    ]
  );
};

const updateScrap = async (id, data) => {
  const { 
    scrap_item_code, scrapItemCode, 
    item_code, itemCode, 
    item_name, itemName, 
    input_qty, inputQty, 
    loss_percent, lossPercent, 
    rate 
  } = data;

  await pool.execute(
    `UPDATE sales_order_item_scrap 
     SET scrap_item_code = ?, item_name = ?, input_qty = ?, loss_percent = ?, rate = ? 
     WHERE id = ?`,
    [
      scrap_item_code || scrapItemCode || item_code || itemCode || null, 
      item_name || itemName || null, 
      input_qty || inputQty || 0, 
      loss_percent || lossPercent || 0, 
      rate || 0, 
      id
    ]
  );
};

const deleteItemMaterial = async (materialId) => {
  await pool.execute('DELETE FROM sales_order_item_materials WHERE id = ?', [materialId]);
};

const deleteComponent = async (id) => {
  // Find child components recursively
  const [childComponents] = await pool.query('SELECT id FROM sales_order_item_components WHERE parent_id = ?', [id]);
  for (const child of childComponents) {
    await deleteComponent(child.id);
  }
  
  // Delete child materials
  await pool.execute('DELETE FROM sales_order_item_materials WHERE parent_id = ?', [id]);
  
  // Delete child scrap
  await pool.execute('DELETE FROM sales_order_item_scrap WHERE parent_id = ?', [id]);
  
  // Delete the component itself
  await pool.execute('DELETE FROM sales_order_item_components WHERE id = ?', [id]);
};

const deleteOperation = async (id) => {
  await pool.execute('DELETE FROM sales_order_item_operations WHERE id = ?', [id]);
};

const deleteScrap = async (id) => {
  await pool.execute('DELETE FROM sales_order_item_scrap WHERE id = ?', [id]);
};

const getBOMBySalesOrder = async (salesOrderId) => {
  const [items] = await pool.query(
    'SELECT id, item_code, drawing_no, description FROM sales_order_items WHERE sales_order_id = ?',
    [salesOrderId]
  );

  const fullBOM = [];

  for (const item of items) {
    const materials = await getItemMaterials(item.id, item.item_code, item.drawing_no);
    const components = await getItemComponents(item.id, item.item_code, item.drawing_no);
    const operations = await getItemOperations(item.id, item.item_code, item.drawing_no);
    const scrap = await getItemScrap(item.id, item.item_code, item.drawing_no);

    fullBOM.push({
      item_id: item.id,
      item_code: item.item_code,
      drawing_no: item.drawing_no,
      item_description: item.description,
      materials,
      components,
      operations,
      scrap
    });
  }

  return fullBOM;
};

const createBOMRequest = async (bomData) => {
  const { itemId, salesOrderId, status, productForm, materials, components, operations, scrap, source, costing } = bomData;
  console.log(`[createBOMRequest] ItemID: ${itemId}, SOID: ${salesOrderId}, Status: ${status}, Source: ${source}, Drawing: ${productForm.drawingNo}`);
  
  const { itemCode, itemGroup, uom, revision, description, notes, isActive, isDefault, quantity, drawingNo, drawing_id } = productForm;
  const bom_cost = costing?.costPerUnit || 0;
  const finalStatus = status || 'Active';
  
  // If notes are provided separately, we should prioritize them for 'description' or merge if needed
  // Since DB currently uses 'description' column, we use notes if they exist, or fallback to description
  const effectiveDescription = (notes && notes.trim()) ? notes : description;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const isMasterBOM = source === 'stock' || (!itemId && !salesOrderId);
    const safeItemCode = itemCode || null;

    // Determine item_type from item_code prefix or default to FG
    let itemType = 'FG';
    if (safeItemCode) {
      if (safeItemCode.startsWith('SA-')) itemType = 'SA';
      else if (safeItemCode.startsWith('SFG-')) itemType = 'SFG';
      else if (safeItemCode.startsWith('RM-')) itemType = 'RM';
    }

    let targetItemId = itemId;

    if (itemId) {
      // 1. Update specific sales_order_item
      // NOTE: We do NOT update 'quantity' here to preserve the original Sales Order/Design quantity.
      // Quotation quantity is always the Design quantity. Sales never redefines quantity at quotation stage.
      await connection.execute(
        `UPDATE sales_order_items 
         SET item_code = ?, item_type = ?, item_group = ?, unit = ?, revision_no = ?, description = ?, is_active = ?, is_default = ?, drawing_no = ?, drawing_id = ?, bom_cost = ?, 
             status = CASE WHEN UPPER(TRIM(status)) = 'APPROVED' THEN status ELSE ? END
         WHERE id = ?`,
        [
          safeItemCode, 
          itemType,
          itemGroup || null, 
          uom || null, 
          revision || null, 
          effectiveDescription || null, 
          isActive ? 1 : 0, 
          isDefault ? 1 : 0, 
          drawingNo || null, 
          drawing_id || null, 
          bom_cost,
          finalStatus === 'Draft' ? 'DRAFT' : 'PENDING',
          itemId
        ]
      );

      // Clear existing BOM items for this sales order item
      await connection.execute('DELETE FROM sales_order_item_materials WHERE sales_order_item_id = ?', [itemId]);
      await connection.execute('DELETE FROM sales_order_item_components WHERE sales_order_item_id = ?', [itemId]);
      await connection.execute('DELETE FROM sales_order_item_operations WHERE sales_order_item_id = ?', [itemId]);
      await connection.execute('DELETE FROM sales_order_item_scrap WHERE sales_order_item_id = ?', [itemId]);
    } else {
      // 2. CREATE Mode (ALWAYS insert a new record for independent BOMs)
      
      // Inherit "Approved" status if the drawing is already approved elsewhere in this Sales Order
      let initialStatus = finalStatus === 'Draft' ? 'DRAFT' : 'PENDING';
      if (salesOrderId && drawingNo) {
        const [approvalCheck] = await connection.query(
          "SELECT status FROM sales_order_items WHERE sales_order_id = ? AND drawing_no = ? AND UPPER(TRIM(status)) = 'APPROVED' LIMIT 1",
          [salesOrderId, drawingNo]
        );
        if (approvalCheck.length > 0) initialStatus = approvalCheck[0].status;
      }

      const [result] = await connection.execute(
        `INSERT INTO sales_order_items 
         (sales_order_id, item_code, item_type, item_group, unit, revision_no, description, is_active, is_default, quantity, drawing_no, drawing_id, bom_cost, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          salesOrderId || null,
          safeItemCode,
          itemType,
          itemGroup || null,
          uom || null,
          revision || null,
          effectiveDescription || null,
          isActive ? 1 : 0,
          isDefault ? 1 : 0,
          quantity || 0,
          drawingNo || null,
          drawing_id || null,
          bom_cost,
          initialStatus
        ]
      );
      targetItemId = result.insertId;
    }

    // 3. Insert new BOM items
    let targetIds = [{ id: targetItemId }];
    
    for (const target of targetIds) {
      const linkId = target.id;
      const idMap = {}; 
      const componentUpdateList = []; 

      if (components && components.length > 0) {
        for (const c of components) {
          const compCode = c.component_code || c.componentCode || null;
          const isSA = compCode && compCode.startsWith('SA-');
          const sourceFg = c.sourceFg || c.source_fg || (isSA ? (drawingNo || null) : null);

          const [result] = await connection.execute(
            'INSERT INTO sales_order_item_components (sales_order_item_id, item_code, drawing_no, source_fg, parent_id, component_code, description, quantity, uom, rate, loss_percent, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              linkId, 
              safeItemCode, 
              drawingNo || null,
              sourceFg,
              null, // Temporarily set parent_id to null
              compCode, 
              c.description || null, 
              c.quantity || c.qty || 0, 
              c.uom || null, 
              c.rate || 0, 
              c.loss_percent || c.lossPercent || 0, 
              c.notes || null
            ]
          );
          
          const newId = result.insertId;
          const oldId = c.id;
          idMap[oldId] = newId;
          
          const oldParentId = c.parent_id || c.parentId;
          if (oldParentId) {
            componentUpdateList.push({ id: newId, oldParentId });
          }
        }

        // Update parent_id for components
        for (const item of componentUpdateList) {
          const newParentId = idMap[item.oldParentId];
          if (newParentId) {
            await connection.execute(
              'UPDATE sales_order_item_components SET parent_id = ? WHERE id = ?',
              [newParentId, item.id]
            );
          }
        }
      }

      if (materials && materials.length > 0) {
        for (const m of materials) {
          const oldParentId = m.parent_id || m.parentId;
          const newParentId = oldParentId ? idMap[oldParentId] : null;

          await connection.execute(
            'INSERT INTO sales_order_item_materials (sales_order_item_id, item_code, drawing_no, parent_id, material_name, material_type, item_group, qty_per_pc, uom, rate, warehouse, operation, description, weight_per_unit, scrap_percent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              linkId, 
              safeItemCode, 
              drawingNo || null,
              newParentId,
              m.material_name || m.materialName || null, 
              m.material_type || m.materialType || null, 
              m.item_group || m.itemGroup || null, 
              m.qty_per_pc || m.qtyPerPc || m.qty || 0, 
              m.uom || null, 
              m.rate || 0, 
              m.warehouse || null, 
              m.operation || null,
              m.description || null,
              m.weight_per_unit || m.weightPerUnit || 0,
              m.scrap_percent || m.scrapPercent || 0
            ]
          );
        }
      }

      if (operations && operations.length > 0) {
        for (const o of operations) {
          await connection.execute(
            'INSERT INTO sales_order_item_operations (sales_order_item_id, item_code, drawing_no, operation_name, workstation, cycle_time_min, setup_time_min, hourly_rate, operation_type, target_warehouse) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              linkId, 
              safeItemCode, 
              drawingNo || null,
              o.operation_name || o.operationName || null, 
              o.workstation || null, 
              o.cycle_time_min || o.cycleTimeMin || 0, 
              o.setup_time_min || o.setupTimeMin || 0, 
              o.hourly_rate || o.hourlyRate || 0, 
              o.operation_type || o.operationType || 'In-House', 
              o.target_warehouse || o.targetWarehouse || null
            ]
          );
        }
      }

      if (scrap && scrap.length > 0) {
        for (const s of scrap) {
          const oldParentId = s.parent_id || s.parentId;
          const newParentId = oldParentId ? idMap[oldParentId] : null;

          await connection.execute(
            'INSERT INTO sales_order_item_scrap (sales_order_item_id, item_code, drawing_no, parent_id, scrap_item_code, item_name, input_qty, loss_percent, rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              linkId, 
              safeItemCode, 
              drawingNo || null,
              newParentId,
              s.scrap_item_code || s.scrapItemCode || s.item_code || s.itemCode || null, 
              s.item_name || s.itemName || null, 
              s.input_qty || s.inputQty || 0, 
              s.loss_percent || s.lossPercent || 0, 
              s.rate || 0
            ]
          );
        }
      }
    }

    // 4. Update sales_order status (only if linked to sales order)
    // 4. Removed automatic update of sales_order status to BOM_SUBMITTED
    // This allows manual submission via "BOM Approval" button in frontend
    
    await connection.commit();
    return { success: true, id: targetItemId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getApprovedBOMs = async () => {
  const [rows] = await pool.query(`
    SELECT DISTINCT
      soi.id,
      soi.item_code,
      soi.item_group,
      soi.drawing_no,
      soi.description,
      soi.unit,
      soi.quantity,
      soi.bom_cost,
      c.company_name,
      so.project_name,
      so.id as sales_order_id,
      soi.created_at
    FROM sales_order_items soi
    LEFT JOIN sales_orders so ON soi.sales_order_id = so.id
    LEFT JOIN companies c ON so.company_id = c.id
    WHERE (
      TRIM(IFNULL(so.status, '')) IN ('CREATED', 'DESIGN_IN_REVIEW', 'DESIGN_Approved', 'BOM_SUBMITTED', 'BOM_Approved', 'PROCUREMENT_IN_PROGRESS', 'IN_PRODUCTION', 'PRODUCTION_COMPLETED', 'MATERIAL_PURCHASE_IN_PROGRESS', 'MATERIAL_READY')
      OR soi.status IN ('DRAFT', 'PENDING')
      OR soi.sales_order_id IS NULL
    )
    AND (
      soi.bom_cost > 0
      OR EXISTS (SELECT 1 FROM sales_order_item_materials WHERE sales_order_item_id = soi.id)
      OR EXISTS (SELECT 1 FROM sales_order_item_components WHERE sales_order_item_id = soi.id)
      OR EXISTS (SELECT 1 FROM sales_order_item_operations WHERE sales_order_item_id = soi.id)
    )
    ORDER BY (CASE WHEN soi.bom_cost > 0 THEN 1 ELSE 2 END) ASC, soi.created_at DESC
  `);
  return rows;
};

const deleteBOM = async (itemId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Delete item-specific BOM entries only
    await connection.execute('DELETE FROM sales_order_item_materials WHERE sales_order_item_id = ?', [itemId]);
    await connection.execute('DELETE FROM sales_order_item_components WHERE sales_order_item_id = ?', [itemId]);
    await connection.execute('DELETE FROM sales_order_item_operations WHERE sales_order_item_id = ?', [itemId]);
    await connection.execute('DELETE FROM sales_order_item_scrap WHERE sales_order_item_id = ?', [itemId]);

    // 2. Reset bom_cost in sales_order_items
    await connection.execute('UPDATE sales_order_items SET bom_cost = 0 WHERE id = ?', [itemId]);

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const findAnyBOM = async (itemCode, drawingNo) => {
  // Find the most recently updated sales_order_item that has a BOM for this identity
  // Prioritize item_code match, then fallback to drawing_no
  let [rows] = await pool.query(`
    SELECT id FROM sales_order_items 
    WHERE (item_code = ? OR (drawing_no = ? AND drawing_no IS NOT NULL))
    AND (
      EXISTS (SELECT 1 FROM sales_order_item_materials WHERE sales_order_item_id = sales_order_items.id)
      OR EXISTS (SELECT 1 FROM sales_order_item_components WHERE sales_order_item_id = sales_order_items.id)
      OR EXISTS (SELECT 1 FROM sales_order_item_operations WHERE sales_order_item_id = sales_order_items.id)
    )
    ORDER BY (CASE WHEN item_code = ? THEN 1 ELSE 2 END) ASC, updated_at DESC LIMIT 1
  `, [itemCode, drawingNo, itemCode]);

  if (rows.length === 0) return null;
  
  const itemId = rows[0].id;
  const materials = await getItemMaterials(itemId);
  const components = await getItemComponents(itemId);
  const operations = await getItemOperations(itemId);
  
  return { materials, components, operations };
};

module.exports = {
  getItemMaterials,
  getItemComponents,
  getItemOperations,
  getItemScrap,
  addItemMaterial,
  addComponent,
  addOperation,
  addScrap,
  updateItemMaterial,
  updateOperation,
  updateComponent,
  updateScrap,
  deleteItemMaterial,
  deleteComponent,
  deleteOperation,
  deleteScrap,
  getBOMBySalesOrder,
  getApprovedBOMs,
  createBOMRequest,
  deleteBOM,
  findAnyBOM
};
