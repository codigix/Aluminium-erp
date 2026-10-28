/**
 * Standardized function to clean project names
 * Removes "Design Review - Drawing" prefix and "for [Client]" suffix
 * @param {string} name - The raw project name
 * @param {string} clientName - Optional client name fallback
 * @returns {string} - The cleaned project name
 */
export const cleanProjectName = (name, clientName = '') => {
  if (!name) return clientName || 'Internal';

  // Replace "Design Review - Drawing" with "Project"
  let cleaned = name.replace(/Design Review - Drawing\s+/i, 'Project ');

  // Remove "for [Client]" part
  cleaned = cleaned.split(/\s+for\s+/i)[0];

  return cleaned;
};

/**
 * Standardized function to format dimensions of different material shapes
 * Uses engineering standard prefix format: e.g. "RB Ø20 × 1000 mm", "PL 300 × 200 × 10 mm"
 * @param {object} item - The item containing dimension fields
 * @returns {string} - Formatted dimension string with shape prefix
 */
export const formatDimensions = (item) => {
  if (!item) return '';

  const len = parseFloat(item.length || item.dimensions?.length || 0);
  const wid = parseFloat(item.width || item.dimensions?.width || 0);
  const thk = parseFloat(item.thickness || item.dimensions?.thickness || 0);
  const dia = parseFloat(item.diameter || item.dimensions?.diameter || 0);
  const od = parseFloat(item.outer_diameter || item.outerDiameter || item.dimensions?.outer_diameter || item.dimensions?.outerDiameter || 0);

  if (len === 0 && wid === 0 && thk === 0 && dia === 0 && od === 0) {
    return '';
  }

  const explicitShape = (item.shape_type || item.shape_name || item.shape || '').toLowerCase().trim();
  const matNameStr = (item.material_name || item.name || item.item_name || '').toLowerCase().trim();
  const hasPlateDims = wid > 0 || thk > 0;
  const isPlateMaterial = !explicitShape && (matNameStr.includes('plate') || matNameStr.includes('sheet')) && hasPlateDims;

  // Determine shape
  let shape = (
    explicitShape ? explicitShape :
      (isPlateMaterial ? matNameStr : (matNameStr || item.item_code || ''))
  ).toLowerCase();

  let matchedShape = '';
  if (shape.includes('threaded') || shape.includes('thread')) {
    matchedShape = 'threaded rod';
  } else if (shape.includes('square tube') || (shape.includes('square') && shape.includes('tube'))) {
    matchedShape = 'square tube';
  } else if (shape.includes('square bar') || (shape.includes('square') && !shape.includes('tube'))) {
    matchedShape = 'square bar';
  } else if (shape.includes('rectangular tube') || shape.includes('rect tube') || (shape.includes('rect') && shape.includes('tube'))) {
    matchedShape = 'rectangular tube';
  } else if (shape.includes('rectangular bar') || (shape.includes('rect') && shape.includes('bar'))) {
    matchedShape = 'rectangular bar';
  } else if (shape.includes('hex') || shape.includes('hexagonal')) {
    matchedShape = 'hexagonal bar';
  } else if (shape.includes('unequal angle') || shape.includes('ua ')) {
    matchedShape = 'unequal angle';
  } else if (shape.includes('equal angle') || shape.includes('ea ')) {
    matchedShape = 'equal angle';
  } else if (shape.includes('angle')) {
    matchedShape = 'angle';
  } else if (shape.includes('flat') || shape === 'fl' || shape.startsWith('fl ')) {
    matchedShape = 'flat bar';
  } else if (shape.includes('plate') || shape.includes('sheet')) {
    matchedShape = 'plate';
  } else if (shape.includes('pipe') || shape.includes('tube')) {
    matchedShape = 'pipe';
  } else if (shape.includes('round') || shape.includes('rod') || shape.includes('bar')) {
    if (thk > 0) {
      matchedShape = 'threaded rod';
    } else {
      matchedShape = 'round bar';
    }
  } else {
    // Fallback detection by dimension values (no explicit shape or recognizable material name).
    // A threaded rod is never inferred here: it needs an explicit shape.
    if (wid > 0 && thk > 0 && len > 0 && dia === 0 && od === 0) {
      matchedShape = 'plate';
    } else if (dia > 0) {
      matchedShape = 'round bar';
    } else if (od > 0 && thk > 0) {
      matchedShape = 'pipe';
    } else if (wid > 0 && od > 0 && thk > 0 && len > 0) {
      matchedShape = 'rectangular tube';
    } else if (wid > 0 && thk > 0 && len > 0) {
      matchedShape = 'plate';
    } else if (wid > 0 && len > 0) {
      matchedShape = 'hexagonal bar';
    } else {
      matchedShape = 'plate';
    }
  }

  // Format a numeric value (omit decimal if whole number, omit if 0)
  const n = (val) => {
    if (val === undefined || val === null || val === '' || isNaN(parseFloat(val)) || parseFloat(val) === 0) return null;
    const num = parseFloat(val);
    return num % 1 === 0 ? num.toFixed(0) : num.toFixed(1);
  };

  let prefix = '';
  let dimStr = '';

  if (matchedShape === 'plate') {
    prefix = 'PL';
    const parts = [n(wid), n(len), n(thk)].filter(Boolean);
    dimStr = parts.join(' × ');
  } else if (matchedShape === 'flat bar') {
    prefix = 'FL';
    const hOrT = thk > 0 ? thk : (od > 0 ? od : 0);
    const parts = [n(wid), n(hOrT), n(len)].filter(Boolean);
    dimStr = parts.join(' × ');
  } else if (matchedShape === 'round bar') {
    prefix = 'RB';
    const dVal = dia > 0 ? dia : (od > 0 ? od : wid);
    const parts = [`Ø${n(dVal)}`, n(len)].filter(Boolean);
    dimStr = parts.join(' × ');
  } else if (matchedShape === 'hexagonal bar') {
    prefix = 'HEX';
    const parts = [`AF${n(wid)}`, n(len)].filter(Boolean);
    dimStr = parts.join(' × ');
  } else if (matchedShape === 'square bar') {
    prefix = 'SB';
    const parts = [n(wid), n(len)].filter(Boolean);
    dimStr = parts.join(' × ');
  } else if (matchedShape === 'rectangular bar') {
    prefix = 'REC';
    const parts = [n(wid), n(od), n(len)].filter(Boolean);
    dimStr = parts.join(' × ');
  } else if (matchedShape === 'pipe') {
    prefix = 'PIPE';
    const odVal = od > 0 ? od : dia;
    const parts = [`OD${n(odVal)}`, n(thk), n(len)].filter(Boolean);
    dimStr = parts.join(' × ');
  } else if (matchedShape === 'square tube') {
    prefix = 'SQT';
    const parts = [n(wid), n(thk), n(len)].filter(Boolean);
    dimStr = parts.join(' × ');
  } else if (matchedShape === 'rectangular tube') {
    prefix = 'RCT';
    const parts = [n(wid), n(od), n(thk), n(len)].filter(Boolean);
    dimStr = parts.join(' × ');
  } else if (matchedShape === 'threaded rod') {
    prefix = 'TR';
    const dVal = dia > 0 ? dia : od;
    const pVal = parseFloat(item.thread_pitch || item.threadPitch || item.dimensions?.thread_pitch || item.dimensions?.threadPitch || thk || item.thickness || item.dimensions?.thickness || 0);
    const parts = [`M${n(dVal)}`, pVal > 0 ? n(pVal) : null, n(len)].filter(Boolean);
    dimStr = parts.join(' × ');
  } else if (matchedShape === 'angle') {
    prefix = 'L';
    const parts = [n(wid), n(od || thk), n(thk), n(len)].filter(Boolean);
    dimStr = parts.join(' × ');
  } else if (matchedShape === 'equal angle') {
    prefix = 'EA';
    const parts = [n(wid), n(wid), n(thk), n(len)].filter(Boolean);
    dimStr = parts.join(' × ');
  } else if (matchedShape === 'unequal angle') {
    prefix = 'UA';
    const parts = [n(wid), n(od), n(thk), n(len)].filter(Boolean);
    dimStr = parts.join(' × ');
  } else {
    const parts = [n(wid), n(od), n(thk), n(dia), n(len)].filter(Boolean);
    dimStr = parts.join(' × ');
  }

  if (!dimStr) return '';
  return `${prefix} ${dimStr} mm`.trim();
};

/**
 * Validates shape-specific dimensions to ensure geometric validity.
 * 
 * @param {Object} params
 * @returns {{ isValid: boolean, error?: string }}
 */
export const validateShapeDimensions = ({
  shape = '',
  width = 0,
  thickness = 0,
  diameter = 0,
  outerDiameter = 0,
  outer_diameter = 0,
  threadPitch = 0,
  thread_pitch = 0
}) => {
  const shapeStr = String(shape || '').trim().toLowerCase();
  const w = parseFloat(width) || 0;
  const t = parseFloat(thickness) || 0;
  const dia = parseFloat(diameter) || 0;
  const od = parseFloat(outerDiameter || outer_diameter) || 0;
  const p = parseFloat(threadPitch || thread_pitch) || 0;

  if (shapeStr.includes('threaded') || shapeStr.includes('thread')) {
    const dVal = dia > 0 ? dia : od;
    if (dVal > 0 && p > 0 && p >= dVal) {
      return { isValid: false, error: 'Thread Pitch must be less than the Outer Diameter.' };
    }
  } else if (shapeStr === 'pipe' || shapeStr.includes('pipe')) {
    if (od > 0 && t > 0 && t >= od / 2) {
      return { isValid: false, error: 'Wall Thickness must be less than half of the Outer Diameter.' };
    }
  } else if (shapeStr.includes('square tube')) {
    if (w > 0 && t > 0 && t >= w / 2) {
      return { isValid: false, error: 'Wall Thickness must be less than half of the Width.' };
    }
  } else if (shapeStr.includes('rectangular tube') || shapeStr.includes('rect tube')) {
    if (w > 0 && od > 0 && t > 0 && (t >= w / 2 || t >= od / 2)) {
      return { isValid: false, error: 'Wall Thickness must be less than half of both the Width and Height.' };
    }
  }

  return { isValid: true };
};

/**
 * Standardized calculation utility for material weight per unit (Kg)
 * Shared across ItemsMaster, BOMFormPage, ProductionPlan, StockEntries, etc.
 * 
 * @param {Object} params
 * @param {string|number} params.shape - Shape name or shape ID lookup
 * @param {number|string} params.density - Density in g/cm³
 * @param {number|string} [params.length] - Length in mm
 * @param {number|string} [params.width] - Width / Across Flats / Outside Side (A) in mm
 * @param {number|string} [params.thickness] - Thickness in mm
 * @param {number|string} [params.diameter] - Diameter in mm
 * @param {number|string} [params.outerDiameter] - Outer Diameter / Height (H) in mm
 * @param {number|string} [params.outer_diameter] - Alternative property for outer diameter
 * @param {number|string} [params.threadPitch] - Thread Pitch (P) in mm for Threaded Rod
 * @param {number|string} [params.thread_pitch] - Alternative property for Thread Pitch
 * @returns {number} - Calculated weight in Kg (0 if invalid inputs)
 */
export const calculateWeight = ({
  shape = '',
  density = 0,
  length = 0,
  width = 0,
  thickness = 0,
  diameter = 0,
  outerDiameter = 0,
  outer_diameter = 0,
  threadPitch = 0,
  thread_pitch = 0
}) => {
  let dDensity = parseFloat(density) || 0;
  if (dDensity <= 0) {
    dDensity = 2.70; // Standard default density for Aluminium (g/cm³)
  }

  // Run geometric validation check
  const validation = validateShapeDimensions({
    shape,
    width,
    thickness,
    diameter,
    outerDiameter,
    outer_diameter,
    threadPitch,
    thread_pitch
  });

  if (!validation.isValid) return 0;

  const shapeStr = String(shape || '').trim().toLowerCase();
  const l = parseFloat(length) || 0;
  const w = parseFloat(width) || 0;
  const t = parseFloat(thickness) || 0;
  const dia = parseFloat(diameter) || 0;
  const od = parseFloat(outerDiameter || outer_diameter) || 0;
  const p = parseFloat(threadPitch || thread_pitch) || 0;

  let calculatedWeight = 0;

  if (shapeStr === 'flat' || shapeStr.includes('flat')) {
    calculatedWeight = (w * t * l * dDensity) / 1000000;
  } else if (shapeStr === 'square bar' || shapeStr.includes('square bar') || (shapeStr.includes('square') && shapeStr.includes('bar'))) {
    calculatedWeight = (w * w * l * dDensity) / 1000000;
  } else if (shapeStr.includes('threaded rod') || shapeStr.includes('thread rod') || shapeStr.includes('threaded')) {
    const dVal = dia > 0 ? dia : od;
    if (dVal > 0 && p > 0 && p < dVal && l > 0) {
      const tensileArea = 0.7854 * Math.pow(dVal - (0.9382 * p), 2);
      calculatedWeight = (tensileArea * l * dDensity) / 1000000;
    }
  } else if (shapeStr === 'plate' || shapeStr.includes('plate') || shapeStr.includes('sheet') || shapeStr.includes('flat')) {
    calculatedWeight = (l * w * t * dDensity) / 1000000;
  } else if (shapeStr === 'round' || shapeStr.includes('round') || (shapeStr.includes('bar') && !shapeStr.includes('hex'))) {
    calculatedWeight = (Math.PI * Math.pow(dia, 2) / 4 * l * dDensity) / 1000000;
  } else if (shapeStr === 'pipe' || shapeStr.includes('pipe') || (shapeStr.includes('tube') && !shapeStr.includes('square') && !shapeStr.includes('rect'))) {
    const id = od - (2 * t);
    if (id > 0) {
      calculatedWeight = (Math.PI * (Math.pow(od, 2) - Math.pow(id, 2)) / 4 * l * dDensity) / 1000000;
    }
  } else if (shapeStr.includes('square tube') || (shapeStr.includes('square') && shapeStr.includes('tube'))) {
    if (w - 2 * t > 0) {
      calculatedWeight = ((w * w - Math.pow(w - 2 * t, 2)) * l * dDensity) / 1000000;
    }
  } else if (shapeStr.includes('rectangular tube') || shapeStr.includes('rect tube')) {
    if (w - 2 * t > 0 && od - 2 * t > 0) {
      calculatedWeight = ((w * od - (w - 2 * t) * (od - 2 * t)) * l * dDensity) / 1000000;
    }
  } else if (shapeStr === 'hexagonal bar' || shapeStr.includes('hex')) {
    calculatedWeight = ((Math.sqrt(3) / 2) * w * w * l * dDensity) / 1000000;
  }

  return calculatedWeight > 0 ? parseFloat(calculatedWeight.toFixed(3)) : 0;
};

/**
 * Determine whether a purchase order item is billed by weight (₹/KG) or by quantity (₹/NOS).
 * Rule: Shape-based raw materials with calculated physical weight are billed by weight (KG).
 * Bought-out components (BO-, fasteners, hardware, non-weight) are billed by quantity (NOS).
 */
/**
 * Laser-cutting lines are billed on design qty (Nos) × rate, same rule as the backend PO/quotation totals.
 */
export const isLaserCuttingItem = (item) => {
  if (!item) return false;
  const lc = String(item.laser_cutting || '').trim().toUpperCase();
  return !!lc && !['SELECT', 'NONE', 'NULL', 'UNDEFINED'].includes(lc);
};

export const isWeightBasedItem = (item) => {
  if (!item) return false;

  // 0. Laser-cutting operation lines are billed per piece, never by weight
  if (isLaserCuttingItem(item)) return false;

  // 1. Bought-out components / standard hardware are NEVER weight-billed
  const matType = (item.material_type || item.item_type || '').toUpperCase().trim();
  const itemCode = String(item.item_code || '').toUpperCase().trim();
  if (matType.includes('BOUGHT') || itemCode.startsWith('BO-')) {
    return false;
  }

  const nameAndDesc = `${item.material_name || ''} ${item.description || ''} ${item.item_name || ''} ${item.item_code || ''}`.toUpperCase();
  const BOUGHT_OUT_PATTERNS = [
    /\bWASHER\b/, /\bBOLT\b/, /\bSCREW\b/, /\bNUT\b/, /\bBEARING\b/,
    /\bFASTENER\b/, /\bOIL\b/, /\bLUBRICANT\b/, /\bGASKET\b/, /\bRIVET\b/, /\bSEAL\b/
  ];
  if (BOUGHT_OUT_PATTERNS.some(p => p.test(nameAndDesc)) && !item.shape_type && !item.shape_name) {
    return false;
  }

  // 2. Explicit shape type (PLATE, ROUND, PIPE, TUBE, ROD, SHEET, FLAT, ANGLE, CHANNEL, BAR, HEX, etc.)
  const shapeStr = String(item.shape_type || item.shape_name || '').toUpperCase().trim();
  const SHAPE_KEYWORDS = [
    'PLATE', 'ROUND', 'ROUND BAR', 'PIPE', 'TUBE', 'ROD', 'SHEET', 'FLAT', 'ANGLE', 'CHANNEL', 'BAR', 'HEX'
  ];
  const hasExplicitShape = !!(shapeStr || item.shape_id);
  const hasShapeInText = SHAPE_KEYWORDS.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(nameAndDesc) || nameAndDesc.includes(kw));

  // 3. Physical weight values
  const wPerUnit = parseFloat(item.weight_per_unit || 0);
  const totWeight = parseFloat(item.total_weight || 0);
  const reqWeight = parseFloat(item.required_weight || 0);
  const qty = parseFloat(item.quantity || 0);
  const unitStr = String(item.unit || item.uom || '').trim().toUpperCase();

  const hasPhysicalWeight = totWeight > 0 || reqWeight > 0 || wPerUnit > 0;

  // 4. Shape-based items with weight or in weight-bearing PO context
  if ((hasExplicitShape || hasShapeInText) && (hasPhysicalWeight || unitStr === 'KG' || qty > 0)) {
    return true;
  }

  // 5. If item unit is explicitly KG
  if (unitStr === 'KG') return true;

  // 6. If item group / material type is raw material with weight
  const isRaw = (item.item_group || '').toLowerCase().includes('raw') || matType.includes('RAW');
  if (isRaw && (hasPhysicalWeight || qty > 0)) {
    return true;
  }

  return false;
};

/**
 * Get the effective quantity used for billing/amount calculation:
 * - Weight-based items: returns total weight in KG
 * - Quantity-based items: returns piece quantity (design_qty or quantity)
 */
export const getItemEffectiveBillingQty = (item, isDirectCompany = false) => {
  if (!item) return 0;

  if (isWeightBasedItem(item)) {
    // 1. Explicit total_weight
    const totWeight = parseFloat(item.total_weight || 0);
    if (totWeight > 0) return totWeight;

    // 2. Explicit required_weight
    const reqWeight = parseFloat(item.required_weight || 0);
    if (reqWeight > 0) return reqWeight;

    const wPerUnit = parseFloat(item.weight_per_unit || 0);
    const dQty = parseFloat(item.design_qty !== undefined && item.design_qty !== null ? item.design_qty : (item.planned_qty || 0));
    const qty = parseFloat(item.quantity || 0);

    // 3. If quantity is different from piece designQty (e.g. 63.303 KG vs 3 NOS, 7.815 KG vs 3 NOS),
    // quantity represents the total physical weight in KG
    if (qty > 0 && dQty > 0 && Math.abs(qty - dQty) > 0.001) {
      return qty;
    }

    // 4. If piece count × weight_per_unit gives physical weight (e.g. 1 NOS × 12.726 KG = 12.726 KG)
    if (wPerUnit > 0 && dQty > 0) {
      return Number((dQty * wPerUnit).toFixed(3));
    }

    // Fallback to item.quantity
    if (qty > 0) return qty;
  }

  // Non-weight-based (Bought out, piece-based)
  const dQty = parseFloat(item.design_qty !== undefined && item.design_qty !== null ? item.design_qty : (item.planned_qty || item.quantity || 0));
  return dQty > 0 ? dQty : (parseFloat(item.quantity) || 0);
};

/**
 * Standard calculation for item amount across the entire ERP:
 * - Weight-based: Total Weight (KG) × Rate (₹/KG)
 * - Quantity-based: Qty (NOS) × Rate (₹/NOS)
 */
export const calculateItemAmount = (item, isDirectCompany = false) => {
  if (!item) return 0;
  const billingQty = getItemEffectiveBillingQty(item, isDirectCompany);
  const rate = parseFloat(item.unit_rate !== undefined && item.unit_rate !== null ? item.unit_rate : (item.rate || 0));
  return Number((billingQty * rate).toFixed(2));
};

