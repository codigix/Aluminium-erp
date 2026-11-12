// Backend copy of frontend/src/utils/formatters.js → formatDimensions (keep both in sync).
// Engineering prefix format used across the ERP, e.g. "PL 300 × 200 × 10 mm", "RB Ø20 × 1000 mm", "SQT 30 × 3 × 1672 mm".
const formatDimensions = (item) => {
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

  const shape = (
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
    matchedShape = thk > 0 ? 'threaded rod' : 'round bar';
  } else {
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

  const n = (val) => {
    if (val === undefined || val === null || val === '' || isNaN(parseFloat(val)) || parseFloat(val) === 0) return null;
    const num = parseFloat(val);
    return num % 1 === 0 ? num.toFixed(0) : num.toFixed(1);
  };

  let prefix = '';
  let dimStr = '';

  if (matchedShape === 'plate') {
    prefix = 'PL';
    dimStr = [n(wid), n(len), n(thk)].filter(Boolean).join(' × ');
  } else if (matchedShape === 'flat bar') {
    prefix = 'FL';
    const hOrT = thk > 0 ? thk : (od > 0 ? od : 0);
    dimStr = [n(wid), n(hOrT), n(len)].filter(Boolean).join(' × ');
  } else if (matchedShape === 'round bar') {
    prefix = 'RB';
    const dVal = dia > 0 ? dia : (od > 0 ? od : wid);
    dimStr = [`Ø${n(dVal)}`, n(len)].filter(Boolean).join(' × ');
  } else if (matchedShape === 'hexagonal bar') {
    prefix = 'HEX';
    dimStr = [`AF${n(wid)}`, n(len)].filter(Boolean).join(' × ');
  } else if (matchedShape === 'square bar') {
    prefix = 'SB';
    dimStr = [n(wid), n(len)].filter(Boolean).join(' × ');
  } else if (matchedShape === 'rectangular bar') {
    prefix = 'REC';
    dimStr = [n(wid), n(od), n(len)].filter(Boolean).join(' × ');
  } else if (matchedShape === 'pipe') {
    prefix = 'PIPE';
    const odVal = od > 0 ? od : dia;
    dimStr = [`OD${n(odVal)}`, n(thk), n(len)].filter(Boolean).join(' × ');
  } else if (matchedShape === 'square tube') {
    prefix = 'SQT';
    dimStr = [n(wid), n(thk), n(len)].filter(Boolean).join(' × ');
  } else if (matchedShape === 'rectangular tube') {
    prefix = 'RCT';
    dimStr = [n(wid), n(od), n(thk), n(len)].filter(Boolean).join(' × ');
  } else if (matchedShape === 'threaded rod') {
    prefix = 'TR';
    const dVal = dia > 0 ? dia : od;
    const pVal = parseFloat(item.thread_pitch || item.threadPitch || item.dimensions?.thread_pitch || item.dimensions?.threadPitch || thk || item.thickness || item.dimensions?.thickness || 0);
    dimStr = [`M${n(dVal)}`, pVal > 0 ? n(pVal) : null, n(len)].filter(Boolean).join(' × ');
  } else if (matchedShape === 'angle') {
    prefix = 'L';
    dimStr = [n(wid), n(od || thk), n(thk), n(len)].filter(Boolean).join(' × ');
  } else if (matchedShape === 'equal angle') {
    prefix = 'EA';
    dimStr = [n(wid), n(wid), n(thk), n(len)].filter(Boolean).join(' × ');
  } else if (matchedShape === 'unequal angle') {
    prefix = 'UA';
    dimStr = [n(wid), n(od), n(thk), n(len)].filter(Boolean).join(' × ');
  } else {
    dimStr = [n(wid), n(od), n(thk), n(dia), n(len)].filter(Boolean).join(' × ');
  }

  if (!dimStr) return '';
  return `${prefix} ${dimStr} mm`.trim();
};

module.exports = { formatDimensions };
