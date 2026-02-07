const XLSX = require('xlsx');

const cleanup = value => (value || '').toString().replace(/\s+/g, ' ').trim();

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
      qty: -1,
      remarks: -1,
      drawingFile: -1
    };

    // Find header row
    for (let i = 0; i < Math.min(50, rawData.length); i++) {
      const row = rawData[i].map(v => String(v || '').toLowerCase());
      const hasDrawing = row.some(v => v.includes('drawing') || v.includes('drw') || v.includes('part no'));
      
      if (hasDrawing) {
        headerRowIndex = i;
        row.forEach((cell, idx) => {
          if (cell.includes('drawing_file') || cell.includes('drawing file') || (cell.includes('file') && !cell.includes('type'))) {
            if (columnMap.drawingFile === -1) columnMap.drawingFile = idx;
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

        drawings.push({
          drawingNo: drawingNo,
          revision: columnMap.revision !== -1 ? cleanup(row[columnMap.revision]) : '',
          description: columnMap.description !== -1 ? cleanup(row[columnMap.description]) : '',
          qty: columnMap.qty !== -1 ? parseInt(row[columnMap.qty]) || 1 : 1,
          remarks: columnMap.remarks !== -1 ? cleanup(row[columnMap.remarks]) : '',
          drawingFile: columnMap.drawingFile !== -1 ? cleanup(row[columnMap.drawingFile]) : ''
        });
      }
    } else {
      // Fallback: try to find any row that looks like it has a drawing number
      // This is a bit risky but helps with unstructured files
      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length < 1) continue;
        
        // If first column looks like a drawing number (often has hyphens or mixed alphanumeric)
        const firstCell = cleanup(row[0]);
        if (firstCell && firstCell.length > 3 && /[A-Z0-9]/.test(firstCell)) {
           drawings.push({
             drawingNo: firstCell,
             revision: row[1] ? cleanup(row[1]) : '',
             description: row[2] ? cleanup(row[2]) : '',
             qty: row[3] ? parseInt(row[3]) || 1 : 1,
             remarks: row[4] ? cleanup(row[4]) : '',
             drawingFile: row[5] ? cleanup(row[5]) : ''
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
