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
  if (shape.includes('square') || shape.includes('sq') || shape.includes('box')) {
    matchedShape = 'square tube';
  } else if (shape.includes('rectangular') || shape.includes('rect') || shape.includes('rt')) {
    matchedShape = 'rectangular tube';
  } else if (shape.includes('hex') || shape.includes('hexagonal')) {
    matchedShape = 'hexagonal bar';
  } else if (shape.includes('plate') || shape.includes('sheet') || shape.includes('flat') || shape.includes('profile')) {
    matchedShape = 'plate';
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
    } else if (wid > 0 && thk > 0 && len > 0) {
      matchedShape = 'plate';
    } else if (wid > 0 && len > 0) {
      matchedShape = 'hexagonal bar';
    } else {
      matchedShape = 'plate';
    }
  }

  const fmt = (label, val) => {
    if (!val || parseFloat(val) === 0) return null;
    const num = parseFloat(val);
    const formatted = num % 1 === 0 ? num.toFixed(0) : num.toFixed(1);
    return `${label}:${formatted}`;
  };

  let parts = [];
  if (matchedShape === 'square tube') {
    parts = [fmt('A', wid), fmt('T', thk), fmt('L', len)];
  } else if (matchedShape === 'rectangular tube') {
    parts = [fmt('W', wid), fmt('H', od), fmt('T', thk), fmt('L', len)];
  } else if (matchedShape === 'round') {
    const dVal = dia > 0 ? dia : (od > 0 ? od : wid);
    parts = [fmt('D', dVal), fmt('L', len)];
  } else if (matchedShape === 'pipe') {
    const odVal = od > 0 ? od : dia;
    parts = [fmt('OD', odVal), fmt('T', thk), fmt('L', len)];
  } else if (matchedShape === 'hexagonal bar') {
    parts = [fmt('AF', wid), fmt('L', len)];
  } else if (matchedShape === 'plate') {
    parts = [fmt('W', wid), fmt('T', thk), fmt('L', len)];
  } else {
    parts = [fmt('OD', od), fmt('W', wid), fmt('T', thk), fmt('Dia', dia), fmt('L', len)];
  }

  // Filter out null/undefined/empty parts
  const cleanParts = parts.filter(Boolean);
  if (cleanParts.length === 0) return '';
  return cleanParts.join(' × ') + ' mm';
};

