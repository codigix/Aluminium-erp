const XLSX = require('xlsx');

const cleanup = value => (value || '').toString().replace(/\s+/g, ' ').trim();

const parseExcelDate = (val) => {
  if (!val) return '';
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  const cleanVal = String(val).trim();
  if (!cleanVal) return '';
  const parsed = new Date(cleanVal);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return cleanVal;
};

const normalizeDrawingType = (rawVal, description = '') => {
  if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
    const s = String(rawVal).trim().toLowerCase();
    // Keywords for Assembly
    if (s === 'assembly' || s === 'assly' || s === 'sub-assembly' || s === 'subassembly' || s === 'sa' || s.includes('assembly') || s.includes('assly')) {
      return 'Assembly';
    }
    // Keywords for Part
    if (s === 'part' || s === 'prt' || s === 'component' || s === 'child' || s.includes('part')) {
      return 'Part';
    }
    // Numeric representations: in 0-indexed lists, 0=Part, 1=Assembly. If 2 is used, it's also Assembly.
    if (s === '0') return 'Part';
    if (s === '1' || s === '2') return 'Assembly';
  }

  // Fallback: check description for assembly keywords
  if (description) {
    const desc = String(description).toLowerCase();
    if (desc.includes('assembly') || desc.includes('assly')) {
      return 'Assembly';
    }
  }

  return 'Part';
};

const parseExcelDrawings = async (filePath) => {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 });

    if (!rawData || rawData.length === 0) {
      return [];
    }

    let headerRowIndex = -1;
    let columnMap = {
      drawingNo: -1,
      revision: -1,
      description: -1,
      drawingType: -1,
      hsnCode: -1,
      deliveryDate: -1,
      qty: -1,
      remarks: -1,
      drawingFile: -1
    };

    // Find header row
    for (let i = 0; i < Math.min(50, rawData.length); i++) {
      const row = rawData[i].map(v => String(v || '').replace(/[\u00a0\s]+/g, ' ').trim().toLowerCase());
      const hasDrawing = row.some(v => v.includes('drawing') || v.includes('drw') || v.includes('part no'));
      
      if (hasDrawing) {
        headerRowIndex = i;
        row.forEach((cell, idx) => {
          if (cell.includes('drawing_file') || cell.includes('drawing file') || (cell.includes('file') && !cell.includes('type'))) {
            if (columnMap.drawingFile === -1) columnMap.drawingFile = idx;
          } else if (cell.includes('type')) {
            if (columnMap.drawingType === -1) columnMap.drawingType = idx;
          } else if (cell.includes('hsn')) {
            if (columnMap.hsnCode === -1) columnMap.hsnCode = idx;
          } else if (cell.includes('delivery') || cell.includes('dispatch') || cell.includes('due date')) {
            if (columnMap.deliveryDate === -1) columnMap.deliveryDate = idx;
          } else if (cell.includes('drawing') || cell.includes('drw') || cell.includes('part no') || cell.includes('item code')) {
            if (columnMap.drawingNo === -1) columnMap.drawingNo = idx;
          } else if (cell.includes('rev')) {
            if (columnMap.revision === -1) columnMap.revision = idx;
          } else if (cell.includes('desc')) {
            if (columnMap.description === -1) columnMap.description = idx;
          } else if (cell.includes('qty') || cell.includes('quantity')) {
            if (columnMap.qty === -1) columnMap.qty = idx;
          } else if (cell.includes('remark') || cell.includes('note')) {
            if (columnMap.remarks === -1) columnMap.remarks = idx;
          }
        });
        break;
      }
    }

    const drawings = [];
    if (headerRowIndex !== -1) {
      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;

        const drawingNo = columnMap.drawingNo !== -1 ? cleanup(row[columnMap.drawingNo]) : '';
        if (!drawingNo) continue;

        const rawType = columnMap.drawingType !== -1 ? cleanup(row[columnMap.drawingType]) : '';
        const description = columnMap.description !== -1 ? cleanup(row[columnMap.description]) : '';
        const drawingType = normalizeDrawingType(rawType, description);

        drawings.push({
          drawingNo: drawingNo,
          revision: columnMap.revision !== -1 ? cleanup(row[columnMap.revision]) : '',
          description: description,
          drawingType: drawingType,
          drawing_type: drawingType,
          hsnCode: columnMap.hsnCode !== -1 ? cleanup(row[columnMap.hsnCode]) : '',
          deliveryDate: columnMap.deliveryDate !== -1 ? parseExcelDate(row[columnMap.deliveryDate]) : '',
          qty: columnMap.qty !== -1 ? parseInt(row[columnMap.qty]) || 1 : 1,
          remarks: columnMap.remarks !== -1 ? cleanup(row[columnMap.remarks]) : '',
          drawingFile: columnMap.drawingFile !== -1 ? cleanup(row[columnMap.drawingFile]) : ''
        });
      }
    } else {
      // Fallback: try to find any row that looks like it has a drawing number
      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length < 1) continue;
        
        const firstCell = cleanup(row[0]);
        if (firstCell && firstCell.length > 3 && /[A-Z0-9]/.test(firstCell)) {
          const rawType = row[5] !== undefined ? cleanup(row[5]) : (row[4] ? cleanup(row[4]) : '');
          const description = row[1] && row[2] ? cleanup(row[1]) : (row[2] ? cleanup(row[2]) : '');
          const drawingType = normalizeDrawingType(rawType, description);

          drawings.push({
            drawingNo: firstCell,
            revision: row[4] ? cleanup(row[4]) : (row[1] ? cleanup(row[1]) : ''),
            description: description,
            hsnCode: row[3] ? cleanup(row[3]) : '',
            drawingType: drawingType,
            drawing_type: drawingType,
            qty: row[3] && !isNaN(row[3]) ? parseInt(row[3]) : (row[5] ? parseInt(row[5]) || 1 : 1),
            remarks: row[6] ? cleanup(row[6]) : '',
            drawingFile: row[7] ? cleanup(row[7]) : ''
          });
        }
      }
    }

    return drawings;
  } catch (error) {
    console.error('[ExcelDrawingParser] Error:', error.message);
    return [];
  }
};

module.exports = parseExcelDrawings;
module.exports.parseExcelDrawings = parseExcelDrawings;
module.exports.normalizeDrawingType = normalizeDrawingType;
