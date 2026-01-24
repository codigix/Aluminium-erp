const pool = require('../config/db');

const getItemMaterials = async (itemId, itemCode = null) => {
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
  return rows;
};

const getItemComponents = async (itemId, itemCode = null) => {
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  let rows = [];
  if (parsedItemId) {
    [rows] = await pool.query(
      'SELECT * FROM sales_order_item_components WHERE sales_order_item_id = ? ORDER BY created_at ASC',
      [parsedItemId]
    );
  }
  
  if (rows.length === 0 && itemCode) {
    [rows] = await pool.query(
      'SELECT * FROM sales_order_item_components WHERE item_code = ? AND sales_order_item_id IS NULL ORDER BY created_at ASC',
      [itemCode]
    );
  }
  return rows;
};

const getItemOperations = async (itemId, itemCode = null) => {
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
  return rows;
};

const getItemScrap = async (itemId, itemCode = null) => {
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
  return rows;
};

const addItemMaterial = async (itemId, materialData) => {
  const { materialName, materialType, itemGroup, qtyPerPc, uom, rate, warehouse, operation } = materialData;
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  const [result] = await pool.execute(
    'INSERT INTO sales_order_item_materials (sales_order_item_id, material_name, material_type, item_group, qty_per_pc, uom, rate, warehouse, operation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [parsedItemId, materialName || null, materialType || null, itemGroup || null, qtyPerPc || null, uom || null, rate || 0, warehouse || null, operation || null]
  );
  return result.insertId;
};

const addComponent = async (itemId, componentData) => {
  const { componentCode, description, quantity, uom, rate, lossPercent, notes } = componentData;
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  const [result] = await pool.execute(
    'INSERT INTO sales_order_item_components (sales_order_item_id, component_code, description, quantity, uom, rate, loss_percent, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [parsedItemId, componentCode || null, description || null, quantity || null, uom || null, rate || null, lossPercent || null, notes || null]
  );
  return result.insertId;
};

const addOperation = async (itemId, operationData) => {
  const { operationName, workstation, cycleTimeMin, setupTimeMin, hourlyRate, operationType, targetWarehouse } = operationData;
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  const [result] = await pool.execute(
    'INSERT INTO sales_order_item_operations (sales_order_item_id, operation_name, workstation, cycle_time_min, setup_time_min, hourly_rate, operation_type, target_warehouse) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [parsedItemId, operationName || null, workstation || null, cycleTimeMin || null, setupTimeMin || null, hourlyRate || null, operationType || null, targetWarehouse || null]
  );
  return result.insertId;
};

const addScrap = async (itemId, scrapData) => {
  const { itemCode, itemName, inputQty, lossPercent, rate } = scrapData;
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  const [result] = await pool.execute(
    'INSERT INTO sales_order_item_scrap (sales_order_item_id, item_code, item_name, input_qty, loss_percent, rate) VALUES (?, ?, ?, ?, ?, ?)',
    [parsedItemId, itemCode || null, itemName || null, inputQty || null, lossPercent || null, rate || null]
  );
  return result.insertId;
};

const updateItemMaterial = async (materialId, materialData) => {
  const { materialName, materialType, itemGroup, qtyPerPc, uom, rate, warehouse, operation } = materialData;
  await pool.execute(
    'UPDATE sales_order_item_materials SET material_name = ?, material_type = ?, item_group = ?, qty_per_pc = ?, uom = ?, rate = ?, warehouse = ?, operation = ? WHERE id = ?',
    [materialName || null, materialType || null, itemGroup || null, qtyPerPc || null, uom || null, rate || 0, warehouse || null, operation || null, materialId]
  );
};

const deleteItemMaterial = async (materialId) => {
  await pool.execute('DELETE FROM sales_order_item_materials WHERE id = ?', [materialId]);
};

const deleteComponent = async (id) => {
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
    'SELECT id, item_code, description FROM sales_order_items WHERE sales_order_id = ?',
    [salesOrderId]
  );

  const fullBOM = [];

  for (const item of items) {
    const materials = await getItemMaterials(item.id);
    const components = await getItemComponents(item.id);
    const operations = await getItemOperations(item.id);
    const scrap = await getItemScrap(item.id);

    fullBOM.push({
      item_id: item.id,
      item_code: item.item_code,
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
  const { itemId, productForm, materials, components, operations, scrap, source, costing } = bomData;
  const { itemCode, itemGroup, uom, revision, description, isActive, isDefault, quantity, drawingNo, drawing_id } = productForm;
  const bom_cost = costing?.costPerUnit || 0;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const isMasterBOM = source === 'stock' || !itemId;
    const safeItemCode = itemCode || null;

    if (!isMasterBOM) {
      // 1. Update sales_order_items with BOM metadata and costing
      await connection.execute(
        `UPDATE sales_order_items 
         SET item_code = ?, item_group = ?, unit = ?, revision_no = ?, description = ?, is_active = ?, is_default = ?, quantity = ?, drawing_no = ?, drawing_id = ?, bom_cost = ?
         WHERE id = ?`,
        [
          safeItemCode, 
          itemGroup || null, 
          uom || null, 
          revision || null, 
          description || null, 
          isActive ? 1 : 0, 
          isDefault ? 1 : 0, 
          quantity || 0, 
          drawingNo || null, 
          drawing_id || null, 
          bom_cost,
          itemId
        ]
      );

      // 2. Clear existing BOM items for this sales order item
      await connection.execute('DELETE FROM sales_order_item_materials WHERE sales_order_item_id = ?', [itemId]);
      await connection.execute('DELETE FROM sales_order_item_components WHERE sales_order_item_id = ?', [itemId]);
      await connection.execute('DELETE FROM sales_order_item_operations WHERE sales_order_item_id = ?', [itemId]);
      await connection.execute('DELETE FROM sales_order_item_scrap WHERE sales_order_item_id = ?', [itemId]);
    } else {
      // For Master BOM, clear by item_code where sales_order_item_id is NULL
      await connection.execute('DELETE FROM sales_order_item_materials WHERE item_code = ? AND sales_order_item_id IS NULL', [safeItemCode]);
      await connection.execute('DELETE FROM sales_order_item_components WHERE item_code = ? AND sales_order_item_id IS NULL', [safeItemCode]);
      await connection.execute('DELETE FROM sales_order_item_operations WHERE item_code = ? AND sales_order_item_id IS NULL', [safeItemCode]);
      await connection.execute('DELETE FROM sales_order_item_scrap WHERE item_code = ? AND sales_order_item_id IS NULL', [safeItemCode]);
    }

    // 3. Insert new BOM items
    const linkId = isMasterBOM ? null : (itemId || null);

    if (materials && materials.length > 0) {
      for (const m of materials) {
        await connection.execute(
          'INSERT INTO sales_order_item_materials (sales_order_item_id, item_code, material_name, material_type, item_group, qty_per_pc, uom, rate, warehouse, operation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            linkId, 
            safeItemCode, 
            m.material_name || null, 
            m.material_type || null, 
            m.item_group || null, 
            m.qty_per_pc || 0, 
            m.uom || null, 
            m.rate || 0, 
            m.warehouse || null, 
            m.operation || null
          ]
        );
      }
    }

    if (components && components.length > 0) {
      for (const c of components) {
        await connection.execute(
          'INSERT INTO sales_order_item_components (sales_order_item_id, item_code, component_code, description, quantity, uom, rate, loss_percent, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            linkId, 
            safeItemCode, 
            c.component_code || null, 
            c.description || null, 
            c.quantity || 0, 
            c.uom || null, 
            c.rate || 0, 
            c.loss_percent || 0, 
            c.notes || null
          ]
        );
      }
    }

    if (operations && operations.length > 0) {
      for (const o of operations) {
        await connection.execute(
          'INSERT INTO sales_order_item_operations (sales_order_item_id, item_code, operation_name, workstation, cycle_time_min, setup_time_min, hourly_rate, operation_type, target_warehouse) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            linkId, 
            safeItemCode, 
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
        await connection.execute(
          'INSERT INTO sales_order_item_scrap (sales_order_item_id, item_code, scrap_item_code, item_name, input_qty, loss_percent, rate) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            linkId, 
            safeItemCode, 
            s.scrap_item_code || s.item_code || null, 
            s.item_name || null, 
            s.input_qty || 0, 
            s.loss_percent || 0, 
            s.rate || 0
          ]
        );
      }
    }

    // 4. Update sales_order status (only if linked to sales order)
    if (!isMasterBOM) {
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
      EXISTS (SELECT 1 FROM sales_order_item_materials WHERE sales_order_item_id = soi.id OR (item_code = soi.item_code AND sales_order_item_id IS NULL))
      OR EXISTS (SELECT 1 FROM sales_order_item_components WHERE sales_order_item_id = soi.id OR (item_code = soi.item_code AND sales_order_item_id IS NULL))
      OR EXISTS (SELECT 1 FROM sales_order_item_operations WHERE sales_order_item_id = soi.id OR (item_code = soi.item_code AND sales_order_item_id IS NULL))
    )
    ORDER BY soi.created_at DESC
  `);
  return rows;
};

const deleteBOM = async (itemId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute('DELETE FROM sales_order_item_materials WHERE sales_order_item_id = ?', [itemId]);
    await connection.execute('DELETE FROM sales_order_item_components WHERE sales_order_item_id = ?', [itemId]);
    await connection.execute('DELETE FROM sales_order_item_operations WHERE sales_order_item_id = ?', [itemId]);
    await connection.execute('DELETE FROM sales_order_item_scrap WHERE sales_order_item_id = ?', [itemId]);

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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
  deleteBOM
};
