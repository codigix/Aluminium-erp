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
      pp.plan_code,
      pp.id as plan_id,
      COALESCE(pp.start_date, pp.plan_date) as plan_start
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
        plan_code: ppi.plan_code,
        plan_id: ppi.plan_id,
        plan_start: ppi.plan_start
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
      plan_id: row.plan_id,
      plan_start: row.plan_start,
      qty: parseFloat(row.total_required)
    });
  }

  // What each plan has already had released from Stores, per material (kg materials in kilograms: the
  // recorded weight, or the quantity when no weight was recorded; everything else in pieces), so it is not counted against stock a second time
  const planIds = [...new Set(rows.map(r => r.plan_id))];
  const releasedByPlanMaterial = new Map();
  if (planIds.length > 0) {
    const [releasedRows] = await pool.query(
      `SELECT mr.plan_id, LOWER(TRIM(mri.item_name)) AS name,
              SUM(CASE WHEN LOWER(TRIM(COALESCE(mri.uom, ''))) IN ('kg', 'kgs', 'kilogram') THEN COALESCE(NULLIF(mri.allocated_weight, 0), mri.allocated_quantity, 0) ELSE COALESCE(mri.allocated_quantity, 0) END) AS released
       FROM material_request_items mri JOIN material_requests mr ON mri.mr_id = mr.id
       WHERE mr.plan_id IN (?) AND UPPER(COALESCE(mr.status, '')) NOT IN ('CANCELLED', 'REJECTED')
       GROUP BY mr.plan_id, name`,
      [planIds]
    );
    releasedRows.forEach(r => releasedByPlanMaterial.set(`${r.plan_id}|${r.name}`, parseFloat(r.released) || 0));
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
    mat.available_qty = parseFloat(stockRows[0]?.total_stock) || 0;

    // Plans share one stock, so hand it out in order (earliest start first) instead of
    // showing every plan the same overall number. Material a plan has already had released
    // has left stock, so it no longer counts as still needed.
    const nameKey = String(mat.material_name || '').trim().toLowerCase();
    let remainingStock = mat.available_qty;
    const orderedDetails = [...mat.details].sort((a, b) => {
      const as = a.plan_start ? new Date(a.plan_start).getTime() : Infinity;
      const bs = b.plan_start ? new Date(b.plan_start).getTime() : Infinity;
      return as - bs || (a.plan_id || 0) - (b.plan_id || 0);
    });
    for (const d of orderedDetails) {
      const releasedKey = `${d.plan_id}|${nameKey}`;
      const releasedLeft = releasedByPlanMaterial.get(releasedKey) || 0;
      const releasedHere = Math.min(d.qty, releasedLeft);
      releasedByPlanMaterial.set(releasedKey, releasedLeft - releasedHere);

      const stillNeeded = d.qty - releasedHere;
      const covered = Math.min(stillNeeded, Math.max(0, remainingStock));
      remainingStock -= covered;
      d.released_qty = releasedHere;
      d.still_needed_qty = stillNeeded;
      d.covered_qty = covered;
      d.short_qty = Math.max(0, stillNeeded - covered);
    }
    mat.shortage = mat.details.reduce((sum, d) => sum + d.short_qty, 0);
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

  // 2. Check operations for Laser Cutting
  const [laserOps] = await pool.query(`
    SELECT DISTINCT sales_order_item_id, item_code, drawing_no
    FROM sales_order_item_operations
    WHERE (sales_order_item_id IN (?) OR item_code IN (?) OR drawing_no IN (?))
      AND LOWER(operation_name) LIKE '%laser%'
  `, [
    soiIds.length > 0 ? soiIds : [null], 
    itemCodes.length > 0 ? itemCodes : [null], 
    drawingNos.length > 0 ? drawingNos : [null]
  ]);

  const laserSoiSet = new Set(laserOps.map(o => o.sales_order_item_id).filter(Boolean));
  const laserCodeSet = new Set(laserOps.map(o => o.item_code).filter(Boolean));
  const laserDwgSet = new Set(laserOps.map(o => o.drawing_no).filter(Boolean));

  // 3. Fetch all potentially relevant materials
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
      const hasLaser = (m.sales_order_item_id && laserSoiSet.has(m.sales_order_item_id)) ||
                       (m.item_code && laserCodeSet.has(m.item_code)) ||
                       (m.drawing_no && laserDwgSet.has(m.drawing_no)) ||
                       (item.id && laserSoiSet.has(item.id)) ||
                       (item.item_code && laserCodeSet.has(item.item_code)) ||
                       (item.drawing_no && laserDwgSet.has(item.drawing_no));

      rows.push({
        material_name: m.material_name,
        material_type: m.material_type,
        drawing_no: item.drawing_no || m.drawing_no || item.item_code,
        uom: m.uom,
        item_group: m.item_group,
        length: m.length || 0,
        width: m.width || 0,
        thickness: m.thickness || 0,
        diameter: m.diameter || 0,
        outer_diameter: m.outer_diameter || 0,
        total_required: parseFloat(m.qty_per_pc || 0) * parseFloat(item.quantity),
        project_name: item.project_name,
        has_laser_cutting: Boolean(hasLaser)
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
        drawing_no: row.drawing_no,
        uom: row.uom,
        item_group: row.item_group,
        length: row.length,
        width: row.width,
        thickness: row.thickness,
        diameter: row.diameter,
        outer_diameter: row.outer_diameter,
        total_required: 0,
        project_name: row.project_name,
        has_laser_cutting: row.has_laser_cutting
      };
    } else if (row.has_laser_cutting) {
      aggregated[key].has_laser_cutting = true;
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
