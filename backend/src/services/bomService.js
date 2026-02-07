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
  
  // If we didn't find SO-specific materials, or we are specifically looking for Master materials
  if (rows.length === 0) {
    if (itemCode && drawingNo) {
      [rows] = await pool.query(
        'SELECT * FROM sales_order_item_materials WHERE sales_order_item_id IS NULL AND item_code = ? AND drawing_no = ? ORDER BY created_at ASC',
        [itemCode, drawingNo]
      );
    } else if (itemCode) {
      [rows] = await pool.query(
        'SELECT * FROM sales_order_item_materials WHERE sales_order_item_id IS NULL AND item_code = ? ORDER BY created_at ASC',
        [itemCode]
      );
    } else if (drawingNo) {
      [rows] = await pool.query(
        'SELECT * FROM sales_order_item_materials WHERE sales_order_item_id IS NULL AND drawing_no = ? ORDER BY created_at ASC',
        [drawingNo]
      );
    }
  }
  return rows;
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
  
  if (rows.length === 0) {
    if (itemCode && drawingNo) {
      [rows] = await pool.query(
        'SELECT * FROM sales_order_item_components WHERE sales_order_item_id IS NULL AND item_code = ? AND drawing_no = ? ORDER BY created_at ASC',
        [itemCode, drawingNo]
      );
    } else if (itemCode) {
      [rows] = await pool.query(
        'SELECT * FROM sales_order_item_components WHERE sales_order_item_id IS NULL AND item_code = ? ORDER BY created_at ASC',
        [itemCode]
      );
    } else if (drawingNo) {
      [rows] = await pool.query(
        'SELECT * FROM sales_order_item_components WHERE sales_order_item_id IS NULL AND drawing_no = ? ORDER BY created_at ASC',
        [drawingNo]
      );
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
  
  if (rows.length === 0) {
    if (itemCode && drawingNo) {
      [rows] = await pool.query(
        'SELECT * FROM sales_order_item_operations WHERE sales_order_item_id IS NULL AND item_code = ? AND drawing_no = ? ORDER BY created_at ASC',
        [itemCode, drawingNo]
      );
    } else if (itemCode) {
      [rows] = await pool.query(
        'SELECT * FROM sales_order_item_operations WHERE sales_order_item_id IS NULL AND item_code = ? ORDER BY created_at ASC',
        [itemCode]
      );
    } else if (drawingNo) {
      [rows] = await pool.query(
        'SELECT * FROM sales_order_item_operations WHERE sales_order_item_id IS NULL AND drawing_no = ? ORDER BY created_at ASC',
        [drawingNo]
      );
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
  }
  return rows;
};

const addItemMaterial = async (itemId, materialData) => {
  const { itemCode, drawingNo, materialName, materialType, itemGroup, qtyPerPc, uom, rate, warehouse, operation, parentId, description } = materialData;
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  const [result] = await pool.execute(
    'INSERT INTO sales_order_item_materials (sales_order_item_id, item_code, drawing_no, parent_id, material_name, material_type, item_group, qty_per_pc, uom, rate, warehouse, operation, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [parsedItemId, itemCode || null, drawingNo || null, parentId || null, materialName || null, materialType || null, itemGroup || null, qtyPerPc || null, uom || null, rate || 0, warehouse || null, operation || null, description || null]
  );
  return result.insertId;
};

const addComponent = async (itemId, componentData) => {
  const { itemCode, drawingNo, componentCode, description, quantity, uom, rate, lossPercent, notes, parentId } = componentData;
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  const [result] = await pool.execute(
    'INSERT INTO sales_order_item_components (sales_order_item_id, item_code, drawing_no, parent_id, component_code, description, quantity, uom, rate, loss_percent, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [parsedItemId, itemCode || null, drawingNo || null, parentId || null, componentCode || null, description || null, quantity || null, uom || null, rate || null, lossPercent || null, notes || null]
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
  const { materialName, materialType, itemGroup, qtyPerPc, uom, rate, warehouse, operation, description } = materialData;
  await pool.execute(
    'UPDATE sales_order_item_materials SET material_name = ?, material_type = ?, item_group = ?, qty_per_pc = ?, uom = ?, rate = ?, warehouse = ?, operation = ?, description = ? WHERE id = ?',
    [materialName || null, materialType || null, itemGroup || null, qtyPerPc || null, uom || null, rate || 0, warehouse || null, operation || null, description || null, materialId]
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
         SET item_code = ?, item_type = ?, item_group = ?, unit = ?, revision_no = ?, description = ?, is_active = ?, is_default = ?, drawing_no = ?, drawing_id = ?, bom_cost = ?
         WHERE id = ?`,
        [
          safeItemCode, 
          itemType,
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

      // Clear existing BOM items for this sales order item
      await connection.execute('DELETE FROM sales_order_item_materials WHERE sales_order_item_id = ?', [itemId]);
      await connection.execute('DELETE FROM sales_order_item_components WHERE sales_order_item_id = ?', [itemId]);
      await connection.execute('DELETE FROM sales_order_item_operations WHERE sales_order_item_id = ?', [itemId]);
      await connection.execute('DELETE FROM sales_order_item_scrap WHERE sales_order_item_id = ?', [itemId]);
    } else if (salesOrderId) {
      // User created a NEW BOM for a specific Sales Order from Drawing Header
      // Check if an item with this drawing_no already exists in this Sales Order to avoid duplicates
      const [existingItems] = await connection.query(
        'SELECT id FROM sales_order_items WHERE sales_order_id = ? AND drawing_no = ? AND (bom_cost IS NULL OR bom_cost = 0) LIMIT 1',
        [salesOrderId, drawingNo]
      );

      if (existingItems.length > 0) {
        targetItemId = existingItems[0].id;
        await connection.execute(
          `UPDATE sales_order_items 
           SET item_code = ?, item_type = ?, item_group = ?, unit = ?, revision_no = ?, description = ?, is_active = ?, is_default = ?, drawing_no = ?, drawing_id = ?, bom_cost = ?
           WHERE id = ?`,
          [
            safeItemCode, 
            itemType,
            itemGroup || null, 
            uom || null, 
            revision || null, 
            description || null, 
            isActive ? 1 : 0, 
            isDefault ? 1 : 0, 
            drawingNo || null, 
            drawing_id || null, 
            bom_cost,
            targetItemId
          ]
        );
        // Clear existing BOM items
        await connection.execute('DELETE FROM sales_order_item_materials WHERE sales_order_item_id = ?', [targetItemId]);
        await connection.execute('DELETE FROM sales_order_item_components WHERE sales_order_item_id = ?', [targetItemId]);
        await connection.execute('DELETE FROM sales_order_item_operations WHERE sales_order_item_id = ?', [targetItemId]);
        await connection.execute('DELETE FROM sales_order_item_scrap WHERE sales_order_item_id = ?', [targetItemId]);
      } else {
        const [result] = await connection.execute(
          `INSERT INTO sales_order_items 
           (sales_order_id, item_code, item_type, item_group, unit, revision_no, description, is_active, is_default, quantity, drawing_no, drawing_id, bom_cost)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            salesOrderId,
            safeItemCode,
            itemType,
            itemGroup || null,
            uom || null,
            revision || null,
            description || null,
            isActive ? 1 : 0,
            isDefault ? 1 : 0,
            quantity || 0,
            drawingNo || null,
            drawing_id || null,
            bom_cost
          ]
        );
        targetItemId = result.insertId;
      }
    } else if (drawingNo) {
      // Handle Master BOM by Drawing (no itemId, no salesOrderId)
      // Link this BOM to ALL sales_order_items that have this drawing_no ONLY if they are PENDING (optional logic?)
      // BUT as per user request "don't update previous one", let's ONLY update the Master BOM (template)
      // and NOT overwrite existing items if they click it from a contextless "Create BOM"
      
      // Clear Master BOM entries for this drawing
      await connection.execute('DELETE FROM sales_order_item_materials WHERE drawing_no = ? AND sales_order_item_id IS NULL AND item_code IS NULL', [drawingNo]);
      await connection.execute('DELETE FROM sales_order_item_components WHERE drawing_no = ? AND sales_order_item_id IS NULL AND item_code IS NULL', [drawingNo]);
      await connection.execute('DELETE FROM sales_order_item_operations WHERE drawing_no = ? AND sales_order_item_id IS NULL AND item_code IS NULL', [drawingNo]);
      await connection.execute('DELETE FROM sales_order_item_scrap WHERE drawing_no = ? AND sales_order_item_id IS NULL AND item_code IS NULL', [drawingNo]);
    } else if (safeItemCode) {
      // Handle Master BOM by Item Code
      await connection.execute('DELETE FROM sales_order_item_materials WHERE item_code = ? AND sales_order_item_id IS NULL', [safeItemCode]);
      await connection.execute('DELETE FROM sales_order_item_components WHERE item_code = ? AND sales_order_item_id IS NULL', [safeItemCode]);
      await connection.execute('DELETE FROM sales_order_item_operations WHERE item_code = ? AND sales_order_item_id IS NULL', [safeItemCode]);
      await connection.execute('DELETE FROM sales_order_item_scrap WHERE item_code = ? AND sales_order_item_id IS NULL', [safeItemCode]);
    }

    // 3. Insert new BOM items
    let targetIds = [];
    if (targetItemId) {
      targetIds = [{ id: targetItemId }];
    } else {
      // For Master BOM
      targetIds = [{ id: null }];
    }
    
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
            'INSERT INTO sales_order_item_materials (sales_order_item_id, item_code, drawing_no, parent_id, material_name, material_type, item_group, qty_per_pc, uom, rate, warehouse, operation, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              linkId, 
              safeItemCode, 
              drawingNo || null,
              newParentId,
              m.material_name || null, 
              m.material_type || null, 
              m.item_group || null, 
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
            'INSERT INTO sales_order_item_scrap (sales_order_item_id, item_code, drawing_no, parent_id, scrap_item_code, item_name, input_qty, loss_percent, rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              linkId, 
              safeItemCode, 
              drawingNo || null,
              newParentId,
              s.scrap_item_code || s.item_code || null, 
              s.item_name || null, 
              s.input_qty || 0, 
              s.loss_percent || 0, 
              s.rate || 0
            ]
          );
        }
      }
    }

    // 4. Update sales_order status (only if linked to sales order)
    let finalSalesOrderId = salesOrderId;
    if (!finalSalesOrderId && itemId) {
      const [itemRows] = await connection.query(
        'SELECT sales_order_id FROM sales_order_items WHERE id = ?',
        [itemId]
      );

      if (itemRows.length > 0) {
        finalSalesOrderId = itemRows[0].sales_order_id;
      }
    }

    if (finalSalesOrderId) {
      await connection.execute(
        "UPDATE sales_orders SET status = 'BOM_SUBMITTED', updated_at = NOW() WHERE id = ?",
        [finalSalesOrderId]
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
    WHERE so.status IN ('BOM_SUBMITTED', 'BOM_APPROVED', 'PROCUREMENT_IN_PROGRESS', 'IN_PRODUCTION', 'PRODUCTION_COMPLETED')
    AND (
      EXISTS (SELECT 1 FROM sales_order_item_materials WHERE sales_order_item_id = soi.id OR (item_code = soi.item_code AND sales_order_item_id IS NULL) OR (drawing_no = soi.drawing_no AND sales_order_item_id IS NULL AND item_code IS NULL))
      OR EXISTS (SELECT 1 FROM sales_order_item_components WHERE sales_order_item_id = soi.id OR (item_code = soi.item_code AND sales_order_item_id IS NULL) OR (drawing_no = soi.drawing_no AND sales_order_item_id IS NULL AND item_code IS NULL))
      OR EXISTS (SELECT 1 FROM sales_order_item_operations WHERE sales_order_item_id = soi.id OR (item_code = soi.item_code AND sales_order_item_id IS NULL) OR (drawing_no = soi.drawing_no AND sales_order_item_id IS NULL AND item_code IS NULL))
      OR EXISTS (SELECT 1 FROM sales_order_item_scrap WHERE sales_order_item_id = soi.id OR (item_code = soi.item_code AND sales_order_item_id IS NULL) OR (drawing_no = soi.drawing_no AND sales_order_item_id IS NULL AND item_code IS NULL))
    )
    ORDER BY soi.created_at DESC
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
  let [rows] = await pool.query(`
    SELECT id FROM sales_order_items 
    WHERE (item_code = ? OR (drawing_no = ? AND drawing_no IS NOT NULL))
    AND (
      EXISTS (SELECT 1 FROM sales_order_item_materials WHERE sales_order_item_id = sales_order_items.id)
      OR EXISTS (SELECT 1 FROM sales_order_item_components WHERE sales_order_item_id = sales_order_items.id)
      OR EXISTS (SELECT 1 FROM sales_order_item_operations WHERE sales_order_item_id = sales_order_items.id)
    )
    ORDER BY updated_at DESC LIMIT 1
  `, [itemCode, drawingNo]);

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
