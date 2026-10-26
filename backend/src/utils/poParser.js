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

const isHsnCode = (str) => {
  if (!str) return false;
  const clean = str.replace(/[^0-9]/g, '');
  if (clean.length < 4 || clean.length > 8) return false;
  const HSN_PREFIXES = ['84', '73', '85', '76', '39', '82', '83', '40', '90', '99', '72', '74', '75'];
  return HSN_PREFIXES.some(prefix => clean.startsWith(prefix));
};

const isRowIndex = (str) => {
  return /^\d{1,4}\.?$/.test(str.trim());
};

const isDrawingCandidate = (str, knownDrawingsSet = new Set()) => {
  if (!str || typeof str !== 'string') return false;
  const clean = str.replace(/[:,\(\)\*]/g, '').trim().toUpperCase();
  if (clean.length < 3 || clean.length > 35) return false;

  // Direct match in known drawing set
  if (knownDrawingsSet.has(clean)) return true;

  // Reject standard keywords
  if (/^(ITEM|POS|SR|NO|CODE|HSN|QTY|DATE|UNIT|RATE|INR|USD|EUR|NOS|PCS|PURCHASE|ORDER|CUSTOMER|PAYMENT|TERMS|TOTAL|DESCRIPTION|AMOUNT|DELIVERY|SL|SUBTOTAL|TAX|CGST|SGST|IGST|PLANT|REV|REVISION|DISCOUNT|PRICE|BAL|BALNCE|DISPATCH)$/i.test(clean)) {
    return false;
  }

  // Reject pure dates
  if (/^\d{1,2}[-/.][A-Za-z0-9]{2,3}[-/.][0-9]{2,4}$/.test(clean) || /^\d{4}[-/.][0-9]{1,2}[-/.][0-9]{1,2}$/.test(clean)) {
    return false;
  }

  // Reject HSN codes
  if (isHsnCode(clean)) return false;

  // Reject decimal amounts/rates
  if (/^-?\d+\.\d+$/.test(clean)) return false;

  // Reject small row indexes / quantities
  if (/^\d{1,4}$/.test(clean)) return false;

  // Format check:
  // 1. Numeric drawing numbers with 9-14 digits (e.g. Sidel 09000693103, 90018114033, 04328000901)
  if (/^\d{9,14}$/.test(clean)) return true;

  // 2. Alphanumeric drawing codes (e.g. 09528RBC37A, Y31700, AL-100, 1BZ7020011, 8263151/001)
  const hasDigit = /\d/.test(clean);
  const hasLetter = /[A-Z]/.test(clean);
  const hasSeparator = /[-_/.]/.test(clean);
  if (/^[A-Z0-9][A-Z0-9\-_./]*[A-Z0-9]$/.test(clean) && (hasDigit || hasSeparator) && (hasLetter || hasSeparator || clean.length >= 6)) {
    return true;
  }

  return false;
};

// Pattern for a drawing number: e.g. Y31700, Y2027, TEST-DRW-99999, DRW-001, 520001, AL-100
const isDrawingCode = (str, knownDrawingsSet = new Set()) => {
  return isDrawingCandidate(str, knownDrawingsSet);
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

const STOP_WORDS = new Set([
  'ITEM', 'POS', 'SR', 'NO', 'CODE', 'HSN', 'QTY', 'DATE', 'UNIT', 'RATE',
  'INR', 'USD', 'EUR', 'NOS', 'PCS', 'PURCHASE', 'ORDER', 'CUSTOMER', 'PAYMENT',
  'TERMS', 'TOTAL', 'DESCRIPTION', 'AMOUNT', 'DELIVERY', 'SL', 'SUBTOTAL', 'TAX',
  'CGST', 'SGST', 'IGST', 'PLANT', 'REV', 'REVISION', 'DISCOUNT', 'PRICE',
  'CAVITY', 'X', 'DAYS', 'PAGE', 'OF', 'BAL', 'BALANCE', 'DISPATCH', 'STANDARD'
]);

const IGNORE_DESC_PATTERNS = [
  /cin\s*no/i, /gstin\b/i, /telephone/i, /mobile/i, /phone\b/i, /fax\b/i, /email\b/i, /website/i, /pincode/i,
  /page\s*\d+/i, /--\s*\d+/i, /vendor\s*code/i, /purchase\s*order/i, /order\s*type/i, /plant\s*:/i,
  /payment\s*:/i, /freight\s*:/i, /insurance\s*:/i, /p\s*&\s*f\s*:/i, /delivery\s*date/i,
  /our\s*ref/i, /your\s*ref/i, /purchase\s*term/i, /terms\b/i, /sl\s*no/i, /item\s*no/i, /item\s*description/i,
  /despatch\s*address/i, /created\s*by/i, /sidel\b/i, /plot\s*no/i, /mahalunge/i, /pune/i, /industries/i,
  /near\s*masal/i, /midc\b/i, /bhosari/i, /%\s*cgst/i, /sgst/i, /^\d{4}-\d{2}-\d{2}$/, /^\d{2}-\d{2}-\d{4}$/,
  /old\s*material/i, /version\s*no/i, /header\s*text/i, /po\s*date/i, /^\s*in\s*$/i
];

/**
 * Extract rich line items and Drawing Numbers from table rows
 * Extracts Qty, Rate, HSN, Delivery Date, Pur.Req No, and Unit for each row individually
 */
const extractTableLineItems = (text, knownDrawingsSet = new Set()) => {
  const lines = text.split(/\r?\n/);
  let inTable = false;
  let currentSlNo = 0;
  const items = [];
  const drawingNumbers = [];
  let currentItem = null;

  // Builds the drawing description from the PDF lines of one item. The PDF repeats the name: first as
  // the table cell (cut short with a trailing '@') and again in full, and long technical specification
  // text and split-off rate/date rows can follow it. Only the item's own name is kept, without duplicates.
  const norm = (s) => s.replace(/[@\s]/g, '').toUpperCase();
  const buildDescription = (descLines) => {
    const parts = [];
    descLines
      .map(l => l.trim())
      .filter(l => l
        && !IGNORE_DESC_PATTERNS.some(p => p.test(l))
        && !/^(freight|p\s*&\s*f|insurance)\b/i.test(l)
        && !/^\d{1,2}-[A-Za-z]{3}-\d{2}\b/.test(l)
        && !/^(?:(?:PC|PCS|NOS|EA|SET|UNIT|KG|MTR|ROLL|LOT)\s+)?[\d.,%:\s\t-]+$/i.test(l)
        && l.length <= 90)
      .forEach(raw => {
        const line = raw.replace(/@\s*$/, '').replace(/[§]/g, '').replace(/\s+/g, ' ').trim();
        if (!line) return;
        const acc = parts.join(' ');
        if (acc && norm(line).startsWith(norm(acc))) {
          // full text of what was cut off earlier replaces the short version
          parts.length = 0;
          parts.push(line);
        } else if (acc && norm(acc).includes(norm(line))) {
          // exact repeat of text already collected
        } else {
          parts.push(line);
        }
      });
    return parts.reduce((text, part) => (text.endsWith('-') ? `${text}${part}` : `${text} ${part}`.trim()), '');
  };

  const finalizeItem = () => {
    if (!currentItem) return;
    // No default text is invented here; an empty description is filled from the drawing master later
    currentItem.description = buildDescription(currentItem.descLines || []);
    delete currentItem.descLines;
    items.push(currentItem);
    currentItem = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) continue;

    // Detect table headers
    if (/^(?:SL\.?\s*No|Item\s*No)/i.test(line) || /Item\s*Description.*HSN/i.test(line)) {
      inTable = true;
      continue;
    }

    // Detect table stops / page breaks
    if (
      /^--\s*\d+\s*of\s*\d+\s*--/i.test(line) ||
      /^Page\s*\d+\s*of\s*\d+/i.test(line) ||
      /^(?:subtotal|total\s*value|grand\s*total|amount\s*payable|special\s*instructions)/i.test(line)
    ) {
      if (/^(?:subtotal|total\s*value|grand\s*total|amount\s*payable|special\s*instructions)/i.test(line)) {
        inTable = false;
      }
      continue;
    }

    if (!inTable) continue;

    // Table Row Match: Starts strictly with SL No followed by Item No.
    // E.g. '10 \t09000693103' or '1 00Y316W'
    const slMatch = line.match(/^(\d{1,5})[\t\s]+([A-Za-z0-9\-_./]+)/);
    if (slMatch) {
      const sl = parseInt(slMatch[1], 10);
      const rawItem = slMatch[2].replace(/[^A-Za-z0-9\-_./]/g, '').toUpperCase();
      const isSlProgression = sl > currentSlNo || (sl === 1 && currentSlNo > 5);

      if (
        isSlProgression &&
        rawItem.length >= 3 &&
        rawItem.length <= 35 &&
        !STOP_WORDS.has(rawItem) &&
        !/^\d{1,2}[-/.][A-Za-z0-9]{2,3}[-/.][0-9]{2,4}$/.test(rawItem) &&
        !/^\d{4}[-/.][0-9]{1,2}[-/.][0-9]{1,2}$/.test(rawItem) &&
        !/^-?\d+\.\d+$/.test(rawItem) &&
        !/^(84|73|85|76|39)\d{6}$/.test(rawItem)
      ) {
        finalizeItem();
        currentSlNo = sl;
        drawingNumbers.push(rawItem);
        currentItem = {
          slNo: sl,
          drawingNo: rawItem,
          description: '',
          hsnCode: '',
          deliveryDate: '',
          purchaseReqNo: '',
          rate: 0,
          quantity: 1,
          unit: 'NOS',
          cgstPercent: 9,
          sgstPercent: 9,
          descLines: []
        };
        continue;
      }
    }

    // Fallback: If table has no SL column, check if line starts directly with a known drawing from Drawing Master
    if (!currentItem) {
      const tokens = line.split(/\s+/).filter(Boolean);
      if (tokens.length > 0) {
        const firstTok = tokens[0].replace(/[^A-Za-z0-9\-_./]/g, '').toUpperCase();
        if (knownDrawingsSet.has(firstTok)) {
          drawingNumbers.push(firstTok);
          currentItem = {
            slNo: items.length + 1,
            drawingNo: firstTok,
            description: '',
            hsnCode: '',
            deliveryDate: '',
            purchaseReqNo: '',
            rate: 0,
            quantity: 1,
            unit: 'NOS',
            cgstPercent: 9,
            sgstPercent: 9,
            descLines: []
          };
          continue;
        }
      }
    }

    if (currentItem) {
      const tokens = line.split(/[\t\s]+/).filter(Boolean);
      const unitIdx = tokens.findIndex(t => /^(PC|PCS|NOS|EA|SET|UNIT|KG|MTR|ROLL|LOT)$/i.test(t));
      const hasDate = DATE_REGEX.test(line);

      if (unitIdx > 0 && (hasDate || tokens.length >= 5)) {
        currentItem.unit = tokens[unitIdx].toUpperCase();
        const rawQty = parseFloat(tokens[unitIdx - 1]);
        if (!isNaN(rawQty) && rawQty > 0) {
          currentItem.quantity = rawQty;
        }

        if (unitIdx >= 2) {
          const rawRate = parseFloat(tokens[unitIdx - 2]);
          if (!isNaN(rawRate) && rawRate >= 0) {
            currentItem.rate = rawRate;
          }
        }

        if (unitIdx >= 3 && /^\d{7,12}$/.test(tokens[unitIdx - 3])) {
          currentItem.purchaseReqNo = tokens[unitIdx - 3];
        }

        const dateMatch = line.match(DATE_REGEX);
        if (dateMatch) {
          currentItem.deliveryDate = normalizeDate(dateMatch[1]) || dateMatch[1];
        }

        const hsnToken = tokens.find(t => isHsnCode(t));
        if (hsnToken) {
          currentItem.hsnCode = hsnToken.replace(/[^0-9]/g, '');
        }

        if (tokens.length > unitIdx + 4) {
          const tax1 = parseFloat(tokens[unitIdx + 4]);
          if (!isNaN(tax1)) currentItem.cgstPercent = tax1;
        }
        if (tokens.length > unitIdx + 6) {
          const tax2 = parseFloat(tokens[unitIdx + 6]);
          if (!isNaN(tax2)) currentItem.sgstPercent = tax2;
        }
      } else if (!line.toLowerCase().includes('old material')) {
        currentItem.descLines.push(line);
      }
    }
  }

  finalizeItem();
  return { drawingNumbers, items };
};

/**
 * Main parsePoPdf function
 */
const parsePoPdf = async (buffer, knownDrawings = []) => {
  if (!buffer) {
    return { header: {}, drawingNumbers: [], items: [] };
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

    // Extract Header Fields from first page lines
    const lines = text.split(/\r?\n/);
    const headerScopeLines = lines.slice(0, 70);

    let poNumber = '';
    let poDate = '';
    let paymentTerms = '';
    let freightTerms = '';
    let insuranceTerms = '';
    let packingForwarding = '';
    let plant = '';
    let orderType = '';
    let deliveryTerms = '';
    let customerGstin = '';

    for (const raw of headerScopeLines) {
      const l = raw.trim();
      if (!l) continue;

      if (!poNumber) {
        const m = l.match(/^([A-Za-z0-9\-_]+)[\t\s]+Purchase\s+Order\s*(?:No\.?|Number|#)?/i)
          || l.match(/(?:Purchase\s+Order\s*(?:No\.?|Number|#)?)\s*[:\-.]?\s*([A-Za-z0-9\-_]+)/i)
          || l.match(/P\.O\.\s*(?:No\.?|#)\s*[:\-.]?\s*([A-Za-z0-9\-_]+)/i)
          || l.match(/(?:PO|Order)\s*(?:No\.?|#)\s*[:\-.]?\s*([A-Za-z0-9\-_]+)/i);
        if (m && !/^\d{2}-\d{2}-\d{4}$/.test(m[1]) && !/^Date$/i.test(m[1]) && !/^No$/i.test(m[1])) {
          poNumber = cleanup(m[1]);
        }
      }

      if (!poDate) {
        const m = l.match(/^(\d{1,2}[-/.][A-Za-z0-9]{2,3}[-/.][0-9]{2,4}|\d{4}[-/.][0-9]{1,2}[-/.][0-9]{1,2})[\t\s]+PO\s*Date/i)
          || l.match(/(?:PO|Purchase\s+Order)?\s*Date\s*[:\-.]?\s*(\d{1,2}[-/.][A-Za-z0-9]{2,3}[-/.][0-9]{2,4}|\d{4}[-/.][0-9]{1,2}[-/.][0-9]{1,2})/i);
        if (m) {
          const norm = normalizeDate(m[1]);
          if (norm) poDate = norm;
        }
      }

      if (!paymentTerms) {
        const m = l.match(/^([^\t\r\n:]+)[\t\s]+Payment\s*:/i)
          || l.match(/Payment\s*(?:Terms)?\s*[:\-]\s*([^\t\r\n]+)/i);
        if (m) paymentTerms = cleanup(m[1]);
      }

      if (!freightTerms) {
        const m = l.match(/^([^\t\r\n:]+)[\t\s]+Freight\s*:/i)
          || l.match(/Freight\s*(?:Terms)?\s*[:\-]\s*([^\t\r\n]+)/i);
        if (m) freightTerms = cleanup(m[1]);
      }

      if (!insuranceTerms) {
        const m = l.match(/^([^\t\r\n:]+)[\t\s]+Insurance\s*:/i)
          || l.match(/Insurance\s*(?:Terms)?\s*[:\-]\s*([^\t\r\n]+)/i);
        if (m) insuranceTerms = cleanup(m[1]);
      }

      if (!packingForwarding) {
        const m = l.match(/^([^\t\r\n:]+)[\t\s]+P\s*&\s*F\s*:/i)
          || l.match(/Packing(?:\s*&\s*Forwarding)?\s*[:\-]\s*([^\t\r\n]+)/i);
        if (m) packingForwarding = cleanup(m[1]);
      }

      if (!plant) {
        const m = l.match(/^([A-Za-z0-9]+)[\t\s]+Plant\s*:/i)
          || l.match(/Plant\s*[:\-]\s*([A-Za-z0-9]+)/i);
        if (m) plant = cleanup(m[1]);
      }

      if (!orderType) {
        const m = l.match(/^([^\t\r\n:]+)[\t\s]+Order\s*Type\s*:/i)
          || l.match(/Order\s*Type\s*[:\-]\s*([^\t\r\n]+)/i);
        if (m) orderType = cleanup(m[1]);
      }

      if (!deliveryTerms) {
        const m = l.match(/^([^\t\r\n:]+)[\t\s]+Delivery\s*Date\s*:/i)
          || l.match(/Delivery\s*(?:Date|Terms)?\s*[:\-]\s*([^\t\r\n]+)/i);
        if (m) deliveryTerms = cleanup(m[1]);
      }

      if (!customerGstin) {
        const m = l.match(/GSTIN(?:\s*NO\.?)?\s*[:\-]?\s*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})/i);
        if (m) customerGstin = m[1];
      }
    }

    const companyName = extractField(sections.headerText, [
      /(SIDEL[\sA-Za-z0-9.&()\-]+)/i,
      /(PHOENIX[\sA-Za-z0-9.&()\-]+)/i,
      /(BOSSAR[\sA-Za-z0-9.&()\-]+)/i,
      /(?:Buyer|Customer|Company)\s*[:\-]?\s*([A-Za-z0-9.&()\- ]+)/i
    ]) || COMPANY_BY_CODE[companyCode]?.displayName || '';

    const billingAddress = extractAddressBlock(sections.headerText, ['Billing Address', 'Address', 'Customer Address', 'Despatch Address']);

    // Extract Drawing Numbers and rich Line Items strictly from Item No table column
    const { drawingNumbers, items } = extractTableLineItems(text, knownDrawingsSet);

    return {
      companyCode,
      companyName,
      customerGstin,
      billingAddress,
      poNumber: poNumber || '',
      poDate: poDate || '',
      paymentTerms,
      creditDays: deriveCreditDays(paymentTerms),
      freightTerms: freightTerms || extractField(scopeForHeaders, [/Freight(?:\s*Terms)?\s*[:\-]?\s*(.+)/i]),
      packingForwarding: packingForwarding || extractField(scopeForHeaders, [/Packing(?:\s*&\s*Forwarding)?\s*[:\-]?\s*(.+)/i]),
      insuranceTerms: insuranceTerms || extractField(scopeForHeaders, [/Insurance\s*[:\-]?\s*(.+)/i]),
      currency: extractField(sections.headerText, [/Currency\s*[:\-]?\s*(\w+)/i]) || 'INR',
      deliveryTerms: deliveryTerms || extractField(scopeForHeaders, [/Delivery\s*Terms\s*[:\-]?\s*(.+)/i]),
      remarks: extractField(scopeForHeaders, [/Remarks\s*[:\-]?\s*(.+)/i]),
      plant: plant || extractField(scopeForHeaders, [/Plant\s*[:\-]?\s*(.+)/i]),
      orderType: orderType || extractField(scopeForHeaders, [/Order\s*Type\s*[:\-]?\s*(.+)/i]),
      drawingNumbers,
      items
    };
  } catch (error) {
    console.error('PDF parse error:', error.message);
    return {
      header: {},
      drawingNumbers: [],
      items: []
    };
  }
};

module.exports = parsePoPdf;

