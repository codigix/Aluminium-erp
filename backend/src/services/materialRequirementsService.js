const pool = require('../config/db');
const bomService = require('./bomService');

const getMaterialRequirements = async () => {
  // 1. Fetch all relevant production plan items and their SO item details
  const [ppiRows] = await pool.query(`
    SELECT 
      ppi.planned_qty,
      so.project_name,
      soi.id as soi_id,
      soi.item_code,
      soi.drawing_no,
      pp.plan_code
    FROM production_plan_items ppi
    JOIN production_plans pp ON ppi.plan_id = pp.id
    JOIN sales_order_items soi ON ppi.sales_order_item_id = soi.id
    JOIN sales_orders so ON ppi.sales_order_id = so.id
    WHERE ppi.status NOT IN ('COMPLETED', 'CANCELLED')
    AND soi.status != 'Rejected'
  `);

  if (ppiRows.length === 0) return [];

  const rows = [];
  for (const ppi of ppiRows) {
    // Explode BOM recursively for each production plan item
    const materials = await bomService.explodeBOM(
      ppi.soi_id, 
      ppi.item_code, 
      ppi.drawing_no, 
      parseFloat(ppi.planned_qty)
    );
    
    for (const m of materials) {
      rows.push({
        material_name: m.material_name,
        material_type: m.material_type,
        item_group: m.item_group,
        uom: m.uom,
        total_required: m.qty_per_pc, // explodeBOM already multiplied by parentQty (planned_qty)
        project_name: ppi.project_name,
        item_code: ppi.item_code,
        plan_code: ppi.plan_code
      });
    }
  }

  // Aggregate by material name to see global requirement
  const aggregated = {};
  for (const row of rows) {
    const normalizedName = row.material_name?.trim().toUpperCase();
    const key = `${normalizedName}|${row.material_type}`;
    if (!aggregated[key]) {
      aggregated[key] = {
        material_name: normalizedName || row.material_name,
        material_type: row.material_type,
        item_group: row.item_group,
        uom: row.uom,
        required_qty: 0,
        details: []
      };
    }
    aggregated[key].required_qty += parseFloat(row.total_required);
    aggregated[key].details.push({
      project_name: row.project_name,
      item_code: row.item_code,
      plan_code: row.plan_code,
      qty: parseFloat(row.total_required)
    });
  }

  // Fetch stock levels for these materials
  const materialList = Object.values(aggregated);
  for (const mat of materialList) {
    const [stockRows] = await pool.query(
      'SELECT SUM(current_balance) as total_stock FROM stock_balance WHERE material_name = ? AND material_type = ?',
      [mat.material_name, mat.material_type]
    );
    mat.available_qty = stockRows[0]?.total_stock || 0;
    mat.shortage = Math.max(0, mat.required_qty - mat.available_qty);
  }

  return materialList;
};

const getProjectMaterialRequirements = async (projectId) => {
  // 1. Fetch SO items for this project
  const [items] = await pool.query(`
    SELECT soi.id, soi.item_code, soi.drawing_no, soi.quantity, so.project_name
    FROM sales_orders so
    JOIN sales_order_items soi ON so.id = soi.sales_order_id
    WHERE so.id = ? AND soi.status != 'Rejected'
  `, [projectId]);

  if (items.length === 0) return [];

  const rows = [];
  for (const item of items) {
    // Explode BOM recursively for each item in the project
    const materials = await bomService.explodeBOM(
      item.id, 
      item.item_code, 
      item.drawing_no, 
      parseFloat(item.quantity)
    );
    
    for (const m of materials) {
      rows.push({
        material_name: m.material_name,
        material_type: m.material_type,
        uom: m.uom,
        item_group: m.item_group,
        total_required: m.qty_per_pc,
        project_name: item.project_name
      });
    }
  }

  // Aggregate by material name
  const aggregated = {};
  for (const row of rows) {
    const normalizedName = row.material_name?.trim().toUpperCase();
    const key = `${normalizedName}|${row.material_type}`;
    if (!aggregated[key]) {
      aggregated[key] = {
        material_name: normalizedName || row.material_name,
        material_type: row.material_type,
        uom: row.uom,
        item_group: row.item_group,
        total_required: 0,
        project_name: row.project_name
      };
    }
    aggregated[key].total_required += row.total_required;
  }

  const result = Object.values(aggregated);

  for (const mat of result) {
    const [stockRows] = await pool.query(
      'SELECT SUM(current_balance) as total_stock FROM stock_balance WHERE material_name = ? AND material_type = ?',
      [mat.material_name, mat.material_type]
    );
    mat.available_qty = stockRows[0]?.total_stock || 0;
    mat.shortage = Math.max(0, parseFloat(mat.total_required) - mat.available_qty);
  }

  return result;
}

module.exports = {
  getMaterialRequirements,
  getProjectMaterialRequirements
};
