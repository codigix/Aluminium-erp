const XLSX = require('xlsx');

const cleanup = value => (value || '').toString().replace(/\s+/g, ' ').trim();

const toNumber = value => {
  if (value === undefined || value === null) return 0;
  const normalized = String(value).replace(/[^0-9.-]/g, '');
  return normalized ? Number(normalized) : 0;
};

const normalizeDate = value => {
  if (!value) return null;
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const cleaned = String(value).replace(/[.]/g, '-').replace(/\//g, '-').trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(cleaned)) {
    const [dd, mm, yyyy] = cleaned.split('-');
    return `${yyyy}-${mm}-${dd}`;
  }
  if (/^\d{2}-\d{2}-\d{2}$/.test(cleaned)) {
    const [dd, mm, yy] = cleaned.split('-');
    const year = Number(yy) + 2000;
    return `${year}-${mm}-${dd}`;
  }
  return null;
};

const parseExcelPo = async fileBuffer => {
  if (!fileBuffer) {
    return {
      header: {},
      items: []
    };
  }

  try {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', defval: '' });
    const sheetName = workbook.SheetNames[0];
    
    console.log('[ExcelPoParser] Sheet names:', workbook.SheetNames);
    
    if (!sheetName) {
      console.warn('[ExcelPoParser] No sheet found');
      return { header: {}, items: [] };
    }

    const sheet = workbook.Sheets[sheetName];
    
    const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 });
    
    console.log('[ExcelPoParser] Raw data rows:', rawData.length);
    console.log('[ExcelPoParser] First 5 rows:', JSON.stringify(rawData.slice(0, 5)));
    
    if (!rawData || rawData.length === 0) {
      console.warn('[ExcelPoParser] No data in sheet');
      return { header: {}, items: [] };
    }

    const header = {};
    const items = [];
    
    let poNumber = '';
    let poDate = '';
    let companyName = '';
    let paymentTerms = '';
    let deliveryTerms = '';
    let gstin = '';
    
    const flatText = rawData.flat().map(v => cleanup(v || '')).join(' ');
    console.log('[ExcelPoParser] Full text length:', flatText.length);
    
    for (const row of rawData.slice(0, Math.min(30, rawData.length))) {
      const rowText = row.map(v => cleanup(v || '')).filter(v => v).join(' ');
      
      if (!poNumber) {
        // Broadened PO number search to include Quotation/Inquiry/Reference
        const poMatch = rowText.match(/(?:PO|ORDER|QUOTATION|QUOTE|INQUIRY|REF|REFERENCE)\s*(?:NO|#)?[:\-\s]*([A-Z0-9\-\.\/]+)/i);
        if (poMatch && poMatch[1] && poMatch[1].length > 2) {
          poNumber = cleanup(poMatch[1]).toUpperCase();
        }
      }
      
      if (!poDate) {
        const dateMatch = rowText.match(/(?:DATE)[:\-\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i) || rowText.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);
        if (dateMatch) {
          poDate = normalizeDate(dateMatch[1]);
        }
      }
      
      if (!gstin && rowText.match(/GSTIN|GST\s*NO/i)) {
        const gstMatch = rowText.match(/(?:GSTIN|GST\s*NO)[:\-\s]*([A-Z0-9]+)/i);
        if (gstMatch) {
          gstin = cleanup(gstMatch[1]);
        }
      }
      
      if (!companyName) {
        // Look for company keywords or "To: Company Name" pattern
        const toMatch = rowText.match(/(?:TO|CUSTOMER|BUYER|CLIENT)\s*[:\-\,]?\s*([A-Z\s\.\,]{3,})/i);
        if (toMatch && toMatch[1]) {
          const name = cleanup(toMatch[1]);
          if (name.match(/SIDEL|PHOENIX|BOSSAR|SP\s*TECH/i)) {
            companyName = name;
          }
        }
        
        if (!companyName) {
          if (rowText.match(/SIDEL\s+INDIA/i) || rowText.match(/SIDEL\s+PVT/i)) {
            companyName = 'Sidel India Pvt Ltd';
          } else if (rowText.includes('TECHPIONEER')) {
            companyName = 'SP TECHPIONEER PVT. LTD.';
          } else if (rowText.includes('PHOENIX')) {
            companyName = 'Phoenix';
          } else if (rowText.includes('BOSSAR')) {
            companyName = 'Bossar';
          }
        }
      }
    }
    
    header.poNumber = poNumber;
    header.poDate = poDate;
    header.companyName = companyName;
    header.customerGstin = gstin;
    header.paymentTerms = paymentTerms;
    header.deliveryTerms = deliveryTerms;
    header.freightTerms = '';
    header.currency = 'INR';
    header.remarks = '';
    header.creditDays = '';
    
    // Find the header row index and map columns
    let headerRowIndex = -1;
    let columnMap = {
      drawingNo: -1,
      description: -1,
      quantity: -1,
      rate: -1
    };

    for (let i = 0; i < Math.min(50, rawData.length); i++) {
      const row = rawData[i].map(v => String(v || '').toLowerCase());
      const hasDescription = row.some(v => v.includes('description') || v.includes('particulars'));
      const hasQty = row.some(v => v.includes('qty') || v.includes('quantity'));
      
      if (hasDescription && hasQty) {
        headerRowIndex = i;
        row.forEach((cell, idx) => {
          if (cell.includes('drawing') || cell.includes('item') || cell.includes('code') || cell.includes('material') || cell.includes('part')) {
            if (columnMap.drawingNo === -1) columnMap.drawingNo = idx;
          } else if (cell.includes('description') || cell.includes('particulars')) {
            if (columnMap.description === -1) columnMap.description = idx;
          } else if (cell.includes('qty') || cell.includes('quantity')) {
            if (columnMap.quantity === -1) columnMap.quantity = idx;
          } else if (cell.includes('rate') || cell.includes('price') || cell.includes('unit cost')) {
            if (columnMap.rate === -1) columnMap.rate = idx;
          }
        });
        break;
      }
    }

    console.log('[ExcelPoParser] Detected header at row:', headerRowIndex, 'Map:', columnMap);

    const EXCLUDE_PATTERNS = [
      /^cgst/i,
      /^sgst/i,
      /^igst/i,
      /^\s*tax/i,
      /^\s*total/i,
      /^\s*subtotal/i,
      /^\s*amount/i,
      /^gst\s*\d+/i,
      /^taxable/i,
      /^remarks/i,
      /^condition/i,
      /^sign/i,
      /^authorized/i,
      /^payment/i,
      /^delivery\s*date/i,
      /^po\s*/i,
      /^order\s*/i
    ];

    // If we found a header row, use the column map. Otherwise, fallback to the old heuristic.
    if (headerRowIndex !== -1) {
      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;
        
        const rowText = row.join(' ').toLowerCase();
        if (EXCLUDE_PATTERNS.some(p => p.test(rowText))) continue;

        const description = columnMap.description !== -1 ? cleanup(row[columnMap.description]) : '';
        const drawingNo = columnMap.drawingNo !== -1 ? cleanup(row[columnMap.drawingNo]) : '';
        const quantity = columnMap.quantity !== -1 ? toNumber(row[columnMap.quantity]) : 0;
        const rate = columnMap.rate !== -1 ? toNumber(row[columnMap.rate]) : 0;

        if (description && (quantity > 0 || rate > 0)) {
          items.push({
            drawingNo: drawingNo || `DRW-${items.length + 1}`,
            description: description.substring(0, 150),
            quantity: quantity || 1,
            unit: 'NOS',
            rate: rate || 0,
            cgstPercent: 0,
            sgstPercent: 0,
            igstPercent: 0,
            deliveryDate: '',
            hsnCode: '',
            discount: 0
          });
        }
      }
    } else {
      // Fallback for sheets without clear headers (existing logic)
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowValues = Object.values(row).map(v => cleanup(v || ''));
        const rowText = rowValues.join(' ').toLowerCase();
        
        const isExcluded = EXCLUDE_PATTERNS.some(pattern => pattern.test(rowText));
        if (isExcluded) continue;
        
        const hasNumericData = rowValues.some(v => /^\d+[\d.,]*$/.test(v));
        
        if (hasNumericData && rowValues.length >= 2) {
          const description = rowValues.find(v => v && v.length > 3 && v.length < 200 && /[A-Za-z]/.test(v) && !/^\d+$/.test(v)) || '';
          const quantities = rowValues.filter(v => /^\d+[\d.,]*$/.test(v));
          
          let potentialDrawingNo = '';
          const keys = Object.keys(row);
          const drawingKey = keys.find(k => {
            const lk = k.toLowerCase();
            return lk.includes('drawing') || lk.includes('item') || lk.includes('code') || lk.includes('material') || lk.includes('part');
          });
          
          if (drawingKey && row[drawingKey]) {
            potentialDrawingNo = cleanup(row[drawingKey]);
          }
          
          if (!potentialDrawingNo || potentialDrawingNo.length <= 2) {
            potentialDrawingNo = rowValues.find(v => {
              const val = String(v).trim();
              return val && val !== description && val.length > 2 && !quantities.includes(val);
            }) || '';
          }
          
          if (description && quantities.length > 0) {
            const quantity = toNumber(quantities[0] || 0);
            const rate = toNumber(quantities[quantities.length - 1] || 0);
            
            if ((quantity > 0 && quantity < 1000000) && (rate > 0 || quantity > 0)) {
              items.push({
                drawingNo: potentialDrawingNo || `DRW-${items.length + 1}`,
                description: description.substring(0, 150),
                quantity: Math.max(quantity, 1),
                unit: 'NOS',
                rate: rate || 0,
                cgstPercent: 0,
                sgstPercent: 0,
                igstPercent: 0,
                deliveryDate: '',
                hsnCode: '',
                discount: 0
              });
            }
          }
        }
      }
    }

    console.log('[ExcelPoParser] Extracted header:', { poNumber, poDate, companyName, gstin });
    console.log('[ExcelPoParser] Extracted items:', items.length);
    
    return { header, items };
  } catch (error) {
    console.error('[ExcelPoParser] Error:', error.message);
    return { header: {}, items: [] };
  }
};

module.exports = parseExcelPo;
