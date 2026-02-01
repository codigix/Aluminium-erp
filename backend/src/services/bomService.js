const pool = require('../config/db');

const getItemMaterials = async (itemId, itemCode = null, drawingNo = null) => {
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  let rows = [];
  if (parsedItemId) {
    [rows] = await pool.query(
      'SELECT * FROM sales_order_item_materials WHERE sales_order_item_id = ? ORDER BY created_at ASC',
      [parsedItemId]
    );
  }
  
  if (rows.length === 0 && itemCode) {
    [rows] = await pool.query(
      'SELECT * FROM sales_order_item_materials WHERE item_code = ? AND sales_order_item_id IS NULL ORDER BY created_at ASC',
      [itemCode]
    );
  }

  if (rows.length === 0 && drawingNo) {
    [rows] = await pool.query(
      'SELECT * FROM sales_order_item_materials WHERE drawing_no = ? AND sales_order_item_id IS NULL ORDER BY created_at ASC',
      [drawingNo]
    );
    
    // Fallback: If no Master BOM, try finding any BOM for this drawing
    if (rows.length === 0) {
      [rows] = await pool.query(
        'SELECT * FROM sales_order_item_materials WHERE drawing_no = ? ORDER BY created_at ASC LIMIT 100',
        [drawingNo]
      );
      // Filter to get unique materials by name for this drawing
      if (rows.length > 0) {
        const uniqueMap = new Map();
        rows.forEach(r => {
          const key = (r.material_name || '').toUpperCase().trim();
          if (key && !uniqueMap.has(key)) {
            uniqueMap.set(key, r);
          }
        });
        rows = Array.from(uniqueMap.values());
      }
    }
  }
  return rows;
};

const getItemComponents = async (itemId, itemCode = null, drawingNo = null) => {
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  let rows = [];

  const query = `
    SELECT c.*, 
           COALESCE(c.material_name, sb.material_name) as material_name,
           COALESCE(c.material_type, sb.material_type) as material_type,
           COALESCE(c.item_group, sb.item_group, soi.item_group) as item_group,
           COALESCE(c.product_type, sb.product_type) as product_type
    FROM sales_order_item_components c
    LEFT JOIN stock_balance sb ON c.component_code = sb.item_code
    LEFT JOIN (
      SELECT item_code, MAX(item_group) as item_group
      FROM sales_order_items
      GROUP BY item_code
    ) soi ON c.component_code = soi.item_code
  `;

  if (parsedItemId) {
    [rows] = await pool.query(
      `${query} WHERE c.sales_order_item_id = ? ORDER BY c.created_at ASC`,
      [parsedItemId]
    );
  }
  
  if (rows.length === 0 && itemCode) {
    [rows] = await pool.query(
      `${query} WHERE c.item_code = ? AND c.sales_order_item_id IS NULL ORDER BY c.created_at ASC`,
      [itemCode]
    );
  }

  if (rows.length === 0 && drawingNo) {
    [rows] = await pool.query(
      `${query} WHERE c.drawing_no = ? AND c.sales_order_item_id IS NULL ORDER BY c.created_at ASC`,
      [drawingNo]
    );

    // Fallback: If no Master BOM, try finding any BOM for this drawing
    if (rows.length === 0) {
      [rows] = await pool.query(
        `${query} WHERE c.drawing_no = ? ORDER BY c.created_at ASC LIMIT 100`,
        [drawingNo]
      );
      if (rows.length > 0) {
        const uniqueMap = new Map();
        rows.forEach(r => {
          const key = (r.component_code || r.material_name || '').toUpperCase().trim();
          if (key && !uniqueMap.has(key)) {
            uniqueMap.set(key, r);
          }
        });
        rows = Array.from(uniqueMap.values());
      }
    }
  }
  return rows;
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
  
  if (rows.length === 0 && itemCode) {
    [rows] = await pool.query(
      'SELECT * FROM sales_order_item_operations WHERE item_code = ? AND sales_order_item_id IS NULL ORDER BY created_at ASC',
      [itemCode]
    );
  }

  if (rows.length === 0 && drawingNo) {
    [rows] = await pool.query(
      'SELECT * FROM sales_order_item_operations WHERE drawing_no = ? AND sales_order_item_id IS NULL ORDER BY created_at ASC',
      [drawingNo]
    );

    // Fallback: If no Master BOM, try finding any BOM for this drawing
    if (rows.length === 0) {
      [rows] = await pool.query(
        'SELECT * FROM sales_order_item_operations WHERE drawing_no = ? ORDER BY created_at ASC LIMIT 100',
        [drawingNo]
      );
      if (rows.length > 0) {
        const uniqueMap = new Map();
        rows.forEach(r => {
          const key = (r.operation_name || '').toUpperCase().trim();
          if (key && !uniqueMap.has(key)) {
            uniqueMap.set(key, r);
          }
        });
        rows = Array.from(uniqueMap.values());
      }
    }
  }
  return rows;
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
  
  if (rows.length === 0 && itemCode) {
    [rows] = await pool.query(
      'SELECT * FROM sales_order_item_scrap WHERE item_code = ? AND sales_order_item_id IS NULL ORDER BY created_at ASC',
      [itemCode]
    );
  }

  if (rows.length === 0 && drawingNo) {
    [rows] = await pool.query(
      'SELECT * FROM sales_order_item_scrap WHERE drawing_no = ? AND sales_order_item_id IS NULL ORDER BY created_at ASC',
      [drawingNo]
    );

    // Fallback: If no Master BOM, try finding any BOM for this drawing
    if (rows.length === 0) {
      [rows] = await pool.query(
        'SELECT * FROM sales_order_item_scrap WHERE drawing_no = ? ORDER BY created_at ASC LIMIT 100',
        [drawingNo]
      );
      if (rows.length > 0) {
        const uniqueMap = new Map();
        rows.forEach(r => {
          const key = (r.scrap_item_code || r.item_name || '').toUpperCase().trim();
          if (key && !uniqueMap.has(key)) {
            uniqueMap.set(key, r);
          }
        });
        rows = Array.from(uniqueMap.values());
      }
    }
  }
  return rows;
};

const addItemMaterial = async (itemId, materialData) => {
  const { itemCode, drawingNo, materialName, materialType, itemGroup, productType, qtyPerPc, uom, rate, warehouse, operation, parentId, description } = materialData;
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  const [result] = await pool.execute(
    'INSERT INTO sales_order_item_materials (sales_order_item_id, item_code, drawing_no, parent_id, material_name, material_type, item_group, product_type, qty_per_pc, uom, rate, warehouse, operation, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [parsedItemId, itemCode || null, drawingNo || null, parentId || null, materialName || null, materialType || null, itemGroup || null, productType || null, qtyPerPc || null, uom || null, rate || 0, warehouse || null, operation || null, description || null]
  );
  return result.insertId;
};

const addComponent = async (itemId, componentData) => {
  const { itemCode, drawingNo, componentCode, materialName, materialType, itemGroup, productType, description, quantity, uom, rate, lossPercent, notes, parentId } = componentData;
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  const [result] = await pool.execute(
    'INSERT INTO sales_order_item_components (sales_order_item_id, item_code, drawing_no, parent_id, component_code, material_name, material_type, item_group, product_type, description, quantity, uom, rate, loss_percent, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [parsedItemId, itemCode || null, drawingNo || null, parentId || null, componentCode || null, materialName || null, materialType || null, itemGroup || null, productType || null, description || null, quantity || null, uom || null, rate || null, lossPercent || null, notes || null]
  );
  return result.insertId;
};

const addOperation = async (itemId, operationData) => {
  const { itemCode, drawingNo, operationName, workstation, cycleTimeMin, setupTimeMin, hourlyRate, operationType, targetWarehouse } = operationData;
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  const [result] = await pool.execute(
    'INSERT INTO sales_order_item_operations (sales_order_item_id, item_code, drawing_no, operation_name, workstation, cycle_time_min, setup_time_min, hourly_rate, operation_type, target_warehouse) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [parsedItemId, itemCode || null, drawingNo || null, operationName || null, workstation || null, cycleTimeMin || null, setupTimeMin || null, hourlyRate || null, operationType || null, targetWarehouse || null]
  );
  return result.insertId;
};

const addScrap = async (itemId, scrapData) => {
  const { parentItemCode, drawingNo, scrapItemCode, itemCode, itemName, materialType, itemGroup, productType, inputQty, lossPercent, rate, parentId } = scrapData;
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  const [result] = await pool.execute(
    'INSERT INTO sales_order_item_scrap (sales_order_item_id, item_code, drawing_no, parent_id, scrap_item_code, item_name, material_type, item_group, product_type, input_qty, loss_percent, rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      parsedItemId, 
      parentItemCode || null, 
      drawingNo || null,
      parentId || null,
      scrapItemCode || itemCode || null, 
      itemName || null, 
      materialType || null,
      itemGroup || null,
      productType || null,
      inputQty || 0, 
      lossPercent || 0, 
      rate || 0
    ]
  );
  return result.insertId;
};

const updateItemMaterial = async (materialId, materialData) => {
  const { materialName, materialType, itemGroup, productType, qtyPerPc, uom, rate, warehouse, operation, description } = materialData;
  await pool.execute(
    'UPDATE sales_order_item_materials SET material_name = ?, material_type = ?, item_group = ?, product_type = ?, qty_per_pc = ?, uom = ?, rate = ?, warehouse = ?, operation = ?, description = ? WHERE id = ?',
    [materialName || null, materialType || null, itemGroup || null, productType || null, qtyPerPc || null, uom || null, rate || 0, warehouse || null, operation || null, description || null, materialId]
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
  const { itemId, salesOrderId, productForm, materials, components, operations, scrap, source, costing } = bomData;
  console.log(`[createBOMRequest] ItemID: ${itemId}, SOID: ${salesOrderId}, Source: ${source}, Drawing: ${productForm.drawingNo}`);
  
  const { itemCode, itemGroup, uom, revision, description, isActive, isDefault, quantity, drawingNo, drawing_id } = productForm;
  const bom_cost = costing?.costPerUnit || 0;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const isMasterBOM = source === 'stock' || (!itemId && !salesOrderId);
    const safeItemCode = itemCode || null;

    let targetIds = [];

    if (itemId) {
      // 1. Update specific sales_order_item
      await connection.execute(
        `UPDATE sales_order_items 
         SET item_code = ?, item_group = ?, unit = ?, revision_no = ?, description = ?, is_active = ?, is_default = ?, drawing_no = ?, drawing_id = ?, bom_cost = ?
         WHERE id = ?`,
        [
          safeItemCode, 
          itemGroup || null, 
          uom || null, 
          revision || null, 
          description || null, 
          isActive ? 1 : 0, 
          isDefault ? 1 : 0, 
          drawingNo || null, 
          drawing_id || null, 
          bom_cost,
          itemId
        ]
      );

      // 2. Update parent sales order status
      const [itemRows] = await connection.query('SELECT sales_order_id FROM sales_order_items WHERE id = ?', [itemId]);
      if (itemRows.length > 0) {
        await connection.execute(
          "UPDATE sales_orders SET status = 'BOM_SUBMITTED', updated_at = NOW() WHERE id = ?",
          [itemRows[0].sales_order_id]
        );
      }
      targetIds.push(itemId);
    } else if (salesOrderId) {
      // User created a BOM for a specific Sales Order from Drawing Header
      // Check if any items in that Sales Order match this drawing/code
      const [matchingItems] = await connection.query(
        'SELECT id FROM sales_order_items WHERE sales_order_id = ? AND (drawing_no = ? OR item_code = ?)',
        [salesOrderId, drawingNo || '___NONE___', safeItemCode || '___NONE___']
      );

      if (matchingItems.length > 0) {
        // Link to existing items
        targetIds = matchingItems.map(m => m.id);
        
        // Update their details too
        for (const tid of targetIds) {
          await connection.execute(
            `UPDATE sales_order_items SET item_code = ?, item_group = ?, unit = ?, revision_no = ?, description = ?, drawing_no = ?, drawing_id = ?, bom_cost = ? WHERE id = ?`,
            [safeItemCode, itemGroup || null, uom || null, revision || null, description || null, drawingNo || null, drawing_id || null, bom_cost, tid]
          );
        }
      } else {
        // Create a NEW item only if no matching one exists
        const [result] = await connection.execute(
          `INSERT INTO sales_order_items 
           (sales_order_id, item_code, item_group, unit, revision_no, description, is_active, is_default, quantity, drawing_no, drawing_id, bom_cost)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            salesOrderId, safeItemCode, itemGroup || null, uom || null, revision || null, description || null, 
            isActive ? 1 : 0, isDefault ? 1 : 0, quantity || 0, drawingNo || null, drawing_id || null, bom_cost
          ]
        );
        targetIds.push(result.insertId);
      }

      // Update sales order status
      await connection.execute(
        "UPDATE sales_orders SET status = 'BOM_SUBMITTED', updated_at = NOW() WHERE id = ?",
        [salesOrderId]
      );
    }

    // ALWAYS update the Master BOM (linkId = null) if it's from design/stock or no specific item
    if (source === 'design' || source === 'stock' || !itemId) {
      targetIds.push(null);
    }

    // Clear existing BOM items for ALL targets
    for (const tid of targetIds) {
      if (tid) {
        await connection.execute('DELETE FROM sales_order_item_materials WHERE sales_order_item_id = ?', [tid]);
        await connection.execute('DELETE FROM sales_order_item_components WHERE sales_order_item_id = ?', [tid]);
        await connection.execute('DELETE FROM sales_order_item_operations WHERE sales_order_item_id = ?', [tid]);
        await connection.execute('DELETE FROM sales_order_item_scrap WHERE sales_order_item_id = ?', [tid]);
      } else {
        // Clear Master BOM entries
        if (drawingNo) {
          await connection.execute('DELETE FROM sales_order_item_materials WHERE drawing_no = ? AND sales_order_item_id IS NULL AND item_code IS NULL', [drawingNo]);
          await connection.execute('DELETE FROM sales_order_item_components WHERE drawing_no = ? AND sales_order_item_id IS NULL AND item_code IS NULL', [drawingNo]);
          await connection.execute('DELETE FROM sales_order_item_operations WHERE drawing_no = ? AND sales_order_item_id IS NULL AND item_code IS NULL', [drawingNo]);
          await connection.execute('DELETE FROM sales_order_item_scrap WHERE drawing_no = ? AND sales_order_item_id IS NULL AND item_code IS NULL', [drawingNo]);
        }
        if (safeItemCode) {
          await connection.execute('DELETE FROM sales_order_item_materials WHERE item_code = ? AND sales_order_item_id IS NULL', [safeItemCode]);
          await connection.execute('DELETE FROM sales_order_item_components WHERE item_code = ? AND sales_order_item_id IS NULL', [safeItemCode]);
          await connection.execute('DELETE FROM sales_order_item_operations WHERE item_code = ? AND sales_order_item_id IS NULL', [safeItemCode]);
          await connection.execute('DELETE FROM sales_order_item_scrap WHERE item_code = ? AND sales_order_item_id IS NULL', [safeItemCode]);
        }
      }
    }

    // 3. Insert new BOM items
    for (const linkId of targetIds) {
      const idMap = {}; 
      const componentUpdateList = []; 

      if (components && components.length > 0) {
        for (const c of components) {
          const [result] = await connection.execute(
            'INSERT INTO sales_order_item_components (sales_order_item_id, item_code, drawing_no, parent_id, component_code, material_name, material_type, item_group, product_type, description, quantity, uom, rate, loss_percent, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              linkId, 
              safeItemCode, 
              drawingNo || null,
              null, // Temporarily set parent_id to null
              c.component_code || c.componentCode || null, 
              c.material_name || c.materialName || null,
              c.material_type || c.materialType || null,
              c.item_group || c.itemGroup || null,
              c.product_type || c.productType || null,
              c.description || null, 
              c.quantity || 0, 
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
            'INSERT INTO sales_order_item_materials (sales_order_item_id, item_code, drawing_no, parent_id, material_name, material_type, item_group, product_type, qty_per_pc, uom, rate, warehouse, operation, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              linkId, 
              safeItemCode, 
              drawingNo || null,
              newParentId,
              m.material_name || null, 
              m.material_type || null, 
              m.item_group || null, 
              m.product_type || m.productType || null,
              m.qty_per_pc || 0, 
              m.uom || null, 
              m.rate || 0, 
              m.warehouse || null, 
              m.operation || null,
              m.description || null
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
              o.operation_name || null, 
              o.workstation || null, 
              o.cycle_time_min || 0, 
              o.setup_time_min || 0, 
              o.hourly_rate || 0, 
              o.operation_type || 'In-House', 
              o.target_warehouse || null
            ]
          );
        }
      }

      if (scrap && scrap.length > 0) {
        for (const s of scrap) {
          const oldParentId = s.parent_id || s.parentId;
          const newParentId = oldParentId ? idMap[oldParentId] : null;

          await connection.execute(
            'INSERT INTO sales_order_item_scrap (sales_order_item_id, item_code, drawing_no, parent_id, scrap_item_code, item_name, material_type, item_group, product_type, input_qty, loss_percent, rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              linkId, 
              safeItemCode, 
              drawingNo || null,
              newParentId,
              s.scrap_item_code || s.item_code || null, 
              s.item_name || null, 
              s.material_type || s.materialType || null,
              s.item_group || s.itemGroup || null,
              s.product_type || s.productType || null,
              s.input_qty || 0, 
              s.loss_percent || 0, 
              s.rate || 0
            ]
          );
        }
      }
    }

    // 4. Update sales_order status (only if linked to sales order)
    if (itemId) {
      const [itemRows] = await connection.query(
        'SELECT sales_order_id FROM sales_order_items WHERE id = ?',
        [itemId]
      );

      if (itemRows.length > 0) {
        const salesOrderId = itemRows[0].sales_order_id;
        await connection.execute(
          "UPDATE sales_orders SET status = 'BOM_SUBMITTED', updated_at = NOW() WHERE id = ?",
          [salesOrderId]
        );
      }
    } else if (drawingNo) {
      // Handled in the loop above for drawingNo based creation
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
    JOIN sales_orders so ON soi.sales_order_id = so.id
    JOIN companies c ON so.company_id = c.id
    WHERE (so.status IN ('BOM_SUBMITTED', 'BOM_APPROVED', 'PROCUREMENT_IN_PROGRESS', 'IN_PRODUCTION', 'PRODUCTION_COMPLETED')
           OR soi.bom_cost > 0)
    AND (
      EXISTS (SELECT 1 FROM sales_order_item_materials WHERE sales_order_item_id = soi.id OR (item_code = soi.item_code AND sales_order_item_id IS NULL) OR (drawing_no = soi.drawing_no AND sales_order_item_id IS NULL AND item_code IS NULL))
      OR EXISTS (SELECT 1 FROM sales_order_item_components WHERE sales_order_item_id = soi.id OR (item_code = soi.item_code AND sales_order_item_id IS NULL) OR (drawing_no = soi.drawing_no AND sales_order_item_id IS NULL AND item_code IS NULL))
      OR EXISTS (SELECT 1 FROM sales_order_item_operations WHERE sales_order_item_id = soi.id OR (item_code = soi.item_code AND sales_order_item_id IS NULL) OR (drawing_no = soi.drawing_no AND sales_order_item_id IS NULL AND item_code IS NULL))
      OR EXISTS (SELECT 1 FROM sales_order_item_scrap WHERE sales_order_item_id = soi.id OR (item_code = soi.item_code AND sales_order_item_id IS NULL) OR (drawing_no = soi.drawing_no AND sales_order_item_id IS NULL AND item_code IS NULL))
    )

    UNION

    SELECT DISTINCT
      CONCAT('MASTER:', COALESCE(m.item_code, ''), ':', COALESCE(m.drawing_no, '')) as id,
      m.item_code,
      COALESCE(sb.item_group, 'FG') as item_group,
      m.drawing_no,
      'Master BOM' as description,
      'NOS' as unit,
      1 as quantity,
      0 as bom_cost,
      'Master' as company_name,
      'Master Repository' as project_name,
      NULL as sales_order_id,
      m.created_at
    FROM sales_order_item_materials m
    LEFT JOIN stock_balance sb ON m.item_code = sb.item_code
    WHERE m.sales_order_item_id IS NULL AND (m.item_code IS NOT NULL OR m.drawing_no IS NOT NULL)

    UNION

    SELECT DISTINCT
      CONCAT('MASTER:', COALESCE(m.item_code, ''), ':', COALESCE(m.drawing_no, '')) as id,
      m.item_code,
      COALESCE(sb.item_group, 'FG') as item_group,
      m.drawing_no,
      'Master BOM' as description,
      'NOS' as unit,
      1 as quantity,
      0 as bom_cost,
      'Master' as company_name,
      'Master Repository' as project_name,
      NULL as sales_order_id,
      m.created_at
    FROM sales_order_item_components m
    LEFT JOIN stock_balance sb ON m.item_code = sb.item_code
    WHERE m.sales_order_item_id IS NULL AND (m.item_code IS NOT NULL OR m.drawing_no IS NOT NULL)

    UNION

    SELECT DISTINCT
      CONCAT('MASTER:', COALESCE(m.item_code, ''), ':', COALESCE(m.drawing_no, '')) as id,
      m.item_code,
      COALESCE(sb.item_group, 'FG') as item_group,
      m.drawing_no,
      'Master BOM' as description,
      'NOS' as unit,
      1 as quantity,
      0 as bom_cost,
      'Master' as company_name,
      'Master Repository' as project_name,
      NULL as sales_order_id,
      m.created_at
    FROM sales_order_item_operations m
    LEFT JOIN stock_balance sb ON m.item_code = sb.item_code
    WHERE m.sales_order_item_id IS NULL AND (m.item_code IS NOT NULL OR m.drawing_no IS NOT NULL)

    ORDER BY created_at DESC
  `);
  return rows;
};

const deleteBOM = async (itemId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Get item details to identify related Master BOMs
    const [items] = await connection.query(
      'SELECT item_code, drawing_no FROM sales_order_items WHERE id = ?',
      [itemId]
    );
    
    if (items.length > 0) {
      const { item_code, drawing_no } = items[0];

      // 2. Delete item-specific BOM entries
      await connection.execute('DELETE FROM sales_order_item_materials WHERE sales_order_item_id = ?', [itemId]);
      await connection.execute('DELETE FROM sales_order_item_components WHERE sales_order_item_id = ?', [itemId]);
      await connection.execute('DELETE FROM sales_order_item_operations WHERE sales_order_item_id = ?', [itemId]);
      await connection.execute('DELETE FROM sales_order_item_scrap WHERE sales_order_item_id = ?', [itemId]);

      // 3. Delete Master BOM entries for this item/drawing to prevent fallback
      // Only if sales_order_item_id is NULL
      if (item_code) {
        await connection.execute('DELETE FROM sales_order_item_materials WHERE item_code = ? AND sales_order_item_id IS NULL', [item_code]);
        await connection.execute('DELETE FROM sales_order_item_components WHERE item_code = ? AND sales_order_item_id IS NULL', [item_code]);
        await connection.execute('DELETE FROM sales_order_item_operations WHERE item_code = ? AND sales_order_item_id IS NULL', [item_code]);
        await connection.execute('DELETE FROM sales_order_item_scrap WHERE item_code = ? AND sales_order_item_id IS NULL', [item_code]);
      }
      
      if (drawing_no) {
        await connection.execute('DELETE FROM sales_order_item_materials WHERE drawing_no = ? AND sales_order_item_id IS NULL AND item_code IS NULL', [drawing_no]);
        await connection.execute('DELETE FROM sales_order_item_components WHERE drawing_no = ? AND sales_order_item_id IS NULL AND item_code IS NULL', [drawing_no]);
        await connection.execute('DELETE FROM sales_order_item_operations WHERE drawing_no = ? AND sales_order_item_id IS NULL AND item_code IS NULL', [drawing_no]);
        await connection.execute('DELETE FROM sales_order_item_scrap WHERE drawing_no = ? AND sales_order_item_id IS NULL AND item_code IS NULL', [drawing_no]);
      }

      // 4. Also delete for any OTHER sales_order_items that might have inherited this BOM via the same drawing_no
      // This is because createBOMRequest by drawingNo duplicates the BOM for all items.
      // If we are deleting the BOM for the drawing, we should probably clear it for all of them.
      if (drawing_no) {
        const [matchingItems] = await connection.query(
          'SELECT id FROM sales_order_items WHERE drawing_no = ? AND id != ?',
          [drawing_no, itemId]
        );
        for (const mItem of matchingItems) {
          await connection.execute('DELETE FROM sales_order_item_materials WHERE sales_order_item_id = ?', [mItem.id]);
          await connection.execute('DELETE FROM sales_order_item_components WHERE sales_order_item_id = ?', [mItem.id]);
          await connection.execute('DELETE FROM sales_order_item_operations WHERE sales_order_item_id = ?', [mItem.id]);
          await connection.execute('DELETE FROM sales_order_item_scrap WHERE sales_order_item_id = ?', [mItem.id]);
          await connection.execute('UPDATE sales_order_items SET bom_cost = 0 WHERE id = ?', [mItem.id]);
        }
      }
    }

    // Reset bom_cost in sales_order_items
    await connection.execute('UPDATE sales_order_items SET bom_cost = 0 WHERE id = ?', [itemId]);

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const explodeBOM = async (itemId, itemCode, drawingNo, parentQty = 1, visited = new Set()) => {
  const key = `${itemId}-${itemCode}-${drawingNo}`;
  if (visited.has(key)) return [];
  visited.add(key);

  let allMaterials = [];

  // 1. Get materials for this level
  const materials = await getItemMaterials(itemId, itemCode, drawingNo);
  for (const m of materials) {
    const isSubAssembly = (m.item_group || '').toLowerCase().includes('assembly') || 
                          (m.item_group || '').toLowerCase() === 'sa' || 
                          (m.item_group || '').toLowerCase() === 'fg' || 
                          (m.item_group || '').toLowerCase().includes('finished');

    allMaterials.push({
      material_name: m.material_name,
      component_code: isSubAssembly ? m.material_name : null,
      material_type: m.material_type,
      item_group: m.item_group,
      product_type: m.product_type,
      uom: m.uom,
      qty_per_pc: parseFloat(m.qty_per_pc || 0) * parentQty
    });

    // If this "material" is actually a Sub-Assembly or FG, explode it too
    if (isSubAssembly) {
      const subMaterials = await explodeBOM(null, m.material_name, null, parseFloat(m.qty_per_pc || 0) * parentQty, visited);
      allMaterials = allMaterials.concat(subMaterials);
    }
  }

  // 2. Get components for this level
  const components = await getItemComponents(itemId, itemCode, drawingNo);
  for (const c of components) {
    // Include the component itself as a requirement
    allMaterials.push({
      material_name: c.material_name || c.component_code,
      component_code: c.component_code,
      material_type: c.material_type || 'Sub Assembly',
      item_group: c.item_group || 'Sub Assembly',
      product_type: c.product_type,
      uom: c.uom,
      qty_per_pc: parseFloat(c.quantity || 0) * parentQty
    });

    // Recursively explode this component
    const subMaterials = await explodeBOM(null, c.component_code, null, parseFloat(c.quantity || 0) * parentQty, visited);
    allMaterials = allMaterials.concat(subMaterials);
  }

  return allMaterials;
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
  deleteItemMaterial,
  deleteComponent,
  deleteOperation,
  deleteScrap,
  getBOMBySalesOrder,
  getApprovedBOMs,
  createBOMRequest,
  deleteBOM,
  explodeBOM
};
