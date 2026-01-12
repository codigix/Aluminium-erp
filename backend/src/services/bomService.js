const pool = require('../config/db');

const getItemMaterials = async (itemId) => {
  const [rows] = await pool.query(
    'SELECT * FROM sales_order_item_materials WHERE sales_order_item_id = ? ORDER BY created_at ASC',
    [itemId]
  );
  return rows;
};

const addItemMaterial = async (itemId, materialData) => {
  const { materialName, materialType, qtyPerPc, uom } = materialData;
  const [result] = await pool.execute(
    'INSERT INTO sales_order_item_materials (sales_order_item_id, material_name, material_type, qty_per_pc, uom) VALUES (?, ?, ?, ?, ?)',
    [itemId, materialName, materialType, qtyPerPc, uom]
  );
  return result.insertId;
};

const updateItemMaterial = async (materialId, materialData) => {
  const { materialName, materialType, qtyPerPc, uom } = materialData;
  await pool.execute(
    'UPDATE sales_order_item_materials SET material_name = ?, material_type = ?, qty_per_pc = ?, uom = ? WHERE id = ?',
    [materialName, materialType, qtyPerPc, uom, materialId]
  );
};

const deleteItemMaterial = async (materialId) => {
  await pool.execute('DELETE FROM sales_order_item_materials WHERE id = ?', [materialId]);
};

const getBOMBySalesOrder = async (salesOrderId) => {
  const [rows] = await pool.query(
    `SELECT som.*, soi.item_code, soi.description as item_description
     FROM sales_order_item_materials som
     JOIN sales_order_items soi ON som.sales_order_item_id = soi.id
     WHERE soi.sales_order_id = ?
     ORDER BY soi.id, som.created_at ASC`,
    [salesOrderId]
  );
  return rows;
};

module.exports = {
  getItemMaterials,
  addItemMaterial,
  updateItemMaterial,
  deleteItemMaterial,
  getBOMBySalesOrder
};
