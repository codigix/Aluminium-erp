let pdfParseModule;
try {
  pdfParseModule = require('pdf-parse');
} catch {
  pdfParseModule = null;
}

const createPdfParseFn = moduleRef => {
  if (!moduleRef) {
    return null;
  }
  if (typeof moduleRef === 'function') {
    return moduleRef;
  }
  if (typeof moduleRef.default === 'function') {
    return moduleRef.default;
  }
  if (typeof moduleRef.pdfParse === 'function') {
    return moduleRef.pdfParse;
  }
  if (typeof moduleRef.default?.pdfParse === 'function') {
    return moduleRef.default.pdfParse;
  }
  const pdfParseClass = typeof moduleRef.PDFParse === 'function'
    ? moduleRef.PDFParse
    : typeof moduleRef.default?.PDFParse === 'function'
      ? moduleRef.default.PDFParse
      : typeof moduleRef.default?.default?.PDFParse === 'function'
        ? moduleRef.default.default.PDFParse
        : null;
  if (typeof pdfParseClass === 'function') {
    return async buffer => {
      if (!buffer) {
        return {};
      }
      
      try {
        const parser = new pdfParseClass(new Uint8Array(buffer));
        if (typeof parser.load === 'function') {
          await parser.load();
        }
        const result = await parser.getText();
        const text = typeof result === 'string' ? result : (result?.text || '');
        return { text };
      } catch (e) {
        console.error('PDF Parse error:', e.message);
        return {};
      }
    };
  }
  return null;
};

const pdfParse = createPdfParseFn(pdfParseModule);

if (typeof pdfParse !== 'function') {
  throw new Error('pdf-parse module did not export a parser function');
}

const cleanup = value => (value || '').toString().replace(/\s+/g, ' ').trim();

const extractField = (text, patterns) => {
  for (const pattern of patterns) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i');
    const match = regex.exec(text);
    if (match && match[1]) {
      return cleanup(match[1]);
    }
  }
  return '';
};

const extractAddressBlock = (text, labelPatterns) => {
  for (const label of labelPatterns) {
    const regex = new RegExp(`${label}\\s*[:\\-]?\\s*([\\s\\S]{0,200})`, 'i');
    const match = regex.exec(text);
    if (match && match[1]) {
      const segment = match[1].split(/\n{2,}/)[0];
      const lines = segment.split('\n').map(cleanup).filter(Boolean).slice(0, 5);
      if (lines.length) {
        return lines.join(', ');
      }
    }
  }
  return '';
};

const toNumber = value => {
  if (value === undefined || value === null) return 0;
  const normalized = String(value).replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const num = Number(normalized);
  return isNaN(num) ? 0 : num;
};

const MONTHS = {
  JAN: '01',
  FEB: '02',
  MAR: '03',
  APR: '04',
  MAY: '05',
  JUN: '06',
  JUL: '07',
  AUG: '08',
  SEP: '09',
  SEPT: '09',
  OCT: '10',
  NOV: '11',
  DEC: '12'
};

const normalizeDate = value => {
  if (!value) return null;
  const cleaned = value.replace(/[.]/g, '-').replace(/\//g, '-').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(cleaned)) {
    const [dd, mm, yyyy] = cleaned.split('-');
    return `${yyyy}-${mm}-${dd}`;
  }
  if (/^\d{2}-\d{2}-\d{2}$/.test(cleaned)) {
    const [dd, mm, yy] = cleaned.split('-');
    const year = Number(yy) + 2000;
    return `${year}-${mm}-${dd}`;
  }
  const match = cleaned.match(/^(\d{1,2})-([A-Za-z]{3,4})-(\d{2,4})$/);
  if (match) {
    const [, dd, mon, yy] = match;
    const month = MONTHS[mon.substring(0, 3).toUpperCase()] || '01';
    const day = dd.padStart(2, '0');
    const year = yy.length === 2 ? Number(yy) + 2000 : Number(yy);
    return `${year}-${month}-${day}`;
  }
  return null;
};

const deriveCreditDays = paymentTerms => {
  const match = (paymentTerms || '').match(/(\d+)\s*day/i);
  return match ? match[1] : '';
};

const UNIT_KEYWORDS = ['NOS', 'PC', 'PCS', 'EA', 'SET', 'UNIT', 'PAIR', 'PACK', 'KG', 'LTR', 'LITRE', 'MTR', 'METER', 'ROLL', 'LOT'];

const COMPANY_TEMPLATES = [
  {
    code: 'SIDEL',
    displayName: 'Sidel India Pvt Ltd',
    keywords: [/SIDEL\s+INDIA/i, /SIDEL\s+PVT/i]
  },
  {
    code: 'PHOENIX',
    displayName: 'Phoenix',
    keywords: [/PHOENIX/i]
  },
  {
    code: 'BOSSAR',
    displayName: 'Bossar',
    keywords: [/BOSSAR/i]
  }
];

const COMPANY_BY_CODE = COMPANY_TEMPLATES.reduce((acc, template) => {
  acc[template.code] = template;
  return acc;
}, {});

const detectCompany = text => {
  const source = text || '';
  for (const template of COMPANY_TEMPLATES) {
    if (template.keywords.some(regex => regex.test(source))) {
      return template.code;
    }
  }
  return 'UNKNOWN';
};

const ROW_STOP_PATTERNS = [
  /subtotal/i,
  /total\s*value/i,
  /grand\s*total/i,
  /amount\s*payable/i,
  /terms\s*&?\s*conditions/i,
  /special\s*instructions/i,
  /test\s*expectation/i,
  /^test\s*note/i,
  /^note\s*:/i,
  /--\s*\d+\s*of\s*\d+\s*--/i
];

const ROW_IGNORE_PATTERNS = [
  /^cin\b/i,
  /^gstin\b/i,
  /^telephone\b/i,
  /^phone\b/i,
  /^fax\b/i,
  /^email\b/i,
  /^website\b/i,
  /^pincode\b/i,
  /^page\s*\d+\s*(?:of|\/)\s*\d+/i,
  /^--\s*\d+\s*of\s*\d+\s*--/i,
  /^(?:sr\.?\s*no|drawing\s*no|description|hsn\s*code|delivery\s*date|qty|unit|rate|cgst|sgst|total\s*amount)/i
];

const DATE_REGEX = /(\d{1,2}[-/.][A-Za-z0-9]{2,3}[-/.][0-9]{2,4}|\d{4}[-/.][0-9]{1,2}[-/.][0-9]{1,2})/;

// Pattern for a drawing number: e.g. Y31700, Y2027, TEST-DRW-99999, DRW-001, 520001, AL-100
const isDrawingCode = (str) => {
  if (!str || typeof str !== 'string') return false;
  const clean = str.replace(/[:,\(\)]/g, '').toUpperCase();
  if (clean.length < 3 || clean.length > 30) return false;
  if (/^(ITEM|SR|NO|CODE|HSN|QTY|DATE|UNIT|RATE|INR|USD|EUR|NOS|PCS|PURCHASE|ORDER|CUSTOMER|PAYMENT|TERMS|TOTAL|DESCRIPTION|AMOUNT|DELIVERY|SL|SUBTOTAL)$/i.test(clean)) {
    return false;
  }
  const hasDigit = /\d/.test(clean);
  const hasSeparator = /[-_/.]/.test(clean);
  const isValidFormat = /^[A-Z0-9][A-Z0-9\-_./]*[A-Z0-9]$/.test(clean) || /^[A-Z0-9]{3,}$/.test(clean);
  return isValidFormat && (hasDigit || hasSeparator);
};

/**
 * Segment text into header, table lines, and footer
 */
const segmentPoSections = text => {
  if (!text) {
    return { headerText: '', tableLines: [], footerText: '', tableText: '' };
  }
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const headerIndex = lines.findIndex(line => {
    const norm = line.toLowerCase();
    return (
      (norm.includes('item') && (norm.includes('description') || norm.includes('qty'))) ||
      (norm.includes('material') && norm.includes('qty')) ||
      (norm.includes('drawing') && (norm.includes('no') || norm.includes('description') || norm.includes('qty'))) ||
      (norm.includes('drg') && (norm.includes('no') || norm.includes('qty'))) ||
      (norm.includes('part') && (norm.includes('no') || norm.includes('description')))
    );
  });

  if (headerIndex === -1) {
    return { headerText: text, tableLines: lines, footerText: '', tableText: text };
  }

  let tableEnd = lines.length;
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim().toLowerCase();
    if (!trimmed) continue;
    if (
      trimmed.includes('subtotal') ||
      trimmed.includes('total value') ||
      trimmed.includes('grand total') ||
      trimmed.includes('amount payable') ||
      trimmed.includes('terms & conditions') ||
      trimmed.includes('terms and conditions') ||
      trimmed.includes('special instructions')
    ) {
      tableEnd = i;
      break;
    }
  }

  const headerText = lines.slice(0, headerIndex).join('\n');
  const tableLines = lines.slice(headerIndex + 1, tableEnd);
  const footerText = lines.slice(tableEnd).join('\n');
  return {
    headerText,
    tableLines,
    footerText,
    tableText: tableLines.join('\n')
  };
};

/**
 * Consolidate multi-line wrapped table rows into single logical rows
 */
const consolidateTableRows = (lines, knownDrawingsSet = new Set()) => {
  const rows = [];
  let currentRow = '';

  const isNewRowStart = (line) => {
    const trimmed = line.trim();
    // 1. Starts with serial number followed by drawing/text: e.g. "1 \tY31700", "1. Y31700"
    if (/^\d{1,3}[\s.\t]+[A-Za-z0-9]/.test(trimmed)) {
      return true;
    }
    // 2. Starts with a known drawing number
    const firstTok = trimmed.split(/\s+/)[0]?.replace(/[^A-Za-z0-9\-_./]/g, '').toUpperCase();
    if (firstTok && knownDrawingsSet.has(firstTok)) {
      return true;
    }
    // 3. Starts with a drawing-like code token (must contain digits or hyphens)
    if (isDrawingCode(firstTok)) {
      return true;
    }
    return false;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (ROW_IGNORE_PATTERNS.some(p => p.test(line))) continue;
    if (ROW_STOP_PATTERNS.some(p => p.test(line))) break;

    if (isNewRowStart(line)) {
      if (currentRow) {
        rows.push(currentRow);
      }
      currentRow = line;
    } else {
      if (currentRow) {
        currentRow = `${currentRow} ${line}`;
      } else {
        currentRow = line;
      }
    }
  }

  if (currentRow) {
    rows.push(currentRow);
  }

  return rows;
};

/**
 * Parse a consolidated single line item string into a structured PO item
 */
const parseConsolidatedRow = (line, knownDrawingsSet = new Set()) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 5) return null;
  if (ROW_STOP_PATTERNS.some(p => p.test(trimmed))) return null;

  // Split tokens by whitespace or tabs
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;

  // 1. Look for drawing number
  let drawingNo = '';
  let dwgIndex = -1;

  // A. Check for match in knownDrawingsSet
  for (let i = 0; i < tokens.length; i++) {
    const cleanTok = tokens[i].replace(/[^A-Za-z0-9\-_./]/g, '').toUpperCase();
    if (cleanTok && knownDrawingsSet.has(cleanTok)) {
      drawingNo = cleanTok;
      dwgIndex = i;
      break;
    }
  }

  // B. If not in knownDrawingsSet, look for drawing code pattern
  if (!drawingNo) {
    for (let i = 0; i < Math.min(tokens.length, 5); i++) {
      const tok = tokens[i].replace(/[:,\(\)]/g, '');
      if (/^\d{1,3}\.?$/.test(tok) && i === 0 && tokens.length > 2) {
        continue; // skip serial number
      }
      if (isDrawingCode(tok)) {
        drawingNo = tok.toUpperCase();
        dwgIndex = i;
        break;
      }
    }
  }

  if (!drawingNo) return null;

  // 2. Extract Delivery Date
  let deliveryDate = '';
  const dateMatch = line.match(DATE_REGEX);
  if (dateMatch) {
    deliveryDate = normalizeDate(dateMatch[1]) || dateMatch[1];
  }

  // 3. Extract Unit
  let unit = 'NOS';
  let unitIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].toUpperCase();
    if (UNIT_KEYWORDS.includes(t)) {
      unit = t;
      unitIdx = i;
      break;
    }
  }

  // 4. Extract HSN Code, Quantity, Rate, GST
  const numbers = [];
  tokens.forEach((t, idx) => {
    if (idx === dwgIndex || idx === unitIdx) return;
    if (idx === 0 && /^\d{1,3}\.?$/.test(t)) return; // skip row index

    const clean = t.replace(/,/g, '');
    if (/^-?\d+(?:\.\d+)?$/.test(clean)) {
      const val = parseFloat(clean);
      numbers.push({ val, idx, raw: t });
    }
  });

  let hsnCode = '';
  const hsnCandidate = numbers.find(n => /^\d{4,8}$/.test(n.raw) && n.val >= 1000 && n.idx > dwgIndex);
  if (hsnCandidate) {
    hsnCode = hsnCandidate.raw;
  }

  const nonHsnNumbers = numbers.filter(n => n !== hsnCandidate);

  let quantity = 1;
  let rate = 0;
  let cgstPercent = 9;
  let sgstPercent = 9;
  let igstPercent = 0;

  let qtyFound = false;
  // If unit was found, quantity is usually adjacent to unit (before or after)
  if (unitIdx > 0) {
    const prevNum = nonHsnNumbers.find(n => n.idx === unitIdx - 1);
    if (prevNum && prevNum.val > 0) {
      quantity = prevNum.val;
      qtyFound = true;
    }
  }

  const remainingAfterQty = nonHsnNumbers.filter(n => n.idx !== (unitIdx > 0 ? unitIdx - 1 : -1));
  if (!qtyFound && remainingAfterQty.length > 0) {
    quantity = remainingAfterQty[0].val;
    remainingAfterQty.shift();
  }

  if (remainingAfterQty.length > 0) {
    rate = remainingAfterQty[0].val;
    remainingAfterQty.shift();
  }

  // Look for GST percentages (typically 9, 9 or 18)
  if (remainingAfterQty.length >= 2 && remainingAfterQty[0].val <= 28 && remainingAfterQty[1].val <= 28) {
    cgstPercent = remainingAfterQty[0].val;
    sgstPercent = remainingAfterQty[1].val;
  } else if (remainingAfterQty.length === 1 && remainingAfterQty[0].val <= 28) {
    if (remainingAfterQty[0].val === 18) {
      cgstPercent = 9;
      sgstPercent = 9;
    } else {
      cgstPercent = remainingAfterQty[0].val / 2;
      sgstPercent = remainingAfterQty[0].val / 2;
    }
  }

  // 5. Extract Description: words between drawingNo and the next number/date
  let descTokens = [];
  for (let i = dwgIndex + 1; i < tokens.length; i++) {
    const tok = tokens[i];
    if (DATE_REGEX.test(tok)) break;
    if (UNIT_KEYWORDS.includes(tok.toUpperCase())) break;
    const cleanNum = tok.replace(/,/g, '');
    if (/^-?\d+(?:\.\d+)?$/.test(cleanNum)) {
      break;
    }
    descTokens.push(tok);
  }

  let description = cleanup(descTokens.join(' '));
  if (!description) {
    description = `Item ${drawingNo}`;
  }

  const cleanDwg = cleanup(drawingNo).toUpperCase();
  const isMatched = knownDrawingsSet.has(cleanDwg);

  return {
    drawingNo: cleanDwg,
    matched: isMatched,
    drawingNotFound: !isMatched,
    needsReview: !isMatched,
    description,
    hsnCode,
    quantity: quantity > 0 ? quantity : 1,
    unit,
    rate: rate > 0 ? rate : 0,
    cgstPercent,
    sgstPercent,
    igstPercent,
    deliveryDate,
    amount: rate > 0 ? (rate * (quantity > 0 ? quantity : 1)) : 0
  };
};

/**
 * Main parsePoPdf function
 */
const parsePoPdf = async (buffer, knownDrawings = []) => {
  if (!buffer) {
    return {};
  }

  try {
    const result = await pdfParse(buffer);
    const text = result.text || '';
    const sections = segmentPoSections(text);
    const scopeForHeaders = [sections.headerText, sections.footerText].filter(Boolean).join('\n') || text;
    const companyCode = detectCompany(scopeForHeaders);

    const knownDrawingsSet = new Set(
      (knownDrawings || []).map(d => String(d).trim().toUpperCase()).filter(Boolean)
    );

    // Extract Header Fields with specific regex
    const poNumber = extractField(scopeForHeaders, [
      /(?:Customer\s+)?Purchase\s+Order\s*(?:No\.?|Number|#)\s*[:\-.]?\s*([A-Za-z0-9\-\/]+)/i,
      /(?:Customer\s+)?Purchase\s+Order\s*[:\-.]\s*([A-Za-z0-9\-\/]+)/i,
      /P\.O\.\s*(?:No\.?|#)\s*[:\-.]?\s*([A-Za-z0-9\-\/]+)/i,
      /(?:PO|Order)\s*#\s*([A-Za-z0-9\-\/]+)/i,
      /(?:PO|Order)\s*No\.?\s*[:\-.]?\s*([A-Za-z0-9\-\/]+)/i,
      /(?:Customer\s+PO\s*(?:No\.?|Number|#)?)\s*[:\-.]?\s*([A-Za-z0-9\-\/]+)/i
    ]);

    const rawPoDate = extractField(scopeForHeaders, [
      /(?:PO|Order|Purchase\s*Order)?\s*Date\s*[:\-.]?\s*(\d{1,2}[-/.][A-Za-z0-9]{2,3}[-/.][0-9]{2,4}|\d{4}[-/.][0-9]{1,2}[-/.][0-9]{1,2})/i,
      /Date\s*[:\-.]?\s*(\d{1,2}[-/.][A-Za-z0-9]{2,3}[-/.][0-9]{2,4}|\d{4}[-/.][0-9]{1,2}[-/.][0-9]{1,2})/i
    ]);
    const poDate = normalizeDate(rawPoDate) || rawPoDate;

    const paymentTerms = extractField(scopeForHeaders, [
      /Payment\s*Terms\s*[:\-]?\s*([^\n\r]+)/i,
      /Terms\s*of\s*Payment\s*[:\-]?\s*([^\n\r]+)/i,
      /Terms\s*:\s*([^\n\r]+)/i
    ]);

    const customerGstin = extractField(sections.headerText, [
      /GSTIN(?:\s*No)?\s*[:\-]?\s*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})/i,
      /GSTIN(?:\s*No)?\s*[:\-]?\s*([A-Z0-9]+)/i
    ]);

    const companyName = extractField(sections.headerText, [
      /(SIDEL[\sA-Za-z0-9.&()\-]+)/i,
      /(PHOENIX[\sA-Za-z0-9.&()\-]+)/i,
      /(BOSSAR[\sA-Za-z0-9.&()\-]+)/i,
      /(?:Buyer|Customer|Company)\s*[:\-]?\s*([A-Za-z0-9.&()\- ]+)/i
    ]) || COMPANY_BY_CODE[companyCode]?.displayName || '';

    const billingAddress = extractAddressBlock(sections.headerText, ['Billing Address', 'Address', 'Customer Address']);

    // Consolidate wrapped table rows
    const consolidatedRows = consolidateTableRows(sections.tableLines, knownDrawingsSet);

    const parsedItems = [];
    const seenDrawings = new Set();

    for (const row of consolidatedRows) {
      const item = parseConsolidatedRow(row, knownDrawingsSet);
      if (item && item.drawingNo) {
        if (/^(CUSTOMER|PURCHASE|ORDER|PAYMENT|TERMS|DELIVERY|DATE|ITEM|HSN|QTY|RATE|UNIT|TOTAL|AMOUNT|SUBTOTAL)$/i.test(item.drawingNo)) {
          continue;
        }
        const itemKey = `${item.drawingNo}_${item.quantity}_${item.rate}`;
        if (!seenDrawings.has(itemKey)) {
          seenDrawings.add(itemKey);
          parsedItems.push(item);
        }
      }
    }

    return {
      companyCode,
      companyName,
      customerGstin,
      billingAddress,
      poNumber: poNumber || '',
      poDate: poDate || '',
      paymentTerms,
      creditDays: deriveCreditDays(paymentTerms),
      freightTerms: extractField(scopeForHeaders, [/Freight(?:\s*Terms)?\s*[:\-]?\s*(.+)/i]),
      packingForwarding: extractField(scopeForHeaders, [/Packing(?:\s*&\s*Forwarding)?\s*[:\-]?\s*(.+)/i]),
      insuranceTerms: extractField(scopeForHeaders, [/Insurance\s*[:\-]?\s*(.+)/i]),
      currency: extractField(sections.headerText, [/Currency\s*[:\-]?\s*(\w+)/i]) || 'INR',
      deliveryTerms: extractField(scopeForHeaders, [/Delivery\s*Terms\s*[:\-]?\s*(.+)/i]),
      remarks: extractField(scopeForHeaders, [/Remarks\s*[:\-]?\s*(.+)/i]),
      plant: extractField(scopeForHeaders, [/Plant\s*[:\-]?\s*(.+)/i]),
      orderType: extractField(scopeForHeaders, [/Order\s*Type\s*[:\-]?\s*(.+)/i]),
      items: parsedItems
    };
  } catch (error) {
    console.error('PDF parse error:', error.message);
    return {
      header: {},
      items: []
    };
  }
};

module.exports = parsePoPdf;
