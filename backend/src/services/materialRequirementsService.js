const pool = require('../config/db');

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

  const soiIds = ppiRows.map(r => r.soi_id);
  const itemCodes = ppiRows.map(r => r.item_code).filter(Boolean);
  const drawingNos = ppiRows.map(r => r.drawing_no).filter(Boolean);

  // 2. Fetch all potentially relevant materials in bulk
  const [allMaterials] = await pool.query(`
    SELECT * FROM sales_order_item_materials 
    WHERE sales_order_item_id IN (?) 
    OR (item_code IN (?) AND sales_order_item_id IS NULL)
    OR (drawing_no IN (?) AND sales_order_item_id IS NULL AND item_code IS NULL)
  `, [
    soiIds.length > 0 ? soiIds : [null], 
    itemCodes.length > 0 ? itemCodes : [null], 
    drawingNos.length > 0 ? drawingNos : [null]
  ]);

  // 3. Map materials for quick lookup
  const materialsById = {};
  const materialsByCode = {};
  const materialsByDwg = {};

  allMaterials.forEach(m => {
    if (m.sales_order_item_id) {
      if (!materialsById[m.sales_order_item_id]) materialsById[m.sales_order_item_id] = [];
      materialsById[m.sales_order_item_id].push(m);
    } else if (m.item_code) {
      if (!materialsByCode[m.item_code]) materialsByCode[m.item_code] = [];
      materialsByCode[m.item_code].push(m);
    } else if (m.drawing_no) {
      if (!materialsByDwg[m.drawing_no]) materialsByDwg[m.drawing_no] = [];
      materialsByDwg[m.drawing_no].push(m);
    }
  });

  const rows = [];
  for (const ppi of ppiRows) {
    // Hierarchical lookup
    const materials = materialsById[ppi.soi_id] || materialsByCode[ppi.item_code] || materialsByDwg[ppi.drawing_no] || [];
    
    for (const m of materials) {
      rows.push({
        material_name: m.material_name,
        material_type: m.material_type,
        uom: m.uom,
        length: m.length || 0,
        width: m.width || 0,
        thickness: m.thickness || 0,
        diameter: m.diameter || 0,
        outer_diameter: m.outer_diameter || 0,
        total_required: parseFloat(m.qty_per_pc || 0) * parseFloat(ppi.planned_qty),
        project_name: ppi.project_name,
        item_code: ppi.item_code,
        plan_code: ppi.plan_code
      });
    }
  }

  // Aggregate by material name and dimensions to see global requirement per size
  const aggregated = {};
  for (const row of rows) {
    const key = `${row.material_name}|${row.material_type}|${row.length}|${row.width}|${row.thickness}|${row.diameter}|${row.outer_diameter}`;
    if (!aggregated[key]) {
      aggregated[key] = {
        material_name: row.material_name,
        material_type: row.material_type,
        uom: row.uom,
        length: row.length,
        width: row.width,
        thickness: row.thickness,
        diameter: row.diameter,
        outer_diameter: row.outer_diameter,
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

  // Fetch stock levels for these materials matching name, type, and dimensions
  const materialList = Object.values(aggregated);
  for (const mat of materialList) {
    const [stockRows] = await pool.query(
      `SELECT SUM(current_balance) as total_stock FROM stock_balance 
       WHERE LOWER(TRIM(material_name)) = LOWER(TRIM(?)) 
         AND (material_type = ? OR UPPER(REPLACE(material_type, ' ', '_')) = UPPER(REPLACE(?, ' ', '_')))
         AND (ABS(COALESCE(length, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(width, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(thickness, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(diameter, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(outer_diameter, 0) - COALESCE(?, 0)) < 0.0001)`,
      [
        mat.material_name, mat.material_type, mat.material_type,
        mat.length, mat.width, mat.thickness, mat.diameter, mat.outer_diameter
      ]
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

  const soiIds = items.map(i => i.id);
  const itemCodes = items.map(i => i.item_code).filter(Boolean);
  const drawingNos = items.map(i => i.drawing_no).filter(Boolean);

  // 2. Fetch all potentially relevant materials
  const [allMaterials] = await pool.query(`
    SELECT * FROM sales_order_item_materials 
    WHERE sales_order_item_id IN (?) 
    OR (item_code IN (?) AND sales_order_item_id IS NULL)
    OR (drawing_no IN (?) AND sales_order_item_id IS NULL AND item_code IS NULL)
  `, [
    soiIds.length > 0 ? soiIds : [null], 
    itemCodes.length > 0 ? itemCodes : [null], 
    drawingNos.length > 0 ? drawingNos : [null]
  ]);

  const materialsById = {};
  const materialsByCode = {};
  const materialsByDwg = {};

  allMaterials.forEach(m => {
    if (m.sales_order_item_id) {
      if (!materialsById[m.sales_order_item_id]) materialsById[m.sales_order_item_id] = [];
      materialsById[m.sales_order_item_id].push(m);
    } else if (m.item_code) {
      if (!materialsByCode[m.item_code]) materialsByCode[m.item_code] = [];
      materialsByCode[m.item_code].push(m);
    } else if (m.drawing_no) {
      if (!materialsByDwg[m.drawing_no]) materialsByDwg[m.drawing_no] = [];
      materialsByDwg[m.drawing_no].push(m);
    }
  });

  const rows = [];
  for (const item of items) {
    const materials = materialsById[item.id] || materialsByCode[item.item_code] || materialsByDwg[item.drawing_no] || [];
    for (const m of materials) {
      rows.push({
        material_name: m.material_name,
        material_type: m.material_type,
        uom: m.uom,
        item_group: m.item_group,
        length: m.length || 0,
        width: m.width || 0,
        thickness: m.thickness || 0,
        diameter: m.diameter || 0,
        outer_diameter: m.outer_diameter || 0,
        total_required: parseFloat(m.qty_per_pc || 0) * parseFloat(item.quantity),
        project_name: item.project_name
      });
    }
  }

  // Aggregate by material name, type, and dimensions
  const aggregated = {};
  for (const row of rows) {
    const key = `${row.material_name}|${row.material_type}|${row.length}|${row.width}|${row.thickness}|${row.diameter}|${row.outer_diameter}`;
    if (!aggregated[key]) {
      aggregated[key] = {
        material_name: row.material_name,
        material_type: row.material_type,
        uom: row.uom,
        item_group: row.item_group,
        length: row.length,
        width: row.width,
        thickness: row.thickness,
        diameter: row.diameter,
        outer_diameter: row.outer_diameter,
        total_required: 0,
        project_name: row.project_name
      };
    }
    aggregated[key].total_required += row.total_required;
  }

  const result = Object.values(aggregated);

  for (const mat of result) {
    const [stockRows] = await pool.query(
      `SELECT SUM(current_balance) as total_stock FROM stock_balance 
       WHERE LOWER(TRIM(material_name)) = LOWER(TRIM(?)) 
         AND (material_type = ? OR UPPER(REPLACE(material_type, ' ', '_')) = UPPER(REPLACE(?, ' ', '_')))
         AND (ABS(COALESCE(length, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(width, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(thickness, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(diameter, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(outer_diameter, 0) - COALESCE(?, 0)) < 0.0001)`,
      [
        mat.material_name, mat.material_type, mat.material_type,
        mat.length, mat.width, mat.thickness, mat.diameter, mat.outer_diameter
      ]
    );
    mat.available_qty = stockRows[0]?.total_stock || 0;
    mat.shortage = Math.max(0, parseFloat(mat.total_required) - mat.available_qty);
  }

  return result;
};

module.exports = {
  getMaterialRequirements,
  getProjectMaterialRequirements
};
