const pool = require('../config/db');
const stockService = require('../services/stockService');

const resolveDimensionItemCode = async (connection, item) => {
  const lengthVal = parseFloat(item.length || 0);
  const widthVal = parseFloat(item.width || 0);
  const thicknessVal = parseFloat(item.thickness || 0);
  const diameterVal = parseFloat(item.diameter || 0);
  const outerDiameterVal = parseFloat(item.outer_diameter || item.outerDiameter || 0);
  const hasDimensions = (lengthVal > 0 || widthVal > 0 || thicknessVal > 0 || diameterVal > 0 || outerDiameterVal > 0);

  // If item has NO dimensions specified, match stock_balance by material_name with positive balance
  if (!hasDimensions && (item.item_name || item.material_name)) {
    const [nameOnly] = await connection.query(`
      SELECT item_code FROM stock_balance 
      WHERE (LOWER(TRIM(material_name)) = LOWER(TRIM(?)) OR LOWER(TRIM(material_name)) = LOWER(TRIM(?)))
        AND current_balance > 0
      ORDER BY current_balance DESC LIMIT 1
    `, [item.item_name || item.item_code, item.material_name || item.item_name || item.item_code]);
    if (nameOnly.length > 0) return nameOnly[0].item_code;
  }

  // 1. Check if item.item_code exists in stock_balance WITH positive stock AND matching dimensions
  if (item.item_code) {
    let query = 'SELECT item_code FROM stock_balance WHERE item_code = ? AND current_balance > 0';
    const params = [item.item_code];

    if (hasDimensions) {
      if (lengthVal > 0) { query += ' AND (ABS(COALESCE(length, 0) - ?) < 0.0001)'; params.push(lengthVal); }
      if (widthVal > 0) { query += ' AND (ABS(COALESCE(width, 0) - ?) < 0.0001)'; params.push(widthVal); }
      if (thicknessVal > 0) { query += ' AND (ABS(COALESCE(thickness, 0) - ?) < 0.0001)'; params.push(thicknessVal); }
      if (diameterVal > 0) { query += ' AND (ABS(COALESCE(diameter, 0) - ?) < 0.0001)'; params.push(diameterVal); }
      if (outerDiameterVal > 0) { query += ' AND (ABS(COALESCE(outer_diameter, 0) - ?) < 0.0001)'; params.push(outerDiameterVal); }
    }
    query += ' LIMIT 1';

    const [existing] = await connection.query(query, params);
    if (existing.length > 0) return existing[0].item_code;
  }

  // 2. Check dimension matching for rows with positive stock
  {
    let dimensionConditions = [];
    let dimensionParams = [];

    dimensionConditions.push('(COALESCE(length, 0) = ? OR (? = 0 AND length IS NULL))');
    dimensionParams.push(lengthVal, lengthVal);

    const shapeLower = (item.shape_type || item.shape_name || '').toLowerCase();

    if (shapeLower.includes('threaded rod') || shapeLower.includes('tr')) {
      dimensionConditions.push('(COALESCE(thickness, 0) = ? OR (? = 0 AND thickness IS NULL))');
      dimensionParams.push(thicknessVal, thicknessVal);
      dimensionConditions.push('(COALESCE(diameter, 0) = ? OR (? = 0 AND diameter IS NULL))');
      dimensionParams.push(diameterVal, diameterVal);
    } else if ((shapeLower.includes('pipe') || shapeLower.includes('round tube') || shapeLower.includes('tube')) && !shapeLower.includes('square') && !shapeLower.includes('rectangular')) {
      dimensionConditions.push('(COALESCE(thickness, 0) = ? OR (? = 0 AND thickness IS NULL))');
      dimensionParams.push(thicknessVal, thicknessVal);
      dimensionConditions.push('(COALESCE(outer_diameter, 0) = ? OR (? = 0 AND outer_diameter IS NULL))');
      dimensionParams.push(outerDiameterVal, outerDiameterVal);
    } else if (shapeLower.includes('round bar') || shapeLower.includes('round') || shapeLower.includes('rb') || shapeLower.includes('wire')) {
      dimensionConditions.push('(COALESCE(diameter, 0) = ? OR (? = 0 AND diameter IS NULL))');
      dimensionParams.push(diameterVal, diameterVal);
    } else if (shapeLower.includes('hex')) {
      dimensionConditions.push('(COALESCE(width, 0) = ? OR (? = 0 AND width IS NULL))');
      dimensionParams.push(widthVal, widthVal);
    } else if (shapeLower.includes('square') || shapeLower.includes('sq')) {
      dimensionConditions.push('(COALESCE(width, 0) = ? OR (? = 0 AND width IS NULL))');
      dimensionParams.push(widthVal, widthVal);
    } else {
      if (widthVal > 0) {
        dimensionConditions.push('(COALESCE(width, 0) = ? OR (? = 0 AND width IS NULL))');
        dimensionParams.push(widthVal, widthVal);
      }
      if (thicknessVal > 0) {
        dimensionConditions.push('(COALESCE(thickness, 0) = ? OR (? = 0 AND thickness IS NULL))');
        dimensionParams.push(thicknessVal, thicknessVal);
      }
      if (outerDiameterVal > 0) {
        dimensionConditions.push('(COALESCE(outer_diameter, 0) = ? OR (? = 0 AND outer_diameter IS NULL))');
        dimensionParams.push(outerDiameterVal, outerDiameterVal);
      }
    }

    const [rows] = await connection.query(`
      SELECT item_code 
      FROM stock_balance
      WHERE (LOWER(TRIM(material_name)) = LOWER(TRIM(?)) OR LOWER(TRIM(material_name)) = LOWER(TRIM(?)))
        AND current_balance > 0
        AND ${dimensionConditions.join(' AND ')}
      ORDER BY current_balance DESC
      LIMIT 1
    `, [
      item.item_name || item.name || item.item_code,
      item.material_name || item.item_name || item.item_code,
      ...dimensionParams
    ]);
    if (rows.length > 0) {
      return rows[0].item_code;
    }

    // 3. Fallback without current_balance > 0
    const [rowsAny] = await connection.query(`
      SELECT item_code 
      FROM stock_balance
      WHERE (LOWER(TRIM(material_name)) = LOWER(TRIM(?)) OR LOWER(TRIM(material_name)) = LOWER(TRIM(?)))
        AND ${dimensionConditions.join(' AND ')}
      LIMIT 1
    `, [
      item.item_name || item.name || item.item_code,
      item.material_name || item.item_name || item.item_code,
      ...dimensionParams
    ]);
    if (rowsAny.length > 0) {
      return rowsAny[0].item_code;
    }
  }

  // 4. Final fallback check if item_code exists at all in stock_balance
  if (item.item_code) {
    const [existingAny] = await connection.query('SELECT item_code FROM stock_balance WHERE item_code = ? LIMIT 1', [item.item_code]);
    if (existingAny.length > 0) return existingAny[0].item_code;
  }

  return item.item_code;
};

const calculateItemStockAndAvailability = async (connection, item, mrStatus = '') => {
  const resolvedItemCode = await resolveDimensionItemCode(connection, item);

  let stockRows = [];
  const candidateCodes = Array.from(new Set([resolvedItemCode, item.item_code].filter(Boolean)));

  // 1. Check by candidate item_codes in stock_balance
  for (const code of candidateCodes) {
    const [byCode] = await connection.query(`
      SELECT warehouse as warehouse_name, current_balance as current_stock
      FROM stock_balance
      WHERE item_code = ? AND current_balance > 0
    `, [code]);
    if (byCode.length > 0) {
      stockRows = byCode;
      break;
    }
  }

  // 2. If no stock by code, perform dimension-based fallback lookup across stock_balance
  if (stockRows.length === 0) {
    const lengthVal = parseFloat(item.length || 0);
    const widthVal = parseFloat(item.width || 0);
    const thicknessVal = parseFloat(item.thickness || 0);
    const diameterVal = parseFloat(item.diameter || 0);
    const outerDiameterVal = parseFloat(item.outer_diameter || item.outerDiameter || 0);

    let dimensionConditions = [];
    let dimensionParams = [];

    dimensionConditions.push('(COALESCE(length, 0) = ? OR (? = 0 AND length IS NULL))');
    dimensionParams.push(lengthVal, lengthVal);

    const shapeLower = (item.shape_type || item.shape_name || '').toLowerCase();

    if (shapeLower.includes('threaded rod') || shapeLower.includes('tr')) {
      dimensionConditions.push('(COALESCE(thickness, 0) = ? OR (? = 0 AND thickness IS NULL))');
      dimensionParams.push(thicknessVal, thicknessVal);
      dimensionConditions.push('(COALESCE(diameter, 0) = ? OR (? = 0 AND diameter IS NULL))');
      dimensionParams.push(diameterVal, diameterVal);
    } else if ((shapeLower.includes('pipe') || shapeLower.includes('round tube') || shapeLower.includes('tube')) && !shapeLower.includes('square') && !shapeLower.includes('rectangular')) {
      dimensionConditions.push('(COALESCE(thickness, 0) = ? OR (? = 0 AND thickness IS NULL))');
      dimensionParams.push(thicknessVal, thicknessVal);
      dimensionConditions.push('(COALESCE(outer_diameter, 0) = ? OR (? = 0 AND outer_diameter IS NULL))');
      dimensionParams.push(outerDiameterVal, outerDiameterVal);
    } else if (shapeLower.includes('round bar') || shapeLower.includes('round') || shapeLower.includes('rb') || shapeLower.includes('wire')) {
      dimensionConditions.push('(COALESCE(diameter, 0) = ? OR (? = 0 AND diameter IS NULL))');
      dimensionParams.push(diameterVal, diameterVal);
    } else if (shapeLower.includes('hex')) {
      dimensionConditions.push('(COALESCE(width, 0) = ? OR (? = 0 AND width IS NULL))');
      dimensionParams.push(widthVal, widthVal);
    } else if (shapeLower.includes('square') || shapeLower.includes('sq')) {
      dimensionConditions.push('(COALESCE(width, 0) = ? OR (? = 0 AND width IS NULL))');
      dimensionParams.push(widthVal, widthVal);
    } else {
      if (widthVal > 0) {
        dimensionConditions.push('(COALESCE(width, 0) = ? OR (? = 0 AND width IS NULL))');
        dimensionParams.push(widthVal, widthVal);
      }
      if (thicknessVal > 0) {
        dimensionConditions.push('(COALESCE(thickness, 0) = ? OR (? = 0 AND thickness IS NULL))');
        dimensionParams.push(thicknessVal, thicknessVal);
      }
      if (outerDiameterVal > 0) {
        dimensionConditions.push('(COALESCE(outer_diameter, 0) = ? OR (? = 0 AND outer_diameter IS NULL))');
        dimensionParams.push(outerDiameterVal, outerDiameterVal);
      }
    }

    const [byDim] = await connection.query(`
      SELECT warehouse as warehouse_name, current_balance as current_stock
      FROM stock_balance
      WHERE (LOWER(TRIM(material_name)) = LOWER(TRIM(?)) OR LOWER(TRIM(material_name)) = LOWER(TRIM(?)))
        AND current_balance > 0
        AND ${dimensionConditions.join(' AND ')}
    `, [
      item.item_name || item.name || item.item_code,
      item.material_name || item.item_name || item.item_code,
      ...dimensionParams
    ]);
    if (byDim.length > 0) {
      stockRows = byDim;
    }
  }

  const totalStock = Math.round(stockRows.reduce((sum, row) => sum + parseFloat(row.current_stock || 0), 0) * 1000) / 1000;

  const requiredQty = Math.round(parseFloat(item.quantity || item.design_qty || 0) * 1000) / 1000;
  const releasedQty = Math.round(parseFloat(item.allocated_quantity || item.issued_qty || 0) * 1000) / 1000;
  const remainingQty = Math.max(0, Math.round((requiredQty - releasedQty) * 1000) / 1000);

  const statusUpper = (mrStatus || '').toUpperCase().trim().replace(/ /g, '_');
  let targetQty = requiredQty;
  if (statusUpper === 'PARTIALLY_RELEASED' || statusUpper === 'PARTIAL_RELEASED' || statusUpper === 'PARTIAL' || releasedQty > 0) {
    targetQty = remainingQty;
  }

  let isAvailable = false;
  if (statusUpper === 'FULFILLED' || statusUpper === 'COMPLETED') {
    isAvailable = totalStock > 0;
  } else {
    isAvailable = (totalStock + 0.001) >= targetQty;
  }

  return {
    resolvedItemCode,
    totalStock,
    requiredQty,
    releasedQty,
    remainingQty,
    targetQty,
    available: isAvailable,
    stocks: stockRows
  };
};

const resolveDimensionItemCodeInMemory = (sbRows, item) => {
  const lengthVal = parseFloat(item.length || 0);
  const widthVal = parseFloat(item.width || 0);
  const thicknessVal = parseFloat(item.thickness || 0);
  const diameterVal = parseFloat(item.diameter || 0);
  const outerDiameterVal = parseFloat(item.outer_diameter || item.outerDiameter || 0);
  const hasDimensions = (lengthVal > 0 || widthVal > 0 || thicknessVal > 0 || diameterVal > 0 || outerDiameterVal > 0);

  const cleanMatName = (name) => String(name || '').toLowerCase().trim();
  const itemNames = new Set([cleanMatName(item.item_name), cleanMatName(item.material_name), cleanMatName(item.item_code)].filter(Boolean));

  // If item has NO dimensions specified, match stock_balance by material_name with positive balance
  if (!hasDimensions) {
    const matched = sbRows.filter(sb => {
      const sbMatClean = cleanMatName(sb.material_name);
      return itemNames.has(sbMatClean) && parseFloat(sb.current_balance || 0) > 0;
    }).sort((a, b) => parseFloat(b.current_balance || 0) - parseFloat(a.current_balance || 0));
    
    if (matched.length > 0) return matched[0].item_code;
  }

  // 1. Check if item.item_code exists in stock_balance WITH positive stock AND matching dimensions
  if (item.item_code) {
    const matched = sbRows.filter(sb => {
      if (sb.item_code !== item.item_code || !(parseFloat(sb.current_balance || 0) > 0)) return false;
      if (hasDimensions) {
        if (lengthVal > 0 && Math.abs(parseFloat(sb.length || 0) - lengthVal) >= 0.0001) return false;
        if (widthVal > 0 && Math.abs(parseFloat(sb.width || 0) - widthVal) >= 0.0001) return false;
        if (thicknessVal > 0 && Math.abs(parseFloat(sb.thickness || 0) - thicknessVal) >= 0.0001) return false;
        if (diameterVal > 0 && Math.abs(parseFloat(sb.diameter || 0) - diameterVal) >= 0.0001) return false;
        if (outerDiameterVal > 0 && Math.abs(parseFloat(sb.outer_diameter || 0) - outerDiameterVal) >= 0.0001) return false;
      }
      return true;
    });
    if (matched.length > 0) return matched[0].item_code;
  }

  // 2. Check dimension matching for rows with positive stock
  {
    const shapeLower = (item.shape_type || item.shape_name || '').toLowerCase();
    
    const matched = sbRows.filter(sb => {
      const sbMatClean = cleanMatName(sb.material_name);
      if (!itemNames.has(sbMatClean) || !(parseFloat(sb.current_balance || 0) > 0)) return false;
      
      const sbLen = parseFloat(sb.length || 0);
      if (sbLen !== lengthVal) return false;
      
      if (shapeLower.includes('threaded rod') || shapeLower.includes('tr')) {
        if (parseFloat(sb.thickness || 0) !== thicknessVal) return false;
        if (parseFloat(sb.diameter || 0) !== diameterVal) return false;
      } else if ((shapeLower.includes('pipe') || shapeLower.includes('round tube') || shapeLower.includes('tube')) && !shapeLower.includes('square') && !shapeLower.includes('rectangular')) {
        if (parseFloat(sb.thickness || 0) !== thicknessVal) return false;
        if (parseFloat(sb.outer_diameter || 0) !== outerDiameterVal) return false;
      } else if (shapeLower.includes('round bar') || shapeLower.includes('round') || shapeLower.includes('rb') || shapeLower.includes('wire')) {
        if (parseFloat(sb.diameter || 0) !== diameterVal) return false;
      } else if (shapeLower.includes('hex')) {
        if (parseFloat(sb.width || 0) !== widthVal) return false;
      } else if (shapeLower.includes('square') || shapeLower.includes('sq')) {
        if (parseFloat(sb.width || 0) !== widthVal) return false;
      } else {
        if (widthVal > 0 && parseFloat(sb.width || 0) !== widthVal) return false;
        if (thicknessVal > 0 && parseFloat(sb.thickness || 0) !== thicknessVal) return false;
        if (outerDiameterVal > 0 && parseFloat(sb.outer_diameter || 0) !== outerDiameterVal) return false;
      }
      return true;
    }).sort((a, b) => parseFloat(b.current_balance || 0) - parseFloat(a.current_balance || 0));

    if (matched.length > 0) return matched[0].item_code;
  }

  return item.item_code;
};

const calculateItemStockAndAvailabilityInMemory = (sbRows, item, mrStatus = '') => {
  const resolvedItemCode = resolveDimensionItemCodeInMemory(sbRows, item);

  let stockRows = [];
  const candidateCodes = Array.from(new Set([resolvedItemCode, item.item_code].filter(Boolean)));

  // 1. Check by candidate item_codes in stock_balance
  for (const code of candidateCodes) {
    const matched = sbRows.filter(sb => sb.item_code === code && parseFloat(sb.current_balance || 0) > 0);
    if (matched.length > 0) {
      stockRows = matched.map(sb => ({ warehouse_name: sb.warehouse, current_stock: sb.current_balance }));
      break;
    }
  }

  // 2. If no stock by code, perform dimension-based fallback lookup across stock_balance
  if (stockRows.length === 0) {
    const lengthVal = parseFloat(item.length || 0);
    const widthVal = parseFloat(item.width || 0);
    const thicknessVal = parseFloat(item.thickness || 0);
    const diameterVal = parseFloat(item.diameter || 0);
    const outerDiameterVal = parseFloat(item.outer_diameter || item.outerDiameter || 0);

    const cleanMatName = (name) => String(name || '').toLowerCase().trim();
    const itemNames = new Set([cleanMatName(item.item_name), cleanMatName(item.material_name), cleanMatName(item.item_code)].filter(Boolean));
    const shapeLower = (item.shape_type || item.shape_name || '').toLowerCase();

    const matched = sbRows.filter(sb => {
      const sbMatClean = cleanMatName(sb.material_name);
      if (!itemNames.has(sbMatClean) || !(parseFloat(sb.current_balance || 0) > 0)) return false;

      const sbLen = parseFloat(sb.length || 0);
      if (sbLen !== lengthVal) return false;

      if (shapeLower.includes('threaded rod') || shapeLower.includes('tr')) {
        if (parseFloat(sb.thickness || 0) !== thicknessVal) return false;
        if (parseFloat(sb.diameter || 0) !== diameterVal) return false;
      } else if ((shapeLower.includes('pipe') || shapeLower.includes('round tube') || shapeLower.includes('tube')) && !shapeLower.includes('square') && !shapeLower.includes('rectangular')) {
        if (parseFloat(sb.thickness || 0) !== thicknessVal) return false;
        if (parseFloat(sb.outer_diameter || 0) !== outerDiameterVal) return false;
      } else if (shapeLower.includes('round bar') || shapeLower.includes('round') || shapeLower.includes('rb') || shapeLower.includes('wire')) {
        if (parseFloat(sb.diameter || 0) !== diameterVal) return false;
      } else if (shapeLower.includes('hex')) {
        if (parseFloat(sb.width || 0) !== widthVal) return false;
      } else if (shapeLower.includes('square') || shapeLower.includes('sq')) {
        if (parseFloat(sb.width || 0) !== widthVal) return false;
      } else {
        if (widthVal > 0 && parseFloat(sb.width || 0) !== widthVal) return false;
        if (thicknessVal > 0 && parseFloat(sb.thickness || 0) !== thicknessVal) return false;
        if (outerDiameterVal > 0 && parseFloat(sb.outer_diameter || 0) !== outerDiameterVal) return false;
      }
      return true;
    });

    if (matched.length > 0) {
      stockRows = matched.map(sb => ({ warehouse_name: sb.warehouse, current_stock: sb.current_balance }));
    }
  }

  const totalStock = Math.round(stockRows.reduce((sum, row) => sum + parseFloat(row.current_stock || 0), 0) * 1000) / 1000;

  const requiredQty = Math.round(parseFloat(item.quantity || item.design_qty || 0) * 1000) / 1000;
  const releasedQty = Math.round(parseFloat(item.allocated_quantity || item.issued_qty || 0) * 1000) / 1000;
  const remainingQty = Math.max(0, Math.round((requiredQty - releasedQty) * 1000) / 1000);

  const statusUpper = (mrStatus || '').toUpperCase().trim().replace(/ /g, '_');
  let targetQty = requiredQty;
  if (statusUpper === 'PARTIALLY_RELEASED' || statusUpper === 'PARTIAL_RELEASED' || statusUpper === 'PARTIAL' || releasedQty > 0) {
    targetQty = remainingQty;
  }

  let isAvailable = false;
  if (statusUpper === 'FULFILLED' || statusUpper === 'COMPLETED') {
    isAvailable = totalStock > 0;
  } else {
    isAvailable = (totalStock + 0.001) >= targetQty;
  }

  return {
    resolvedItemCode,
    totalStock,
    requiredQty,
    releasedQty,
    remainingQty,
    targetQty,
    available: isAvailable,
    stocks: stockRows
  };
};

const materialRequestController = {
  getAll: async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT mr.*, CONCAT(u.first_name, ' ', u.last_name) as requester_name,
        COALESCE(
          (
            SELECT COALESCE(soi.drawing_no, oi.drawing_no)
            FROM production_plan_items ppi_dr
            LEFT JOIN sales_order_items soi ON ppi_dr.sales_order_item_id = soi.id
            LEFT JOIN order_items oi ON ppi_dr.sales_order_item_id = oi.id AND ppi_dr.sales_order_id = oi.order_id
            WHERE ppi_dr.plan_id = pp.id
            LIMIT 1
          ),
          pp.bom_no
        ) as drawing_no,
        ppi.description as finished_good,
        COALESCE(
          (
            SELECT so.project_name 
            FROM production_plans pp
            LEFT JOIN (
              SELECT plan_id, sales_order_item_id FROM production_plan_items
              WHERE id IN (SELECT MIN(id) FROM production_plan_items GROUP BY plan_id)
            ) ppi ON pp.id = ppi.plan_id
            LEFT JOIN sales_order_items soi ON ppi.sales_order_item_id = soi.id
            LEFT JOIN sales_orders so ON (
              (soi.id IS NOT NULL AND soi.sales_order_id = so.id) OR
              (soi.id IS NULL AND pp.sales_order_id = so.id)
            )
            WHERE pp.id = mr.plan_id
          ),
          (
            SELECT o.project_name 
            FROM production_plans pp
            JOIN orders o ON pp.sales_order_id = o.id AND o.source_type = 'DIRECT'
            WHERE pp.id = mr.plan_id
          ),
          (SELECT so2.project_name FROM sales_orders so2 WHERE mr.notes LIKE CONCAT('%', so2.project_name, '%') LIMIT 1),
          (SELECT o2.project_name FROM orders o2 WHERE mr.notes LIKE CONCAT('%', o2.project_name, '%') LIMIT 1),
          (SELECT so3.project_name FROM sales_orders so3 WHERE mr.notes REGEXP CONCAT('SO-[0-9]{4}-', LPAD(so3.id, 4, '0')) LIMIT 1),
          (SELECT so4.project_name FROM sales_orders so4 WHERE mr.purpose LIKE CONCAT('%', so4.project_name, '%') LIMIT 1),
          '-'
        ) as project_name
        FROM material_requests mr
        LEFT JOIN users u ON mr.requested_by = u.id
        LEFT JOIN production_plans pp ON mr.plan_id = pp.id
        LEFT JOIN (
          SELECT plan_id, description FROM production_plan_items
          WHERE id IN (SELECT MIN(id) FROM production_plan_items GROUP BY plan_id)
        ) ppi ON pp.id = ppi.plan_id
        ORDER BY mr.created_at DESC
      `);

      if (rows.length > 0) {
        const mrIds = rows.map(r => r.id);
        const [mris] = await pool.query(`
          SELECT mri.*, COALESCE(mri.shape_type, shape_lookup.shape_name) as shape_type
          FROM material_request_items mri
          LEFT JOIN (
              SELECT som.material_name, som.length, som.width, som.thickness, som.diameter, som.outer_diameter,
                     MAX(s.name) as shape_name
              FROM sales_order_item_materials som
              LEFT JOIN shapes s ON som.shape_id = s.id
              GROUP BY som.material_name, som.length, som.width, som.thickness, som.diameter, som.outer_diameter
          ) shape_lookup ON (
              LOWER(TRIM(REPLACE(mri.item_name, '\\t', ''))) = LOWER(TRIM(REPLACE(shape_lookup.material_name, '\\t', '')))
              AND ABS(COALESCE(mri.length, 0) - COALESCE(shape_lookup.length, 0)) < 0.0001
              AND ABS(COALESCE(mri.width, 0) - COALESCE(shape_lookup.width, 0)) < 0.0001
              AND ABS(COALESCE(mri.thickness, 0) - COALESCE(shape_lookup.thickness, 0)) < 0.0001
              AND ABS(COALESCE(mri.diameter, 0) - COALESCE(shape_lookup.diameter, 0)) < 0.0001
              AND ABS(COALESCE(mri.outer_diameter, 0) - COALESCE(shape_lookup.outer_diameter, 0)) < 0.0001
          )
          WHERE mri.mr_id IN (${mrIds.join(',')})
            AND UPPER(COALESCE(mri.item_type, '')) NOT IN ('FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY')
        `);

        // Batch query stock balances
        const [sbRows] = await pool.query(`
          SELECT sb.item_code, sb.material_name, sb.length, sb.width, sb.thickness, sb.diameter, sb.outer_diameter, sb.current_balance, sb.warehouse, s.name as shape_name
          FROM stock_balance sb
          LEFT JOIN shapes s ON sb.shape_id = s.id
          WHERE sb.current_balance > 0
        `);

        // Map items by mr_id
        const mriMap = {};
        for (const mri of mris) {
          if (!mriMap[mri.mr_id]) mriMap[mri.mr_id] = [];
          mriMap[mri.mr_id].push(mri);
        }

        // Process availability in JS using calculateItemStockAndAvailabilityInMemory
        for (const mr of rows) {
          const mrItems = mriMap[mr.id] || [];
          if (mrItems.length === 0) {
            mr.availability = 'available';
            continue;
          }

          let mrAvailability = 'available';

          for (const item of mrItems) {
            const availInfo = calculateItemStockAndAvailabilityInMemory(sbRows, item, mr.status);
            if (!availInfo.available) {
              mrAvailability = 'unavailable';
            }
          }

          mr.availability = mrAvailability;
        }
      }

      res.json(rows);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const { warehouse } = req.query;
      const [requests] = await pool.query(`
        SELECT mr.*, CONCAT(u.first_name, ' ', u.last_name) as requester_name,
        COALESCE(
          (
            SELECT COALESCE(soi.drawing_no, oi.drawing_no)
            FROM production_plan_items ppi_dr
            LEFT JOIN sales_order_items soi ON ppi_dr.sales_order_item_id = soi.id
            LEFT JOIN order_items oi ON ppi_dr.sales_order_item_id = oi.id AND ppi_dr.sales_order_id = oi.order_id
            WHERE ppi_dr.plan_id = pp.id
            LIMIT 1
          ),
          pp.bom_no
        ) as drawing_no,
        ppi.description as finished_good,
        COALESCE(
          (
            SELECT so.project_name 
            FROM production_plans pp
            LEFT JOIN (
              SELECT plan_id, sales_order_item_id FROM production_plan_items
              WHERE id IN (SELECT MIN(id) FROM production_plan_items GROUP BY plan_id)
            ) ppi ON pp.id = ppi.plan_id
            LEFT JOIN sales_order_items soi ON ppi.sales_order_item_id = soi.id
            LEFT JOIN sales_orders so ON (
              (soi.id IS NOT NULL AND soi.sales_order_id = so.id) OR
              (soi.id IS NULL AND pp.sales_order_id = so.id)
            )
            WHERE pp.id = mr.plan_id
          ),
          (
            SELECT o.project_name 
            FROM production_plans pp
            JOIN orders o ON pp.sales_order_id = o.id AND o.source_type = 'DIRECT'
            WHERE pp.id = mr.plan_id
          ),
          (SELECT so2.project_name FROM sales_orders so2 WHERE mr.notes LIKE CONCAT('%', so2.project_name, '%') LIMIT 1),
          (SELECT o2.project_name FROM orders o2 WHERE mr.notes LIKE CONCAT('%', o2.project_name, '%') LIMIT 1),
          (SELECT so3.project_name FROM sales_orders so3 WHERE mr.notes REGEXP CONCAT('SO-[0-9]{4}-', LPAD(so3.id, 4, '0')) LIMIT 1),
          (SELECT so4.project_name FROM sales_orders so4 WHERE mr.purpose LIKE CONCAT('%', so4.project_name, '%') LIMIT 1),
          '-'
        ) as project_name
        FROM material_requests mr
        LEFT JOIN users u ON mr.requested_by = u.id
        LEFT JOIN production_plans pp ON mr.plan_id = pp.id
        LEFT JOIN (
          SELECT plan_id, description FROM production_plan_items
          WHERE id IN (SELECT MIN(id) FROM production_plan_items GROUP BY plan_id)
        ) ppi ON pp.id = ppi.plan_id
        WHERE mr.id = ?
      `, [id]);

      if (requests.length === 0) {
        return res.status(404).json({ message: 'Material Request not found' });
      }

      const request = requests[0];

      const [items] = await pool.query(`
        SELECT mri.*, 
               COALESCE(mri.shape_type, shape_lookup.shape_name) as shape_type,
               COALESCE(mri.item_name, sb.material_name, sb.item_description, mri.item_code) as name, 
               COALESCE(mri.uom, sb.unit) as uom,
               COALESCE(mri.item_type, sb.material_type) as material_type,
               COALESCE(NULLIF(mri.length, 0), sb.length, 0) as length,
               COALESCE(NULLIF(mri.width, 0), sb.width, 0) as width,
               COALESCE(NULLIF(mri.thickness, 0), sb.thickness, 0) as thickness,
               COALESCE(NULLIF(mri.diameter, 0), sb.diameter, 0) as diameter,
               COALESCE(NULLIF(mri.outer_diameter, 0), sb.outer_diameter, 0) as outer_diameter,
               COALESCE(NULLIF(mri.density, 0), sb.density, 0) as density,
               COALESCE(NULLIF(mri.weight_per_unit, 0), sb.weight_per_unit, 0) as weight_per_unit,
               COALESCE(
                 (
                   SELECT ppi.uom 
                   FROM production_plan_items ppi 
                   WHERE ppi.plan_id = mr.plan_id 
                   LIMIT 1
                 ),
                 'Nos'
               ) as fg_uom
        FROM material_request_items mri
        JOIN material_requests mr ON mri.mr_id = mr.id
        LEFT JOIN (
          SELECT item_code, 
                 MAX(material_name) as material_name, 
                 MAX(item_description) as item_description, 
                 MAX(unit) as unit,
                 MAX(material_type) as material_type,
                 MAX(length) as length,
                 MAX(width) as width,
                 MAX(thickness) as thickness,
                 MAX(diameter) as diameter,
                 MAX(outer_diameter) as outer_diameter,
                 MAX(density) as density,
                 MAX(weight_per_unit) as weight_per_unit
          FROM stock_balance 
          GROUP BY item_code
        ) sb ON mri.item_code = sb.item_code
        LEFT JOIN (
            SELECT som.material_name, som.length, som.width, som.thickness, som.diameter, som.outer_diameter,
                   MAX(s.name) as shape_name
            FROM sales_order_item_materials som
            LEFT JOIN shapes s ON som.shape_id = s.id
            GROUP BY som.material_name, som.length, som.width, som.thickness, som.diameter, som.outer_diameter
        ) shape_lookup ON (
            LOWER(TRIM(REPLACE(mri.item_name, '\t', ''))) = LOWER(TRIM(REPLACE(shape_lookup.material_name, '\t', '')))
            AND ABS(COALESCE(mri.length, 0) - COALESCE(shape_lookup.length, 0)) < 0.0001
            AND ABS(COALESCE(mri.width, 0) - COALESCE(shape_lookup.width, 0)) < 0.0001
            AND ABS(COALESCE(mri.thickness, 0) - COALESCE(shape_lookup.thickness, 0)) < 0.0001
            AND ABS(COALESCE(mri.diameter, 0) - COALESCE(shape_lookup.diameter, 0)) < 0.0001
            AND ABS(COALESCE(mri.outer_diameter, 0) - COALESCE(shape_lookup.outer_diameter, 0)) < 0.0001
        )
        WHERE mri.mr_id = ?
      `, [id]);

      // Fetch stock info for each item
      const selectedWh = warehouse || request.source_warehouse;

      let allItemsAvailable = true;

      for (let item of items) {
        const availInfo = await calculateItemStockAndAvailability(pool, item, request.status);

        item.resolved_item_code = availInfo.resolvedItemCode;
        item.stocks = availInfo.stocks;
        item.total_stock = availInfo.totalStock;

        const suggestedWh = availInfo.stocks.length > 0
          ? availInfo.stocks.reduce((prev, current) => (parseFloat(prev.current_stock) > parseFloat(current.current_stock)) ? prev : current)
          : null;

        item.suggested_warehouse = suggestedWh ? suggestedWh.warehouse_name : null;

        const matchingWh = availInfo.stocks.find(s => s.warehouse_name === selectedWh);
        item.current_stock = matchingWh ? parseFloat(matchingWh.current_stock) : 0;

        item.fulfillment_source = (availInfo.remainingQty <= 0 || availInfo.totalStock >= availInfo.remainingQty) ? 'STOCK' : 'PURCHASE';

        if (!availInfo.available) {
          allItemsAvailable = false;
        }
      }

      request.items = items;
      request.all_items_available = allItemsAvailable;
      request.suggested_fulfillment_mode = allItemsAvailable ? 'STOCK' : 'PURCHASE';

      res.json(request);
    } catch (error) {
      console.error('Error in getById:', error);
      res.status(500).json({ message: error.message });
    }
  },

  updateWarehouse: async (req, res) => {
    try {
      const { id } = req.params;
      const { source_warehouse, target_warehouse } = req.body;

      const updates = [];
      const params = [];

      if (source_warehouse !== undefined) {
        updates.push('source_warehouse = ?');
        params.push(source_warehouse);
      }

      if (target_warehouse !== undefined) {
        updates.push('target_warehouse = ?');
        params.push(target_warehouse);
      }

      if (updates.length === 0) {
        return res.status(400).json({ message: 'No warehouse provided' });
      }

      params.push(id);
      await pool.query(`UPDATE material_requests SET ${updates.join(', ')} WHERE id = ?`, params);

      res.json({ message: 'Warehouses updated successfully' });
    } catch (error) {
      console.error('Error in updateWarehouse:', error);
      res.status(500).json({ message: error.message });
    }
  },

  updateStatus: async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const { id } = req.params;
      const { status } = req.body;
      const normalizedStatus = status.toUpperCase();
      let finalStatus = normalizedStatus;

      // If status is being updated to COMPLETED or FULFILLED, trigger stock out
      if (normalizedStatus === 'COMPLETED' || normalizedStatus === 'FULFILLED') {
        // Fetch MR and its items
        const [mrRows] = await connection.query('SELECT * FROM material_requests WHERE id = ?', [id]);
        if (mrRows.length === 0) {
          throw new Error('Material Request not found');
        }
        const mr = mrRows[0];

        // Only process stock out if it wasn't already completed/fulfilled
        if (mr.status?.toUpperCase() !== 'COMPLETED' && mr.status?.toUpperCase() !== 'FULFILLED') {
          const [items] = await connection.query('SELECT * FROM material_request_items WHERE mr_id = ?', [id]);

          for (const item of items) {
            const resolvedItemCode = await resolveDimensionItemCode(connection, item);
            if (!resolvedItemCode && (item.uom || '').toLowerCase().trim().includes('kg')) {
              throw new Error(`No matching stock record found in inventory for material '${item.item_name || item.item_code}' with requested dimensions.`);
            }
            const requiredQty = parseFloat(item.quantity || item.design_qty || 0);
            const releasedQty = parseFloat(item.allocated_quantity || 0);
            const remainingQty = Math.max(0, requiredQty - releasedQty);

            if (remainingQty > 0) {
              // Find warehouses with positive stock balance for this item
              let [stockRows] = await connection.query(`
                SELECT item_code, warehouse, current_balance 
                FROM stock_balance 
                WHERE item_code = ? AND current_balance > 0
                ORDER BY current_balance DESC
              `, [resolvedItemCode]);

              if (stockRows.length === 0 && item.item_code && item.item_code !== resolvedItemCode) {
                [stockRows] = await connection.query(`
                  SELECT item_code, warehouse, current_balance 
                  FROM stock_balance 
                  WHERE item_code = ? AND current_balance > 0
                  ORDER BY current_balance DESC
                `, [item.item_code]);
              }

              let amountToDeduct = remainingQty;

              if (stockRows.length > 0) {
                for (const stockRow of stockRows) {
                  if (amountToDeduct <= 0) break;
                  const availableInWh = parseFloat(stockRow.current_balance || 0);
                  if (availableInWh <= 0) continue;

                  const issueQty = Math.min(amountToDeduct, availableInWh);

                  await stockService.addStockLedgerEntry(
                    stockRow.item_code,
                    'OUT',
                    issueQty,
                    'Material Request',
                    mr.id,
                    mr.mr_number,
                    {
                      remarks: `Material released for MR: ${mr.mr_number}`,
                      userId: req.user?.id || 1,
                      warehouse: stockRow.warehouse,
                      materialName: item.item_name,
                      materialType: item.item_type,
                      unit: item.uom,
                      length: item.length,
                      width: item.width,
                      thickness: item.thickness,
                      diameter: item.diameter,
                      outer_diameter: item.outer_diameter,
                      density: item.density,
                      weight_per_unit: item.weight_per_unit,
                      shape_type: item.shape_type
                    },
                    connection
                  );

                  amountToDeduct -= issueQty;
                }
              } else {
                // If no positive stock rows found, fall back to resolved item code and default warehouse
                await stockService.addStockLedgerEntry(
                  resolvedItemCode,
                  'OUT',
                  remainingQty,
                  'Material Request',
                  mr.id,
                  mr.mr_number,
                  {
                    remarks: `Material released for MR: ${mr.mr_number}`,
                    userId: req.user?.id || 1,
                    warehouse: mr.source_warehouse || 'Main Warehouse',
                    materialName: item.item_name,
                    materialType: item.item_type,
                    unit: item.uom,
                    length: item.length,
                    width: item.width,
                    thickness: item.thickness,
                    diameter: item.diameter,
                    outer_diameter: item.outer_diameter,
                    density: item.density,
                    weight_per_unit: item.weight_per_unit,
                    shape_type: item.shape_type
                  },
                  connection
                );
              }
            }

            // Always update allocated_quantity to requiredQty on completion
            await connection.execute(
              `UPDATE material_request_items SET allocated_quantity = ? WHERE id = ?`,
              [requiredQty, item.id]
            );
          }

          // If linked to a production plan, update its material status
          if (mr.plan_id) {
            await connection.query(
              "UPDATE production_plan_materials SET status = 'FULFILLED' WHERE plan_id = ?",
              [mr.plan_id]
            );
          }
        }
      } else if (normalizedStatus === 'PARTIALLY_RELEASED') {
        // Fetch MR and its items
        const [mrRows] = await connection.query('SELECT * FROM material_requests WHERE id = ?', [id]);
        if (mrRows.length === 0) {
          throw new Error('Material Request not found');
        }
        const mr = mrRows[0];

        // Fetch items
        const [items] = await connection.query('SELECT * FROM material_request_items WHERE mr_id = ?', [id]);

        // Find work_order linked to this plan/mr
        let workOrderId = null;
        if (mr.plan_id) {
          const [woRows] = await connection.query('SELECT id FROM work_orders WHERE plan_id = ? LIMIT 1', [mr.plan_id]);
          if (woRows.length > 0) {
            workOrderId = woRows[0].id;
          }
        }

        // Generate Material Issue number
        const [countRows] = await connection.query('SELECT COUNT(*) as count FROM material_issues');
        const count = countRows[0].count + 1;
        const issueNumber = `MI-${new Date().getFullYear().toString().slice(-2)}-${count.toString().padStart(4, '0')}`;

        // Create Material Issue header if we have a work_order
        let issueId = null;
        if (workOrderId) {
          const [miResult] = await connection.execute(
            `INSERT INTO material_issues (issue_number, work_order_id, issued_by, remarks)
             VALUES (?, ?, ?, ?)`,
            [issueNumber, workOrderId, req.user?.id || 1, `Partial release for MR: ${mr.mr_number}`]
          );
          issueId = miResult.insertId;
        }

        // Loop items and deduct available stock
        for (const item of items) {
          const resolvedItemCode = await resolveDimensionItemCode(connection, item);
          if (!resolvedItemCode && (item.uom || '').toLowerCase().trim().includes('kg')) {
            // Skip this item during partial release since no matching stock is available
            continue;
          }

          // Get total stock available across all warehouses for this item
          const [stockRows] = await connection.query(`
            SELECT warehouse, current_balance 
            FROM stock_balance 
            WHERE item_code = ? AND current_balance > 0
            ORDER BY current_balance DESC
          `, [resolvedItemCode]);

          const totalStock = stockRows.reduce((sum, row) => sum + parseFloat(row.current_balance), 0);
          const requiredQty = parseFloat(item.quantity || item.design_qty || 0);
          const allocatedQty = parseFloat(item.allocated_quantity || 0);
          const remainingQty = Math.max(0, requiredQty - allocatedQty);

          if (remainingQty <= 0 || totalStock <= 0) {
            // Skip this material if no remaining quantity is needed or no stock is available
            continue;
          }

          let amountToDeduct = remainingQty;

          for (const stockRow of stockRows) {
            if (amountToDeduct <= 0) break;
            const availableInWarehouse = parseFloat(stockRow.current_balance || 0);
            if (availableInWarehouse <= 0) continue;

            const issueQty = Math.min(amountToDeduct, availableInWarehouse);

            if (issueQty > 0) {
              // If we have a work_order and issueId, insert into material_issue_items
              if (issueId) {
                await connection.execute(
                  `INSERT INTO material_issue_items (issue_id, material_name, material_type, item_code, quantity, uom, warehouse)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [issueId, item.item_name, item.item_type, resolvedItemCode, issueQty, item.uom, stockRow.warehouse]
                );
              }

              // Deduct from stock ledger
              await stockService.addStockLedgerEntry(
                resolvedItemCode,
                'OUT',
                issueQty,
                issueId ? 'MATERIAL_ISSUE' : 'Material Request',
                issueId || mr.id,
                issueId ? issueNumber : mr.mr_number,
                {
                  remarks: `Partial release for MR: ${mr.mr_number}`,
                  userId: req.user?.id || 1,
                  warehouse: stockRow.warehouse,
                  materialName: item.item_name,
                  materialType: item.item_type,
                  unit: item.uom,
                  length: item.length,
                  width: item.width,
                  thickness: item.thickness,
                  diameter: item.diameter,
                  outer_diameter: item.outer_diameter,
                  density: item.density,
                  weight_per_unit: item.weight_per_unit,
                  shape_type: item.shape_type
                },
                connection
              );

              // Update allocated_quantity in material_request_items
              await connection.execute(
                `UPDATE material_request_items SET allocated_quantity = COALESCE(allocated_quantity, 0) + ? WHERE id = ?`,
                [issueQty, item.id]
              );

              amountToDeduct -= issueQty;
            }
          }
        }

        // Check if all items are now fully released
        const [updatedItems] = await connection.query(
          'SELECT id, quantity, allocated_quantity FROM material_request_items WHERE mr_id = ?',
          [id]
        );
        const allFullyReleased = updatedItems.every(item => {
          const req = parseFloat(item.quantity || 0);
          const alloc = parseFloat(item.allocated_quantity || 0);
          return alloc >= req;
        });

        if (allFullyReleased) {
          finalStatus = 'FULFILLED';
        } else {
          finalStatus = 'PARTIALLY_RELEASED';
        }

        // If linked to a production plan, update its material status
        if (mr.plan_id) {
          await connection.query(
            "UPDATE production_plan_materials SET status = ? WHERE plan_id = ?",
            [finalStatus, mr.plan_id]
          );
        }
      }

      await connection.query('UPDATE material_requests SET status = ? WHERE id = ?', [finalStatus, id]);

      await connection.commit();
      res.json({ message: `Material Request status updated to ${finalStatus}` });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Error in updateStatus:', error);
      res.status(500).json({ message: error.message });
    } finally {
      if (connection) connection.release();
    }
  },

  create: async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const { department, requested_by, required_by, purpose, notes, items, target_warehouse, source_warehouse } = req.body;

      // Handle optional fields
      const requesterId = requested_by && requested_by !== '' ? requested_by : null;
      const requiredByDate = required_by && required_by !== '' ? required_by : null;
      const targetWh = target_warehouse && target_warehouse !== '' ? target_warehouse : null;
      const sourceWh = source_warehouse && source_warehouse !== '' ? source_warehouse : null;

      // Generate MR Number: MR-YYYYMMDD-XXX
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const [lastMr] = await connection.query(
        'SELECT mr_number FROM material_requests WHERE mr_number LIKE ? ORDER BY id DESC LIMIT 1',
        [`MR-${dateStr}-%`]
      );

      let nextNum = 1;
      if (lastMr && lastMr.length > 0) {
        const lastMrNum = lastMr[0].mr_number;
        const parts = lastMrNum.split('-');
        const lastSeq = parseInt(parts[parts.length - 1]);
        if (!isNaN(lastSeq)) {
          nextNum = lastSeq + 1;
        }
      }
      const mrNumber = `MR-${dateStr}-${nextNum.toString().padStart(3, '0')}`;

      const [result] = await connection.query(
        'INSERT INTO material_requests (mr_number, department, requested_by, required_by, purpose, notes, status, target_warehouse, source_warehouse) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [mrNumber, department, requesterId, requiredByDate, purpose, notes, 'DRAFT', targetWh, sourceWh]
      );

      const mrId = result.insertId;

      if (items && items.length > 0) {
        const itemValues = items.map(item => [
          mrId,
          item.item_code,
          item.item_name || null,
          item.item_type || null,
          item.design_qty || item.quantity,
          item.quantity,
          item.unit_rate || 0,
          item.uom || 'pcs',
          item.warehouse || null,
          item.length || 0,
          item.width || 0,
          item.thickness || 0,
          item.diameter || 0,
          item.outer_diameter || 0,
          item.density || 0,
          item.weight_per_unit || 0,
          item.shape_type || item.shape_name || item.shape || null
        ]);

        await connection.query(
          'INSERT INTO material_request_items (mr_id, item_code, item_name, item_type, design_qty, quantity, unit_rate, uom, warehouse, length, width, thickness, diameter, outer_diameter, density, weight_per_unit, shape_type) VALUES ?',
          [itemValues]
        );
      }

      await connection.commit();
      res.status(201).json({ message: 'Material Request created successfully', id: mrId, mr_number: mrNumber });
    } catch (error) {
      await connection.rollback();
      console.error('Error creating material request:', error);
      res.status(500).json({ message: error.message });
    } finally {
      connection.release();
    }
  },

  addItem: async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const { id } = req.params;
      const { item_code, quantity, design_qty, remarks } = req.body;

      if (!item_code || !quantity) {
        return res.status(400).json({ message: 'item_code and quantity are required' });
      }

      // Fetch item info from stock_balance or stock_items
      const [itemRows] = await connection.query(
        `SELECT item_code, material_name as item_name, material_type as item_type, unit as uom,
                length, width, thickness, diameter, outer_diameter, density, weight_per_unit, valuation_rate as unit_rate
         FROM stock_balance 
         WHERE item_code = ? 
         LIMIT 1`,
        [item_code]
      );

      let itemInfo = itemRows[0] || {};
      if (itemRows.length === 0) {
        const [masterRows] = await connection.query(
          `SELECT item_code, item_description as item_name, material_type as item_type, unit as uom,
                  length, width, thickness, diameter, outer_diameter, density, weight_per_unit, valuation_rate as unit_rate
           FROM stock_items 
           WHERE item_code = ? 
           LIMIT 1`,
          [item_code]
        );
        itemInfo = masterRows[0] || {};
      }

      await connection.query(
        `INSERT INTO material_request_items 
          (mr_id, item_code, item_name, item_type, design_qty, quantity, unit_rate, uom, length, width, thickness, diameter, outer_diameter, density, weight_per_unit, item_source, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          item_code,
          itemInfo.item_name || item_code,
          itemInfo.item_type || 'Raw Material',
          (design_qty !== undefined && design_qty !== null && design_qty !== '') ? parseFloat(design_qty) : null,
          parseFloat(quantity),
          itemInfo.unit_rate || 0,
          itemInfo.uom || 'pcs',
          itemInfo.length || 0,
          itemInfo.width || 0,
          itemInfo.thickness || 0,
          itemInfo.diameter || 0,
          itemInfo.outer_diameter || 0,
          itemInfo.density || 0,
          itemInfo.weight_per_unit || 0,
          'MANUAL',
          remarks || null
        ]
      );

      await connection.commit();
      res.json({ message: 'Item added successfully' });
    } catch (error) {
      await connection.rollback();
      console.error('Error adding item to Material Request:', error);
      res.status(500).json({ message: error.message });
    } finally {
      connection.release();
    }
  },

  deleteItem: async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const { id, itemId } = req.params;

      const [result] = await connection.query(
        'DELETE FROM material_request_items WHERE id = ? AND mr_id = ?',
        [itemId, id]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({ message: 'Item not found in this Material Request' });
      }

      await connection.commit();
      res.json({ message: 'Item deleted successfully from Material Request' });
    } catch (error) {
      await connection.rollback();
      console.error('Error deleting item from Material Request:', error);
      res.status(500).json({ message: error.message });
    } finally {
      connection.release();
    }
  },

  delete: async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const { id } = req.params;

      // Delete items first
      await connection.query('DELETE FROM material_request_items WHERE mr_id = ?', [id]);

      // Delete request
      const [result] = await connection.query('DELETE FROM material_requests WHERE id = ?', [id]);

      if (result.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({ message: 'Material Request not found' });
      }

      await connection.commit();
      res.json({ message: 'Material Request deleted successfully' });
    } catch (error) {
      await connection.rollback();
      console.error('Error deleting material request:', error);
      res.status(500).json({ message: error.message });
    } finally {
      connection.release();
    }
  }
};

module.exports = materialRequestController;
