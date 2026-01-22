const pool = require('../config/db');

const getMaterialRequirements = async () => {
  const [rows] = await pool.query(`
    SELECT 
      m.material_name,
      m.material_type,
      m.uom,
      SUM(m.qty_per_pc * ppi.planned_qty) as total_required,
      so.project_name,
      soi.item_code,
      ppi.plan_id,
      pp.plan_code
    FROM production_plan_items ppi
    JOIN production_plans pp ON ppi.plan_id = pp.id
    JOIN sales_order_items soi ON ppi.sales_order_item_id = soi.id
    JOIN sales_orders so ON ppi.sales_order_id = so.id
    JOIN sales_order_item_materials m ON soi.id = m.sales_order_item_id
    WHERE ppi.status NOT IN ('COMPLETED', 'CANCELLED')
    AND soi.status != 'Rejected'
    GROUP BY m.material_name, m.material_type, m.uom, so.project_name, soi.item_code, pp.plan_code
  `);

  // Aggregate by material name to see global requirement
  const aggregated = {};
  for (const row of rows) {
    const key = `${row.material_name}|${row.material_type}`;
    if (!aggregated[key]) {
      aggregated[key] = {
        material_name: row.material_name,
        material_type: row.material_type,
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
    const [rows] = await pool.query(`
    SELECT 
      m.material_name,
      m.material_type,
      m.uom,
      m.item_group,
      SUM(m.qty_per_pc * soi.quantity) as total_required,
      so.project_name
    FROM sales_orders so
    JOIN sales_order_items soi ON so.id = soi.sales_order_id
    JOIN sales_order_item_materials m ON soi.id = m.sales_order_item_id
    WHERE so.id = ? AND soi.status != 'Rejected'
    GROUP BY m.material_name, m.material_type, m.uom, m.item_group
  `, [projectId]);

  for (const mat of rows) {
    const [stockRows] = await pool.query(
      'SELECT SUM(current_balance) as total_stock FROM stock_balance WHERE material_name = ? AND material_type = ?',
      [mat.material_name, mat.material_type]
    );
    mat.available_qty = stockRows[0]?.total_stock || 0;
    mat.shortage = Math.max(0, parseFloat(mat.total_required) - mat.available_qty);
  }

  return rows;
}

module.exports = {
  getMaterialRequirements,
  getProjectMaterialRequirements
};
