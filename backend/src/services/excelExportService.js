const ExcelJS = require('exceljs');

const exportDrawingsToExcel = async (res, drawings, title, filters = {}) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Report');

  // Title block
  worksheet.mergeCells('A1:M1');
  const titleRow = worksheet.getCell('A1');
  titleRow.value = 'SP TECHPIONEER PRIVATE LIMITED';
  titleRow.font = { name: 'Calibri', size: 14, bold: true };
  titleRow.alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.mergeCells('A2:M2');
  const subtitleRow = worksheet.getCell('A2');
  subtitleRow.value = title.toUpperCase();
  subtitleRow.font = { name: 'Calibri', size: 12, bold: true };
  subtitleRow.alignment = { horizontal: 'center', vertical: 'middle' };

  // Yellow header filling
  for (let col = 1; col <= 13; col++) {
    const cell1 = worksheet.getRow(1).getCell(col);
    const cell2 = worksheet.getRow(2).getCell(col);
    cell1.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF59D' } // Light Yellow
    };
    cell2.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF59D' }
    };
  }

  // Add empty row
  worksheet.addRow([]);

  // Filter block
  const filterRows = [
    ['Customer :', filters.customer || 'All Customers', '', 'Project :', filters.project || 'All Projects'],
    ['Status :', filters.status || 'All', '', 'Generated :', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })]
  ];
  filterRows.forEach(r => {
    const row = worksheet.addRow(r);
    row.font = { name: 'Calibri', size: 10, bold: true };
  });

  worksheet.addRow([]); // Blank row

  // Headers
  const headers = [
    'PO No', 'Customer', 'Project', 'Drawing No', 'Drawing Name', 
    'Ordered Qty', 'Produced', 'QC Passed', 'FG Stock', 'Dispatched', 'Pending', 
    'Delivery Date', 'Status'
  ];
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
  
  for (let col = 1; col <= 13; col++) {
    const cell = headerRow.getCell(col);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF176' } // SAP Yellow
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD6D6D6' } },
      left: { style: 'thin', color: { argb: 'FFD6D6D6' } },
      bottom: { style: 'thin', color: { argb: 'FFD6D6D6' } },
      right: { style: 'thin', color: { argb: 'FFD6D6D6' } }
    };
  }

  worksheet.views = [{ state: 'frozen', ySplit: 7 }]; // Freeze first row (under header)

  let totalOrdered = 0;
  let totalProduced = 0;
  let totalQc = 0;
  let totalFg = 0;
  let totalDisp = 0;
  let totalPend = 0;

  drawings.forEach((d, idx) => {
    const isEven = idx % 2 === 1;
    const rowData = [
      d.po_number || '',
      d.company_name || '',
      d.project_name || '',
      d.drawing_no || '',
      d.drawing_name || '',
      d.ordered_qty ? Number(d.ordered_qty) : 0,
      d.produced ? Number(d.produced) : 0,
      d.qc ? Number(d.qc) : 0,
      d.fg_stock ? Number(d.fg_stock) : 0,
      d.dispatched ? Number(d.dispatched) : 0,
      d.pending ? Number(d.pending) : 0,
      d.delivery_date ? new Date(d.delivery_date).toLocaleDateString('en-IN') : '',
      d.status || ''
    ];
    
    totalOrdered += d.ordered_qty ? Number(d.ordered_qty) : 0;
    totalProduced += d.produced ? Number(d.produced) : 0;
    totalQc += d.qc ? Number(d.qc) : 0;
    totalFg += d.fg_stock ? Number(d.fg_stock) : 0;
    totalDisp += d.dispatched ? Number(d.dispatched) : 0;
    totalPend += d.pending ? Number(d.pending) : 0;

    const row = worksheet.addRow(rowData);
    row.font = { name: 'Calibri', size: 10 };
    
    for (let col = 1; col <= 13; col++) {
      const cell = row.getCell(col);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD6D6D6' } },
        left: { style: 'thin', color: { argb: 'FFD6D6D6' } },
        bottom: { style: 'thin', color: { argb: 'FFD6D6D6' } },
        right: { style: 'thin', color: { argb: 'FFD6D6D6' } }
      };
      
      if (isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFFE7' } // Alternate row color
        };
      }

      // Center numeric and short columns
      if ([1, 4, 12, 13].includes(col)) {
        cell.alignment = { horizontal: 'center' };
      } else if ([6, 7, 8, 9, 10, 11].includes(col)) {
        cell.alignment = { horizontal: 'right' };
      } else {
        cell.alignment = { wrapText: true };
      }

      // Status colors
      if (col === 13) {
        if (d.status === 'Completed' || d.status === 'Dispatched') {
          cell.font = { color: { argb: 'FF43A047' }, bold: true };
        } else if (d.status === 'Ready') {
          cell.font = { color: { argb: 'FF43A047' }, bold: true };
        } else if (d.status === 'Partial') {
          cell.font = { color: { argb: 'FFFB8C00' }, bold: true };
        } else {
          cell.font = { color: { argb: 'FFE53935' }, bold: true };
        }
      }
    }
  });

  worksheet.addRow([]); // Blank row

  // Totals block
  const totalRows = [
    ['Total Drawings', drawings.length],
    ['Total Ordered Qty', totalOrdered],
    ['Total Produced Qty', totalProduced],
    ['Total QC Passed Qty', totalQc],
    ['Total FG Stock', totalFg],
    ['Total Dispatched', totalDisp],
    ['Total Pending', totalPend]
  ];

  totalRows.forEach(tr => {
    const row = worksheet.addRow([tr[0], tr[1]]);
    row.font = { name: 'Calibri', size: 10, bold: true };
    worksheet.getCell(`B${row.number}`).alignment = { horizontal: 'left' };
  });

  // Enable Auto-filter on columns
  worksheet.autoFilter = 'A7:M7';

  // Auto-fit column widths
  worksheet.columns.forEach(column => {
    let maxLen = 10;
    column.eachCell({ includeEmpty: false }, cell => {
      if (cell.value && cell.value.toString().length > maxLen) {
        maxLen = cell.value.toString().length;
      }
    });
    column.width = Math.min(maxLen + 3, 30);
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=Report_${new Date().toISOString().split('T')[0]}.xlsx`);

  await workbook.xlsx.write(res);
};

module.exports = {
  exportDrawingsToExcel
};
