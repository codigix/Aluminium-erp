const pool = require('../config/db');

const getItemMaterials = async (itemId) => {
  const [rows] = await pool.query(
    'SELECT * FROM sales_order_item_materials WHERE sales_order_item_id = ? ORDER BY created_at ASC',
    [itemId]
  );
  return rows;
};

const getItemComponents = async (itemId) => {
  const [rows] = await pool.query(
    'SELECT * FROM sales_order_item_components WHERE sales_order_item_id = ? ORDER BY created_at ASC',
    [itemId]
  );
  return rows;
};

const getItemOperations = async (itemId) => {
  const [rows] = await pool.query(
    'SELECT * FROM sales_order_item_operations WHERE sales_order_item_id = ? ORDER BY created_at ASC',
    [itemId]
  );
  return rows;
};

const getItemScrap = async (itemId) => {
  const [rows] = await pool.query(
    'SELECT * FROM sales_order_item_scrap WHERE sales_order_item_id = ? ORDER BY created_at ASC',
    [itemId]
  );
  return rows;
};

const addItemMaterial = async (itemId, materialData) => {
  const { materialName, materialType, itemGroup, qtyPerPc, uom, rate, warehouse, operation } = materialData;
  const [result] = await pool.execute(
    'INSERT INTO sales_order_item_materials (sales_order_item_id, material_name, material_type, item_group, qty_per_pc, uom, rate, warehouse, operation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [itemId || null, materialName || null, materialType || null, itemGroup || null, qtyPerPc || null, uom || null, rate || 0, warehouse || null, operation || null]
  );
  return result.insertId;
};

const addComponent = async (itemId, componentData) => {
  const { componentCode, description, quantity, uom, rate, lossPercent, notes } = componentData;
  const [result] = await pool.execute(
    'INSERT INTO sales_order_item_components (sales_order_item_id, component_code, description, quantity, uom, rate, loss_percent, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [itemId || null, componentCode || null, description || null, quantity || null, uom || null, rate || null, lossPercent || null, notes || null]
  );
  return result.insertId;
};

const addOperation = async (itemId, operationData) => {
  const { operationName, workstation, cycleTimeMin, setupTimeMin, hourlyRate, operationType, targetWarehouse } = operationData;
  const [result] = await pool.execute(
    'INSERT INTO sales_order_item_operations (sales_order_item_id, operation_name, workstation, cycle_time_min, setup_time_min, hourly_rate, operation_type, target_warehouse) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [itemId || null, operationName || null, workstation || null, cycleTimeMin || null, setupTimeMin || null, hourlyRate || null, operationType || null, targetWarehouse || null]
  );
  return result.insertId;
};

const addScrap = async (itemId, scrapData) => {
  const { itemCode, itemName, inputQty, lossPercent, rate } = scrapData;
  const [result] = await pool.execute(
    'INSERT INTO sales_order_item_scrap (sales_order_item_id, item_code, item_name, input_qty, loss_percent, rate) VALUES (?, ?, ?, ?, ?, ?)',
    [itemId || null, itemCode || null, itemName || null, inputQty || null, lossPercent || null, rate || null]
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
  const { itemId, productForm } = bomData;
  const { itemGroup, uom, revision, description, isActive, isDefault, quantity } = productForm;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Update sales_order_items with BOM metadata
    await connection.execute(
      `UPDATE sales_order_items 
       SET item_group = ?, unit = ?, revision_no = ?, description = ?, is_active = ?, is_default = ?, quantity = ?
       WHERE id = ?`,
      [itemGroup, uom, revision, description, isActive ? 1 : 0, isDefault ? 1 : 0, quantity, itemId]
    );

    // Get sales_order_id to update sales_orders status
    const [itemRows] = await connection.query(
      'SELECT sales_order_id FROM sales_order_items WHERE id = ?',
      [itemId]
    );

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
      c.company_name,
      so.project_name,
      so.id as sales_order_id
    FROM sales_order_items soi
    JOIN sales_orders so ON soi.sales_order_id = so.id
    JOIN companies c ON so.company_id = c.id
    WHERE so.status IN ('BOM_SUBMITTED', 'BOM_APPROVED', 'PROCUREMENT_IN_PROGRESS', 'IN_PRODUCTION', 'PRODUCTION_COMPLETED')
    AND (
      EXISTS (SELECT 1 FROM sales_order_item_materials WHERE sales_order_item_id = soi.id)
      OR EXISTS (SELECT 1 FROM sales_order_item_components WHERE sales_order_item_id = soi.id)
      OR EXISTS (SELECT 1 FROM sales_order_item_operations WHERE sales_order_item_id = soi.id)
    )
    ORDER BY soi.created_at DESC
  `);
  return rows;
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
  createBOMRequest
};
