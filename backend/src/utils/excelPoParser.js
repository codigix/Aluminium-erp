const XLSX = require('xlsx');

const cleanup = value => (value || '').toString().replace(/\s+/g, ' ').trim();

const toNumber = value => {
  if (value === undefined || value === null) return 0;
  const normalized = String(value).replace(/[^0-9.-]/g, '');
  return normalized ? Number(normalized) : 0;
};

const normalizeDate = value => {
  if (!value) return '';
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
  return '';
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
    
    for (const row of rawData.slice(0, Math.min(20, rawData.length))) {
      const rowText = row.map(v => cleanup(v || '')).filter(v => v).join(' ');
      
      if (!poNumber) {
        const poMatch = rowText.match(/(?:PO|ORDER)\s*(?:NO|#)?[:\s]*([A-Z0-9\-\.]+)/i);
        if (poMatch) {
          poNumber = cleanup(poMatch[1]).toUpperCase();
        }
      }
      
      if (!poDate) {
        const dateMatch = rowText.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);
        if (dateMatch) {
          poDate = normalizeDate(dateMatch[1]);
        }
      }
      
      if (!gstin && rowText.match(/GSTIN|GST\s*NO/i)) {
        const gstMatch = rowText.match(/(?:GSTIN|GST\s*NO)[:\s]*([A-Z0-9]+)/i);
        if (gstMatch) {
          gstin = cleanup(gstMatch[1]);
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
    
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    
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
        
        if (description && quantities.length > 0) {
          const quantity = toNumber(quantities[0] || 0);
          const rate = toNumber(quantities[quantities.length - 1] || 0);
          
          if ((quantity > 0 && quantity < 1000000) && (rate > 0 || quantity > 0)) {
            items.push({
              itemCode: `ITEM-${items.length + 1}`,
              description: description.substring(0, 100),
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

    console.log('[ExcelPoParser] Extracted header:', { poNumber, poDate, companyName, gstin });
    console.log('[ExcelPoParser] Extracted items:', items.length);
    
    return { header, items };
  } catch (error) {
    console.error('[ExcelPoParser] Error:', error.message);
    return { header: {}, items: [] };
  }
};

module.exports = parseExcelPo;
