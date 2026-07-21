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
 * @param {object} item - The item containing dimension fields
 * @returns {string} - Formatted dimension string (e.g. "A:100 × T:3 × L:6000 mm")
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

  // Determine shape
  let shape = (
    item.shape_type || 
    item.shape_name || 
    item.shape || 
    item.material_name || 
    item.name || 
    item.item_name || 
    item.item_code || 
    ''
  ).toLowerCase();

  let matchedShape = '';
  if (shape.includes('threaded') || shape.includes('thread')) {
    matchedShape = 'threaded rod';
  } else if (shape.includes('square tube') || (shape.includes('square') && shape.includes('tube'))) {
    matchedShape = 'square tube';
  } else if (shape.includes('rectangular tube') || shape.includes('rect tube') || (shape.includes('rect') && shape.includes('tube'))) {
    matchedShape = 'rectangular tube';
  } else if (shape.includes('square bar') || (shape.includes('square') && shape.includes('bar'))) {
    matchedShape = 'square bar';
  } else if (shape.includes('rectangular bar') || (shape.includes('rect') && shape.includes('bar'))) {
    matchedShape = 'rectangular bar';
  } else if (shape.includes('hex') || shape.includes('hexagonal')) {
    matchedShape = 'hexagonal bar';
  } else if (shape.includes('plate') || shape.includes('sheet')) {
    matchedShape = 'plate';
  } else if (shape.includes('flat')) {
    matchedShape = 'flat';
  } else if (shape.includes('pipe') || shape.includes('tube')) {
    matchedShape = 'pipe';
  } else if (shape.includes('round') || shape.includes('rod') || shape.includes('bar')) {
    matchedShape = 'round';
  } else {
    // Fallback detection by dimension values
    if (dia > 0) {
      matchedShape = 'round';
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

  const fmt = (label, val) => {
    if (val === undefined || val === null || val === '' || isNaN(parseFloat(val))) return null;
    const num = parseFloat(val);
    const formatted = num % 1 === 0 ? num.toFixed(0) : num.toFixed(1);
    return `${label}:${formatted}`;
  };

  let parts = [];
  if (matchedShape === 'plate' || matchedShape === 'flat') {
    parts = [fmt('L', len), fmt('W', wid), fmt('T', thk)];
  } else if (matchedShape === 'round') {
    const dVal = dia > 0 ? dia : (od > 0 ? od : wid);
    parts = [fmt('D', dVal), fmt('L', len)];
  } else if (matchedShape === 'hexagonal bar') {
    parts = [fmt('AF', wid), fmt('L', len)];
  } else if (matchedShape === 'square bar') {
    parts = [fmt('W', wid), fmt('L', len)];
  } else if (matchedShape === 'rectangular bar') {
    parts = [fmt('W', wid), fmt('H', od), fmt('L', len)];
  } else if (matchedShape === 'pipe') {
    const odVal = od > 0 ? od : dia;
    parts = [fmt('OD', odVal), fmt('T', thk), fmt('L', len)];
  } else if (matchedShape === 'square tube') {
    parts = [fmt('W', wid), fmt('T', thk), fmt('L', len)];
  } else if (matchedShape === 'rectangular tube') {
    parts = [fmt('W', wid), fmt('H', od), fmt('T', thk), fmt('L', len)];
  } else if (matchedShape === 'threaded rod') {
    const dVal = dia > 0 ? dia : od;
    const pVal = parseFloat(item.thread_pitch || item.threadPitch || item.dimensions?.thread_pitch || item.dimensions?.threadPitch || 0);
    parts = [fmt('OD', dVal), fmt('P', pVal), fmt('L', len)];
  } else {
    parts = [fmt('OD', od), fmt('W', wid), fmt('H', od), fmt('T', thk), fmt('Dia', dia), fmt('L', len)];
  }

  // Filter out null/undefined/empty parts
  const cleanParts = parts.filter(Boolean);
  if (cleanParts.length === 0) return '';
  return cleanParts.join(' × ') + ' mm';
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
  const dDensity = parseFloat(density) || 0;
  if (dDensity <= 0) return 0;

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

  if (shapeStr.includes('threaded rod') || shapeStr.includes('thread rod') || shapeStr.includes('threaded')) {
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
