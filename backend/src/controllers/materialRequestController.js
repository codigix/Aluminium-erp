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

  const lengthVal1 = parseFloat(item.length || 0);
  const widthVal1 = parseFloat(item.width || 0);
  const thicknessVal1 = parseFloat(item.thickness || 0);
  const diameterVal1 = parseFloat(item.diameter || 0);
  const outerDiameterVal1 = parseFloat(item.outer_diameter || item.outerDiameter || 0);
  const hasDimensions1 = (lengthVal1 > 0 || widthVal1 > 0 || thicknessVal1 > 0 || diameterVal1 > 0 || outerDiameterVal1 > 0);

  // 1. Check by candidate item_codes in stock_balance WITH dimension filter (non-zero dims only)
  for (const code of candidateCodes) {
    let dimQuery = `
      SELECT warehouse as warehouse_name, current_balance as current_stock, COALESCE(current_weight, 0) as current_weight
      FROM stock_balance
      WHERE item_code = ? AND current_balance > 0`;
    const dimParams = [code];

    // Only filter on non-zero dimensions (zero means "not applicable for this shape")
    if (lengthVal1 > 0) { dimQuery += ' AND (ABS(COALESCE(length, 0) - ?) < 0.0001)'; dimParams.push(lengthVal1); }
    if (widthVal1 > 0) { dimQuery += ' AND (ABS(COALESCE(width, 0) - ?) < 0.0001)'; dimParams.push(widthVal1); }
    if (thicknessVal1 > 0) { dimQuery += ' AND (ABS(COALESCE(thickness, 0) - ?) < 0.0001)'; dimParams.push(thicknessVal1); }
    if (diameterVal1 > 0) { dimQuery += ' AND (ABS(COALESCE(diameter, 0) - ?) < 0.0001)'; dimParams.push(diameterVal1); }
    if (outerDiameterVal1 > 0) { dimQuery += ' AND (ABS(COALESCE(outer_diameter, 0) - ?) < 0.0001)'; dimParams.push(outerDiameterVal1); }

    const [byCode] = await connection.query(dimQuery, dimParams);
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
      SELECT warehouse as warehouse_name, current_balance as current_stock, COALESCE(current_weight, 0) as current_weight
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
  const totalWeight = Math.round(stockRows.reduce((sum, row) => sum + parseFloat(row.current_weight || 0), 0) * 1000) / 1000;

  const matType = (item.material_type || item.item_type || '').toUpperCase().trim();
  const uomClean = (item.uom || item.unit || '').toUpperCase().trim();
  const isKgUom = uomClean === 'KG' || uomClean === 'KGS' || uomClean === 'KILOGRAM';
  const isBoughtOut = matType.includes('BOUGHT') || (item.item_code && String(item.item_code).toUpperCase().startsWith('BO-')) || !isKgUom;

  if (isBoughtOut) {
    const requiredQty = Math.round(parseFloat(item.quantity || item.design_qty || 0) * 1000) / 1000;
    const requiredWeight = 0;
    const releasedQty = Math.round(parseFloat(item.allocated_quantity || 0) * 1000) / 1000;
    const releasedWeight = 0;

    const remainingQty = Math.max(0, Math.round((requiredQty - releasedQty) * 1000) / 1000);
    const remainingWeight = 0;

    const statusUpper = (mrStatus || '').toUpperCase().trim().replace(/ /g, '_');
    let targetQty = remainingQty;

    let isAvailable = false;
    if (statusUpper === 'FULFILLED' || statusUpper === 'COMPLETED') {
      isAvailable = totalStock > 0;
    } else {
      isAvailable = (totalStock + 0.001) >= targetQty;
    }

    return {
      resolvedItemCode,
      totalStock,
      totalWeight: 0,
      requiredQty,
      requiredWeight: 0,
      releasedQty,
      releasedWeight: 0,
      remainingQty,
      remainingWeight: 0,
      targetQty,
      available: isAvailable,
      stocks: stockRows
    };
  }

  const isWeightUom = (uom) => {
    const u = (uom || '').toLowerCase().trim();
    return u === 'kg' || u === 'kgs' || u === 'kilogram';
  };

  let requiredQty, requiredWeight, releasedQty, releasedWeight;

  if (isWeightUom(item.uom)) {
    requiredQty = Math.round(parseFloat(item.design_qty || 0) * 1000) / 1000;
    requiredWeight = Math.round(parseFloat(item.quantity || 0) * 1000) / 1000;
    releasedQty = Math.round(parseFloat(item.allocated_quantity || 0) * 1000) / 1000;
    releasedWeight = Math.round(parseFloat(item.allocated_weight || 0) * 1000) / 1000;
  } else {
    requiredQty = Math.round(parseFloat(item.quantity || item.design_qty || 0) * 1000) / 1000;
    requiredWeight = Math.round((parseFloat(item.required_weight || 0) || (requiredQty * parseFloat(item.weight_per_unit || 0))) * 1000) / 1000;
    releasedQty = Math.round(parseFloat(item.allocated_quantity || 0) * 1000) / 1000;
    releasedWeight = Math.round(parseFloat(item.allocated_weight || 0) * 1000) / 1000;
  }

  // Weight/Unit = Required Weight ÷ Design Qty
  const weightPerUnit = requiredQty > 0 ? (requiredWeight / requiredQty) : 0;

  // Available Qty = FLOOR(Available Weight ÷ Weight/Unit)
  const computedAvailableQty = weightPerUnit > 0 ? Math.floor(totalWeight / weightPerUnit) : 0;
  const finalTotalStock = computedAvailableQty;

  const remainingQty = Math.max(0, Math.round((requiredQty - releasedQty) * 1000) / 1000);
  const remainingWeight = Math.max(0, Math.round((requiredWeight - releasedWeight) * 1000) / 1000);

  const statusUpper = (mrStatus || '').toUpperCase().trim().replace(/ /g, '_');
  let targetQty = remainingQty;
  let targetWeight = remainingWeight;

  let isAvailable = false;
  if (statusUpper === 'FULFILLED' || statusUpper === 'COMPLETED') {
    isAvailable = finalTotalStock > 0 || totalWeight > 0;
  } else {
    isAvailable = (finalTotalStock + 0.001) >= targetQty && (totalWeight + 0.001) >= targetWeight;
  }

  return {
    resolvedItemCode,
    totalStock: finalTotalStock,
    totalWeight,
    requiredQty,
    requiredWeight,
    releasedQty,
    releasedWeight,
    remainingQty,
    remainingWeight,
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

  const lengthValM = parseFloat(item.length || 0);
  const widthValM = parseFloat(item.width || 0);
  const thicknessValM = parseFloat(item.thickness || 0);
  const diameterValM = parseFloat(item.diameter || 0);
  const outerDiameterValM = parseFloat(item.outer_diameter || item.outerDiameter || 0);
  const hasDimensionsM = (lengthValM > 0 || widthValM > 0 || thicknessValM > 0 || diameterValM > 0 || outerDiameterValM > 0);

  // 1. Check by candidate item_codes in stock_balance WITH dimension filter (non-zero dims only)
  for (const code of candidateCodes) {
    const matched = sbRows.filter(sb => {
      if (sb.item_code !== code || !(parseFloat(sb.current_balance || 0) > 0)) return false;
      // Only check non-zero dimensions (zero means "not applicable for this shape")
      if (lengthValM > 0 && Math.abs(parseFloat(sb.length || 0) - lengthValM) >= 0.0001) return false;
      if (widthValM > 0 && Math.abs(parseFloat(sb.width || 0) - widthValM) >= 0.0001) return false;
      if (thicknessValM > 0 && Math.abs(parseFloat(sb.thickness || 0) - thicknessValM) >= 0.0001) return false;
      if (diameterValM > 0 && Math.abs(parseFloat(sb.diameter || 0) - diameterValM) >= 0.0001) return false;
      if (outerDiameterValM > 0 && Math.abs(parseFloat(sb.outer_diameter || 0) - outerDiameterValM) >= 0.0001) return false;
      return true;
    });
    if (matched.length > 0) {
      stockRows = matched.map(sb => ({ warehouse_name: sb.warehouse, current_stock: sb.current_balance, current_weight: sb.current_weight || 0 }));
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
      stockRows = matched.map(sb => ({ warehouse_name: sb.warehouse, current_stock: sb.current_balance, current_weight: sb.current_weight || 0 }));
    }
  }

  const totalStock = Math.round(stockRows.reduce((sum, row) => sum + parseFloat(row.current_stock || 0), 0) * 1000) / 1000;
  const totalWeight = Math.round(stockRows.reduce((sum, row) => sum + parseFloat(row.current_weight || 0), 0) * 1000) / 1000;

  const matType = (item.material_type || item.item_type || '').toUpperCase().trim();
  const uomClean = (item.uom || item.unit || '').toUpperCase().trim();
  const isKgUom = uomClean === 'KG' || uomClean === 'KGS' || uomClean === 'KILOGRAM';
  const isBoughtOut = matType.includes('BOUGHT') || (item.item_code && String(item.item_code).toUpperCase().startsWith('BO-')) || !isKgUom;

  if (isBoughtOut) {
    const requiredQty = Math.round(parseFloat(item.quantity || item.design_qty || 0) * 1000) / 1000;
    const requiredWeight = 0;
    const releasedQty = Math.round(parseFloat(item.allocated_quantity || 0) * 1000) / 1000;
    const releasedWeight = 0;

    const remainingQty = Math.max(0, Math.round((requiredQty - releasedQty) * 1000) / 1000);
    const remainingWeight = 0;

    const statusUpper = (mrStatus || '').toUpperCase().trim().replace(/ /g, '_');
    let targetQty = remainingQty;

    let isAvailable = false;
    if (statusUpper === 'FULFILLED' || statusUpper === 'COMPLETED') {
      isAvailable = totalStock > 0;
    } else {
      isAvailable = (totalStock + 0.001) >= targetQty;
    }

    return {
      resolvedItemCode,
      totalStock,
      totalWeight: 0,
      requiredQty,
      requiredWeight: 0,
      releasedQty,
      releasedWeight: 0,
      remainingQty,
      remainingWeight: 0,
      targetQty,
      available: isAvailable,
      stocks: stockRows
    };
  }

  const isWeightUom = (uom) => {
    const u = (uom || '').toLowerCase().trim();
    return u === 'kg' || u === 'kgs' || u === 'kilogram';
  };

  let requiredQty, requiredWeight, releasedQty, releasedWeight;

  if (isWeightUom(item.uom)) {
    requiredQty = Math.round(parseFloat(item.design_qty || 0) * 1000) / 1000;
    requiredWeight = Math.round(parseFloat(item.quantity || 0) * 1000) / 1000;
    releasedQty = Math.round(parseFloat(item.allocated_quantity || 0) * 1000) / 1000;
    releasedWeight = Math.round(parseFloat(item.allocated_weight || 0) * 1000) / 1000;
  } else {
    requiredQty = Math.round(parseFloat(item.quantity || item.design_qty || 0) * 1000) / 1000;
    requiredWeight = Math.round((parseFloat(item.required_weight || 0) || (requiredQty * parseFloat(item.weight_per_unit || 0))) * 1000) / 1000;
    releasedQty = Math.round(parseFloat(item.allocated_quantity || 0) * 1000) / 1000;
    releasedWeight = Math.round(parseFloat(item.allocated_weight || 0) * 1000) / 1000;
  }

  // Weight/Unit = Required Weight ÷ Design Qty
  const weightPerUnit = requiredQty > 0 ? (requiredWeight / requiredQty) : 0;

  // Available Qty = FLOOR(Available Weight ÷ Weight/Unit)
  const computedAvailableQty = weightPerUnit > 0 ? Math.floor(totalWeight / weightPerUnit) : 0;
  const finalTotalStock = computedAvailableQty;

  const remainingQty = Math.max(0, Math.round((requiredQty - releasedQty) * 1000) / 1000);
  const remainingWeight = Math.max(0, Math.round((requiredWeight - releasedWeight) * 1000) / 1000);

  const statusUpper = (mrStatus || '').toUpperCase().trim().replace(/ /g, '_');
  let targetQty = remainingQty;
  let targetWeight = remainingWeight;

  let isAvailable = false;
  if (statusUpper === 'FULFILLED' || statusUpper === 'COMPLETED') {
    isAvailable = finalTotalStock > 0 || totalWeight > 0;
  } else {
    isAvailable = (finalTotalStock + 0.001) >= targetQty && (totalWeight + 0.001) >= targetWeight;
  }

  return {
    resolvedItemCode,
    totalStock: finalTotalStock,
    totalWeight,
    requiredQty,
    requiredWeight,
    releasedQty,
    releasedWeight,
    remainingQty,
    remainingWeight,
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
          (
            SELECT cd.drawing_no 
            FROM customer_drawings cd 
            WHERE (pp.bom_no REGEXP '^[0-9]+$' AND cd.id = CAST(pp.bom_no AS UNSIGNED)) OR (cd.drawing_no = pp.bom_no)
            LIMIT 1
          ),
          CASE WHEN pp.bom_no NOT REGEXP '^[0-9]+$' THEN pp.bom_no ELSE NULL END
        ) as drawing_no,
        ppi.description as finished_good,
        COALESCE(
          c_ord.company_name,
          c_so.company_name,
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
          '-'
        ) as company_name,
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
        LEFT JOIN orders o ON pp.sales_order_id = o.id
        LEFT JOIN companies c_ord ON o.client_id = c_ord.id
        LEFT JOIN sales_orders so ON pp.sales_order_id = so.id
        LEFT JOIN companies c_so ON so.company_id = c_so.id
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
          SELECT sb.item_code, sb.material_name, sb.length, sb.width, sb.thickness, sb.diameter, sb.outer_diameter, sb.current_balance, COALESCE(sb.current_weight, 0) as current_weight, sb.warehouse, s.name as shape_name
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
          (
            SELECT cd.drawing_no 
            FROM customer_drawings cd 
            WHERE (pp.bom_no REGEXP '^[0-9]+$' AND cd.id = CAST(pp.bom_no AS UNSIGNED)) OR (cd.drawing_no = pp.bom_no)
            LIMIT 1
          ),
          CASE WHEN pp.bom_no NOT REGEXP '^[0-9]+$' THEN pp.bom_no ELSE NULL END
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
        SELECT mri.id, mri.mr_id, mri.item_code, mri.planned_qty, mri.unit_rate, mri.warehouse, mri.item_source, mri.remarks,
               COALESCE(mri.shape_type, shape_lookup.shape_name) as shape_type,
               COALESCE(mri.item_name, sb.material_name, sb.item_description, mri.item_code) as name, 
               COALESCE(mri.uom, sb.unit) as uom,
               COALESCE(mri.item_type, sb.material_type) as material_type,
               CASE WHEN (COALESCE(mri.length, 0) > 0 OR COALESCE(mri.width, 0) > 0 OR COALESCE(mri.thickness, 0) > 0 OR COALESCE(mri.diameter, 0) > 0 OR COALESCE(mri.outer_diameter, 0) > 0) THEN COALESCE(mri.length, 0) ELSE COALESCE(sb.length, 0) END as length,
               CASE WHEN (COALESCE(mri.length, 0) > 0 OR COALESCE(mri.width, 0) > 0 OR COALESCE(mri.thickness, 0) > 0 OR COALESCE(mri.diameter, 0) > 0 OR COALESCE(mri.outer_diameter, 0) > 0) THEN COALESCE(mri.width, 0) ELSE COALESCE(sb.width, 0) END as width,
               CASE WHEN (COALESCE(mri.length, 0) > 0 OR COALESCE(mri.width, 0) > 0 OR COALESCE(mri.thickness, 0) > 0 OR COALESCE(mri.diameter, 0) > 0 OR COALESCE(mri.outer_diameter, 0) > 0) THEN COALESCE(mri.thickness, 0) ELSE COALESCE(sb.thickness, 0) END as thickness,
               CASE WHEN (COALESCE(mri.length, 0) > 0 OR COALESCE(mri.width, 0) > 0 OR COALESCE(mri.thickness, 0) > 0 OR COALESCE(mri.diameter, 0) > 0 OR COALESCE(mri.outer_diameter, 0) > 0) THEN COALESCE(mri.diameter, 0) ELSE COALESCE(sb.diameter, 0) END as diameter,
               CASE WHEN (COALESCE(mri.length, 0) > 0 OR COALESCE(mri.width, 0) > 0 OR COALESCE(mri.thickness, 0) > 0 OR COALESCE(mri.diameter, 0) > 0 OR COALESCE(mri.outer_diameter, 0) > 0) THEN COALESCE(mri.outer_diameter, 0) ELSE COALESCE(sb.outer_diameter, 0) END as outer_diameter,
               CASE WHEN (COALESCE(mri.length, 0) > 0 OR COALESCE(mri.width, 0) > 0 OR COALESCE(mri.thickness, 0) > 0 OR COALESCE(mri.diameter, 0) > 0 OR COALESCE(mri.outer_diameter, 0) > 0) THEN COALESCE(mri.density, 0) ELSE COALESCE(sb.density, 0) END as density,
               CASE WHEN (COALESCE(mri.length, 0) > 0 OR COALESCE(mri.width, 0) > 0 OR COALESCE(mri.thickness, 0) > 0 OR COALESCE(mri.diameter, 0) > 0 OR COALESCE(mri.outer_diameter, 0) > 0) THEN COALESCE(mri.weight_per_unit, 0) ELSE COALESCE(sb.weight_per_unit, 0) END as weight_per_unit,
               mri.quantity,
               mri.allocated_quantity,
               CASE 
                 WHEN LOWER(TRIM(COALESCE(mri.item_type, sb.material_type, ''))) IN ('bought_out', 'bought out', 'bought-out')
                      OR UPPER(COALESCE(mri.item_code, '')) LIKE 'BO-%'
                      OR LOWER(TRIM(COALESCE(mri.uom, sb.unit, ''))) NOT IN ('kg', 'kgs', 'kilogram')
                 THEN 0
                 WHEN LOWER(TRIM(COALESCE(mri.uom, sb.unit, ''))) IN ('kg', 'kgs', 'kilogram') THEN mri.quantity
                 ELSE COALESCE(NULLIF(mri.required_weight, 0), mri.quantity * COALESCE(NULLIF(mri.weight_per_unit, 0), sb.weight_per_unit, 0), 0)
               END as required_weight,
               COALESCE(mri.allocated_weight, 0) as allocated_weight,
               COALESCE(mri.design_qty, 1) as design_qty,
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
        item.total_weight = availInfo.totalWeight;
        item.design_qty = availInfo.requiredQty;
        item.required_weight = availInfo.requiredWeight;
        item.allocated_quantity = availInfo.releasedQty;
        item.allocated_weight = availInfo.releasedWeight;
        item.remaining_qty = availInfo.remainingQty;
        item.remaining_weight = availInfo.remainingWeight;

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
            const isWeightUom = (uom) => {
              const u = (uom || '').toLowerCase().trim();
              return u === 'kg' || u === 'kgs' || u === 'kilogram';
            };

            let requiredQty, requiredWeight;
            if (isWeightUom(item.uom)) {
              requiredQty = parseFloat(item.design_qty || 0);
              requiredWeight = parseFloat(item.quantity || 0);
            } else {
              requiredQty = parseFloat(item.quantity || item.design_qty || 0);
              requiredWeight = parseFloat(item.required_weight || 0) || (requiredQty * parseFloat(item.weight_per_unit || 0));
            }

            const releasedQty = parseFloat(item.allocated_quantity || 0);
            const remainingQty = Math.max(0, requiredQty - releasedQty);

            const releasedWeight = parseFloat(item.allocated_weight || 0);
            const remainingWeight = Math.max(0, requiredWeight - releasedWeight);

            if (remainingQty > 0) {
              // Build dimension filter for stock query
              const _lenV = parseFloat(item.length || 0);
              const _widV = parseFloat(item.width || 0);
              const _thkV = parseFloat(item.thickness || 0);
              const _diaV = parseFloat(item.diameter || 0);
              const _odV  = parseFloat(item.outer_diameter || 0);
              const _hasDim = _lenV > 0 || _widV > 0 || _thkV > 0 || _diaV > 0 || _odV > 0;

              const _buildStockQuery = (code) => {
                let q = `SELECT id, item_code, warehouse, current_balance, COALESCE(current_weight, 0) as current_weight, length, width, thickness, diameter, outer_diameter, shape_type, weight_per_unit FROM stock_balance WHERE item_code = ? AND current_balance > 0`;
                const p = [code];
                // Only filter on non-zero dimensions (zero means "not applicable for this shape")
                if (_lenV > 0) { q += ' AND (ABS(COALESCE(length, 0) - ?) < 0.0001)'; p.push(_lenV); }
                if (_widV > 0) { q += ' AND (ABS(COALESCE(width, 0) - ?) < 0.0001)'; p.push(_widV); }
                if (_thkV > 0) { q += ' AND (ABS(COALESCE(thickness, 0) - ?) < 0.0001)'; p.push(_thkV); }
                if (_diaV > 0) { q += ' AND (ABS(COALESCE(diameter, 0) - ?) < 0.0001)'; p.push(_diaV); }
                if (_odV  > 0) { q += ' AND (ABS(COALESCE(outer_diameter, 0) - ?) < 0.0001)'; p.push(_odV); }
                q += ' ORDER BY current_balance DESC';
                return { q, p };
              };

              // Find warehouses with positive stock balance for this item+dimension
              let { q: _sq, p: _sp } = _buildStockQuery(resolvedItemCode);
              let [stockRows] = await connection.query(_sq, _sp);

              if (stockRows.length === 0 && item.item_code && item.item_code !== resolvedItemCode) {
                let { q: _sq2, p: _sp2 } = _buildStockQuery(item.item_code);
                [stockRows] = await connection.query(_sq2, _sp2);
              }

              let amountToDeduct = remainingQty;
              const itemMatType = (item.material_type || item.item_type || '').toUpperCase().trim();
              const itemUomClean = (item.uom || item.unit || '').toUpperCase().trim();
              const isItemKg = itemUomClean === 'KG' || itemUomClean === 'KGS' || itemUomClean === 'KILOGRAM';
              const isItemBoughtOut = itemMatType.includes('BOUGHT') || (item.item_code && String(item.item_code).toUpperCase().startsWith('BO-')) || !isItemKg;
              const weightPerUnit = (!isItemBoughtOut && requiredQty > 0) ? (requiredWeight / requiredQty) : 0;

              if (stockRows.length > 0) {
                for (const stockRow of stockRows) {
                  if (amountToDeduct <= 0) break;
                  let availableInWh, issueQty, issueWeight, issueQtyForStock;

                  if (isItemBoughtOut) {
                    availableInWh = parseFloat(stockRow.current_balance || 0);
                    if (availableInWh <= 0) continue;
                    issueQty = Math.min(amountToDeduct, availableInWh);
                    issueWeight = 0;
                    issueQtyForStock = issueQty;
                  } else {
                    const availableWeightInWh = parseFloat(stockRow.current_weight || 0);
                    availableInWh = weightPerUnit > 0 ? Math.floor(availableWeightInWh / weightPerUnit) : 0;
                    if (availableInWh <= 0) continue;

                    issueQty = Math.min(amountToDeduct, availableInWh);
                    issueWeight = issueQty * weightPerUnit;

                    const actualBalance = parseFloat(stockRow.current_balance || 0);
                    const actualWeight = parseFloat(stockRow.current_weight || 0);
                    const weightPerPieceInStock = actualBalance > 0 ? (actualWeight / actualBalance) : weightPerUnit;
                    issueQtyForStock = weightPerPieceInStock > 0 ? (issueWeight / weightPerPieceInStock) : issueQty;
                  }

                  if (issueQty <= 0 || issueQtyForStock <= 0) continue;

                  await stockService.addStockLedgerEntry(
                    stockRow.item_code || resolvedItemCode,
                    'OUT',
                    issueQtyForStock,
                    'Material Request',
                    mr.id,
                    mr.mr_number,
                    {
                      remarks: `Material released for MR: ${mr.mr_number}`,
                      userId: req.user?.id || 1,
                      warehouse: stockRow.warehouse,
                      stockBalanceId: stockRow.id,
                      weight: issueWeight,
                      materialName: item.item_name,
                      materialType: item.item_type,
                      unit: item.uom,
                      length: stockRow.length || item.length,
                      width: stockRow.width || item.width,
                      thickness: stockRow.thickness || item.thickness,
                      diameter: stockRow.diameter || item.diameter,
                      outer_diameter: stockRow.outer_diameter || item.outer_diameter,
                      density: item.density,
                      weight_per_unit: stockRow.weight_per_unit || item.weight_per_unit,
                      shape_type: stockRow.shape_type || item.shape_type
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
                    weight: remainingWeight,
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

            // Always update allocated_quantity and allocated_weight on completion
            await connection.execute(
              `UPDATE material_request_items SET allocated_quantity = ?, allocated_weight = ? WHERE id = ?`,
              [requiredQty, requiredWeight, item.id]
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

          // Build dimension filter for stock query
          const _lenV2 = parseFloat(item.length || 0);
          const _widV2 = parseFloat(item.width || 0);
          const _thkV2 = parseFloat(item.thickness || 0);
          const _diaV2 = parseFloat(item.diameter || 0);
          const _odV2  = parseFloat(item.outer_diameter || 0);
          const _hasDim2 = _lenV2 > 0 || _widV2 > 0 || _thkV2 > 0 || _diaV2 > 0 || _odV2 > 0;

          let _stockQ2 = `SELECT id, item_code, warehouse, current_balance, COALESCE(current_weight, 0) as current_weight, length, width, thickness, diameter, outer_diameter, shape_type, weight_per_unit FROM stock_balance WHERE item_code = ? AND current_balance > 0`;
          const _stockP2 = [resolvedItemCode || item.item_code];
          // Only filter on non-zero dimensions (zero means "not applicable for this shape")
          if (_lenV2 > 0) { _stockQ2 += ' AND (ABS(COALESCE(length, 0) - ?) < 0.0001)'; _stockP2.push(_lenV2); }
          if (_widV2 > 0) { _stockQ2 += ' AND (ABS(COALESCE(width, 0) - ?) < 0.0001)'; _stockP2.push(_widV2); }
          if (_thkV2 > 0) { _stockQ2 += ' AND (ABS(COALESCE(thickness, 0) - ?) < 0.0001)'; _stockP2.push(_thkV2); }
          if (_diaV2 > 0) { _stockQ2 += ' AND (ABS(COALESCE(diameter, 0) - ?) < 0.0001)'; _stockP2.push(_diaV2); }
          if (_odV2  > 0) { _stockQ2 += ' AND (ABS(COALESCE(outer_diameter, 0) - ?) < 0.0001)'; _stockP2.push(_odV2); }
          _stockQ2 += ' ORDER BY current_balance DESC';

          // Get total stock available across all warehouses for this item+dimension
          const [stockRows] = await connection.query(_stockQ2, _stockP2);

          const totalStock = stockRows.reduce((sum, row) => sum + parseFloat(row.current_balance), 0);
          const isWeightUom = (uom) => {
            const u = (uom || '').toLowerCase().trim();
            return u === 'kg' || u === 'kgs' || u === 'kilogram';
          };

          let requiredQty, requiredWeight;
          if (isWeightUom(item.uom)) {
            requiredQty = parseFloat(item.design_qty || 0);
            requiredWeight = parseFloat(item.quantity || 0);
          } else {
            requiredQty = parseFloat(item.quantity || item.design_qty || 0);
            requiredWeight = parseFloat(item.required_weight || 0) || (requiredQty * parseFloat(item.weight_per_unit || 0));
          }

          const allocatedQty = parseFloat(item.allocated_quantity || 0);
          const remainingQty = Math.max(0, requiredQty - allocatedQty);

          const allocatedWeight = parseFloat(item.allocated_weight || 0);
          const remainingWeight = Math.max(0, requiredWeight - allocatedWeight);

          if (remainingQty <= 0 || totalStock <= 0) {
            // Skip this material if no remaining quantity is needed or no stock is available
            continue;
          }

          let amountToDeduct = remainingQty;
          const itemMatType = (item.material_type || item.item_type || '').toUpperCase().trim();
          const isItemBoughtOut = itemMatType === 'BOUGHT_OUT' || itemMatType === 'BOUGHT OUT' || itemMatType === 'BOUGHT-OUT' || (item.item_code && String(item.item_code).toUpperCase().startsWith('BO-'));
          const weightPerUnit = (!isItemBoughtOut && requiredQty > 0) ? (requiredWeight / requiredQty) : 0;

          for (const stockRow of stockRows) {
            if (amountToDeduct <= 0) break;
            let availableInWarehouse, issueQty, issueWeight, issueQtyForStock;

            if (isItemBoughtOut) {
              availableInWarehouse = parseFloat(stockRow.current_balance || 0);
              if (availableInWarehouse <= 0) continue;
              issueQty = Math.min(amountToDeduct, availableInWarehouse);
              issueWeight = 0;
              issueQtyForStock = issueQty;
            } else {
              const availableWeightInWarehouse = parseFloat(stockRow.current_weight || 0);
              availableInWarehouse = weightPerUnit > 0 ? Math.floor(availableWeightInWarehouse / weightPerUnit) : 0;
              if (availableInWarehouse <= 0) continue;

              issueQty = Math.min(amountToDeduct, availableInWarehouse);
              issueWeight = issueQty * weightPerUnit;

              const actualBalance = parseFloat(stockRow.current_balance || 0);
              const actualWeight = parseFloat(stockRow.current_weight || 0);
              const weightPerPieceInStock = actualBalance > 0 ? (actualWeight / actualBalance) : weightPerUnit;
              issueQtyForStock = weightPerPieceInStock > 0 ? (issueWeight / weightPerPieceInStock) : issueQty;
            }

            if (issueQty <= 0 || issueQtyForStock <= 0) continue;

            // If we have a work_order and issueId, insert into material_issue_items
            if (issueId) {
              await connection.execute(
                `INSERT INTO material_issue_items (issue_id, material_name, material_type, item_code, quantity, uom, warehouse)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [issueId, item.item_name, item.item_type, stockRow.item_code || resolvedItemCode || item.item_code, issueQty, item.uom, stockRow.warehouse]
              );
            }

            // Deduct from stock ledger
            await stockService.addStockLedgerEntry(
              stockRow.item_code || resolvedItemCode || item.item_code,
              'OUT',
              issueQtyForStock,
              issueId ? 'MATERIAL_ISSUE' : 'Material Request',
              issueId || mr.id,
              issueId ? issueNumber : mr.mr_number,
              {
                remarks: `Partial release for MR: ${mr.mr_number}`,
                userId: req.user?.id || 1,
                warehouse: stockRow.warehouse,
                stockBalanceId: stockRow.id,
                weight: issueWeight,
                materialName: item.item_name,
                materialType: item.item_type,
                unit: item.uom,
                length: stockRow.length || item.length,
                width: stockRow.width || item.width,
                thickness: stockRow.thickness || item.thickness,
                diameter: stockRow.diameter || item.diameter,
                outer_diameter: stockRow.outer_diameter || item.outer_diameter,
                density: item.density,
                weight_per_unit: stockRow.weight_per_unit || item.weight_per_unit,
                shape_type: stockRow.shape_type || item.shape_type
              },
              connection
            );

            // Update allocated_quantity and allocated_weight in material_request_items
            await connection.execute(
              `UPDATE material_request_items SET 
                allocated_quantity = COALESCE(allocated_quantity, 0) + ?,
                allocated_weight = COALESCE(allocated_weight, 0) + ?
               WHERE id = ?`,
              [issueQty, issueWeight, item.id]
            );

            amountToDeduct -= issueQty;
          }
        }

        // Check if all items are now fully released
        const [updatedItems] = await connection.query(`
          SELECT mri.id, mri.uom, mri.quantity, mri.allocated_quantity, mri.allocated_weight,
                 COALESCE(mri.design_qty, 1) as design_qty,
                 COALESCE(mri.weight_per_unit, sb.weight_per_unit, 0) as weight_per_unit,
                 mri.required_weight
          FROM material_request_items mri
          LEFT JOIN (
            SELECT item_code, MAX(weight_per_unit) as weight_per_unit FROM stock_balance GROUP BY item_code
          ) sb ON mri.item_code = sb.item_code
          WHERE mri.mr_id = ?
        `, [id]);
        const allFullyReleased = updatedItems.every(item => {
          const _isWeightUomFR = (uom) => {
            const u = (uom || '').toLowerCase().trim();
            return u === 'kg' || u === 'kgs' || u === 'kilogram';
          };
          const _isNosUomFR = (uom) => {
            const u = (uom || '').toLowerCase().trim();
            return u === 'nos' || u === 'no' || u === 'pcs' || u === 'pieces' || u === 'piece' || u === 'unit' || u === 'units' || u === 'set' || u === 'sets';
          };
          const _uomFR = (item.uom || '').toLowerCase().trim();
          let req, reqW;
          if (_isWeightUomFR(_uomFR)) {
            req = parseFloat(item.design_qty || 0);
            reqW = parseFloat(item.quantity || 0);
          } else {
            req = parseFloat(item.quantity || item.design_qty || 0);
            reqW = parseFloat(item.required_weight || 0) || (req * parseFloat(item.weight_per_unit || 0));
          }
          const alloc = parseFloat(item.allocated_quantity || 0);
          const allocW = parseFloat(item.allocated_weight || 0);
          // For NOS/unit-based UOMs, only check qty — weight is optional and must not block release
          if (_isNosUomFR(_uomFR) || (!_isWeightUomFR(_uomFR) && reqW === 0)) {
            return alloc >= (req - 0.001);
          }
          return alloc >= (req - 0.001) && allocW >= (reqW - 0.001);
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
