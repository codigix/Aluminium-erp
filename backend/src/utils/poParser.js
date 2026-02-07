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
      const parser = new pdfParseClass({ data: buffer });
      try {
        const result = await parser.getText();
        return result || {};
      } finally {
        if (typeof parser.destroy === 'function') {
          try {
            await parser.destroy();
          } catch {}
        }
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
  const normalized = String(value).replace(/[^0-9.-]/g, '');
  return normalized ? Number(normalized) : 0;
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
  if (/^\d{2}-\d{2}-\d{4}$/.test(cleaned)) {
    const [dd, mm, yyyy] = cleaned.split('-');
    return `${yyyy}-${mm}-${dd}`;
  }
  if (/^\d{2}-\d{2}-\d{2}$/.test(cleaned)) {
    const [dd, mm, yy] = cleaned.split('-');
    const year = Number(yy) + 2000;
    return `${year}-${mm}-${dd}`;
  }
  const match = cleaned.match(/^(\d{2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (match) {
    const [, dd, mon, yy] = match;
    const month = MONTHS[mon.toUpperCase()] || '01';
    const year = yy.length === 2 ? Number(yy) + 2000 : Number(yy);
    return `${year}-${month}-${dd}`;
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

const segmentPoSections = text => {
  if (!text) {
    return {
      headerText: '',
      tableLines: [],
      footerText: '',
      tableText: ''
    };
  }
  const lines = text.split(/\r?\n/);
  const headerIndex = lines.findIndex(line => {
    const normalized = line.toLowerCase();
    return (
      (normalized.includes('item') && normalized.includes('description')) ||
      (normalized.includes('material') && normalized.includes('qty'))
    );
  });
  if (headerIndex === -1) {
    return {
      headerText: text,
      tableLines: [],
      footerText: '',
      tableText: ''
    };
  }
  let tableEnd = lines.length;
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim().toLowerCase();
    if (!trimmed) {
      continue;
    }
    if (
      trimmed.includes('subtotal') ||
      trimmed.includes('total value') ||
      trimmed.includes('grand total') ||
      trimmed.includes('amount payable') ||
      trimmed.includes('terms & conditions') ||
      trimmed.includes('terms and conditions') ||
      trimmed.includes('remarks')
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

const ROW_STOP_PATTERNS = [
  /subtotal/i,
  /total\s*/i,
  /grand\s*total/i,
  /amount\s*payable/i,
  /authorized/i,
  /terms\s*&?\s*conditions/i,
  /remarks/i
];

const ROW_IGNORE_PATTERNS = [
  /gstin/i,
  /cin/i,
  /telephone/i,
  /mobile/i,
  /phone/i,
  /fax/i,
  /email/i,
  /website/i,
  /address/i,
  /pincode/i,
  /district/i,
  /state/i,
  /india/i,
  /item\s*code/i,
  /material\s*code/i,
  /description/i,
  /qty/i,
  /quantity/i,
  /rate/i,
  /unit/i,
  /hsn/i
];

const DATE_ONLY_PATTERN = /^\d{1,2}\s*[-/]\s*[A-Za-z]{3}\s*[-/]\s*\d{2,4}$/i;

const sanitizeTableLines = lines => {
  const sanitized = [];
  for (const raw of lines) {
    const trimmed = (raw || '').trim();
    if (!trimmed) {
      continue;
    }
    if (DATE_ONLY_PATTERN.test(trimmed)) {
      continue;
    }
    if (ROW_STOP_PATTERNS.some(pattern => pattern.test(trimmed))) {
      break;
    }
    if (ROW_IGNORE_PATTERNS.some(pattern => pattern.test(trimmed))) {
      continue;
    }
    if (/^[=\-_.\s]+$/.test(trimmed)) {
      continue;
    }
    sanitized.push(raw);
  }
  return sanitized;
};

const chunkTableRows = lines => {
  const rows = [];
  for (const raw of lines) {
    const line = raw.replace(/\r/g, '');
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const hasColumns = /\s{2,}/.test(line);
    const startsWithToken = /^[A-Za-z0-9]/.test(trimmed);
    if (hasColumns && startsWithToken) {
      rows.push(line);
      continue;
    }
    if (rows.length) {
      rows[rows.length - 1] = `${rows[rows.length - 1]} ${trimmed}`.trim();
    }
  }
  return rows;
};

const parseSidelLineItems = lines => {
  if (!Array.isArray(lines) || !lines.length) {
    return [];
  }
  const items = [];
  let pendingDescription = '';
  for (const raw of lines) {
    const line = (raw || '').replace(/\s+/g, ' ').trim();
    if (!line) {
      continue;
    }
    const lower = line.toLowerCase();
    if (lower.includes('total value') || lower.includes('grand total') || lower.includes('amount payable')) {
      break;
    }
    if (lower.includes('gst')) {
      continue;
    }
    if (DATE_ONLY_PATTERN.test(line)) {
      continue;
    }
    const codeMatch = line.match(/^(\d{6,})(?:\s+)(.+)$/);
    if (!codeMatch) {
      if (/[A-Za-z]/.test(line)) {
        pendingDescription = cleanup(line);
      }
      continue;
    }
    const [, code, rest] = codeMatch;
    const tokens = rest.split(/\s+/).filter(Boolean);
    if (!tokens.length) {
      continue;
    }
    let qty = 0;
    let unit = 'NOS';
    let rate = 0;
    let qtyIndex = -1;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const next = tokens[i + 1] || '';
      if (/^-?[\d,.]+$/.test(token) && UNIT_KEYWORDS.includes(next.toUpperCase())) {
        qty = toNumber(token);
        unit = next.toUpperCase();
        qtyIndex = i;
        break;
      }
    }
    if (qtyIndex === -1) {
      const fallbackQtyIndex = tokens.findIndex(token => /^-?[\d,.]+$/.test(token));
      if (fallbackQtyIndex > -1) {
        qty = toNumber(tokens[fallbackQtyIndex]);
        qtyIndex = fallbackQtyIndex;
      }
    }
    let rateIndex = qtyIndex > -1 ? qtyIndex + 2 : -1;
    if (rateIndex < 0 || rateIndex >= tokens.length) {
      const numericAfterQty = tokens.slice(qtyIndex + 1).find(token => /^-?[\d,.]+$/.test(token));
      if (numericAfterQty) {
        rate = toNumber(numericAfterQty);
      }
    } else {
      rate = toNumber(tokens[rateIndex]);
    }
    const rawDescriptionTokens = qtyIndex > 0 ? tokens.slice(0, qtyIndex) : [];
    let description = cleanup(rawDescriptionTokens.join(' '));
    if (!description || /^[-\d.,]+$/.test(description)) {
      description = pendingDescription || `Item ${code}`;
    }
    pendingDescription = '';
    items.push({
      drawingNo: cleanup(code),
      description,
      quantity: qty || 1,
      unit,
      rate,
      cgstPercent: 0,
      sgstPercent: 0,
      igstPercent: 0,
      deliveryDate: ''
    });
  }
  return items;
};

const COMPANY_LINE_ITEM_PARSERS = {
  SIDEL: parseSidelLineItems
};

const mapRowToItem = (row, index) => {
  const parts = row.split(/\s{2,}/).map(cleanup).filter(Boolean);
  if (parts.length < 3) {
    return null;
  }
  const numericIndices = parts
    .map((value, idx) => ({ value: value.replace(/,/g, ''), idx }))
    .filter(entry => /^-?\d+(?:\.\d+)?$/.test(entry.value));
  const unitIndex = parts.findIndex(part => UNIT_KEYWORDS.includes(part.toUpperCase()));
  let qtyIndex = unitIndex > 0 ? unitIndex - 1 : -1;
  let rateIndex = unitIndex > -1 ? unitIndex + 1 : -1;
  if (qtyIndex <= 0 && numericIndices.length) {
    qtyIndex = numericIndices[0].idx;
  }
  if ((rateIndex <= 0 || rateIndex === qtyIndex) && numericIndices.length > 1) {
    rateIndex = numericIndices[1].idx;
  }
  if (qtyIndex <= 0 && parts.length >= 3) {
    qtyIndex = parts.length - 2;
  }
  if ((rateIndex <= 0 || rateIndex === qtyIndex) && parts.length >= 2) {
    rateIndex = parts.length - 1;
  }
  let descEnd = qtyIndex > 0 ? qtyIndex : parts.length;
  if (unitIndex > 0 && unitIndex < descEnd) {
    descEnd = unitIndex;
  }
  if (descEnd <= 1) {
    descEnd = parts.length > 3 ? parts.length - 2 : 2;
  }
  const descriptionParts = parts.slice(1, descEnd).filter(Boolean);
  const description = cleanup(descriptionParts.join(' ')) || cleanup(parts[1]);
  if (!description || /^(?:gstin|cin|address)/i.test(description)) {
    return null;
  }
  const quantity = qtyIndex > -1 ? toNumber(parts[qtyIndex]) : 1;
  const rate = rateIndex > -1 ? toNumber(parts[rateIndex]) : 0;
  const cgstPercent = rateIndex + 1 < parts.length ? toNumber(parts[rateIndex + 1]) : 0;
  const sgstPercent = rateIndex + 2 < parts.length ? toNumber(parts[rateIndex + 2]) : 0;
  const igstPercent = rateIndex + 3 < parts.length ? toNumber(parts[rateIndex + 3]) : 0;
  const unit = unitIndex > -1 ? parts[unitIndex] : 'NOS';
  return {
    drawingNo: cleanup(parts[0]) || `DRW-${index + 1}`,
    description,
    quantity: quantity || 1,
    unit,
    rate,
    cgstPercent,
    sgstPercent,
    igstPercent,
    deliveryDate: ''
  };
};

const parseTableRows = lines => {
  if (!Array.isArray(lines) || !lines.length) {
    return [];
  }
  const sanitized = sanitizeTableLines(lines);
  if (!sanitized.length) {
    return [];
  }
  const rows = chunkTableRows(sanitized);
  return rows
    .map((row, index) => mapRowToItem(row, index))
    .filter(Boolean);
};

const parseStructuredItems = text => {
  const items = [];
  const regex = /(\d{6,})\s+([A-Za-z0-9,\-\/(). ]+?)\s+(\d{2}[-\/][A-Za-z0-9]{3}[-\/]\d{2,4}|\d{2}[-\/]\d{2}[-\/]\d{2,4})\s+([\d,]+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(PCS|PC|NOS|EA|SET|UNIT|KG|LTR|MTR|PACK|PAIR)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)/gi;
  let match;
  while ((match = regex.exec(text))) {
    const [, code, desc, delivery, rate, qty, unit, cgst, sgst, amount] = match;
    items.push({
      drawingNo: cleanup(code),
      description: cleanup(desc),
      quantity: toNumber(qty) || 1,
      unit: cleanup(unit),
      rate: toNumber(rate),
      cgstPercent: toNumber(cgst),
      sgstPercent: toNumber(sgst),
      igstPercent: 0,
      deliveryDate: normalizeDate(delivery) || cleanup(delivery),
      amount: toNumber(amount)
    });
  }
  return items;
};

const parseFallbackItems = text => {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const candidates = lines.filter(line => /\d{4,}/.test(line));
  const source = candidates.length ? candidates : lines;
  return source.slice(0, 5).map((line, index) => {
    const tokens = line.split(/\s+/);
    const code = tokens.shift();
    return {
      drawingNo: cleanup(code) || `DRW-${index + 1}`,
      description: cleanup(tokens.join(' ')) || cleanup(line),
      quantity: 1,
      unit: 'NOS',
      rate: 0,
      cgstPercent: 0,
      sgstPercent: 0,
      igstPercent: 0,
      deliveryDate: ''
    };
  });
};

const parseLineItems = (companyCode, tableLines, fallbackText) => {
  const tableText = (tableLines || []).join('\n');
  const structured = parseStructuredItems(tableText);
  if (structured.length) {
    return structured;
  }
  const sanitizedLines = sanitizeTableLines(tableLines || []);
  const parser = COMPANY_LINE_ITEM_PARSERS[companyCode];
  if (typeof parser === 'function') {
    const companyItems = parser(sanitizedLines);
    if (companyItems.length) {
      return companyItems;
    }
  }
  const tableItems = parseTableRows(sanitizedLines);
  if (tableItems.length) {
    return tableItems;
  }
  return parseFallbackItems(tableText || fallbackText || '');
};

const parsePoPdf = async buffer => {
  if (!buffer) {
    return {};
  }
  try {
    const result = await pdfParse(buffer);
    const text = result.text || '';
    const sections = segmentPoSections(text);
    const scopeForHeaders = [sections.headerText, sections.footerText].filter(Boolean).join('\n') || text;
    const companyCode = detectCompany(scopeForHeaders);
    const paymentTerms = extractField(scopeForHeaders, [/Payment\s*Terms\s*[:\-]?\s*(.+)/i, /Terms\s*:\s*(.+)/i]);
    const response = {
      companyCode,
      companyName:
        extractField(sections.headerText, [
          /(SIDEL[\sA-Za-z0-9.&()\-]+)/i,
          /(PHOENIX[\sA-Za-z0-9.&()\-]+)/i,
          /(BOSSAR[\sA-Za-z0-9.&()\-]+)/i,
          /(?:Buyer|Customer|Company|Supplier)\s*[:\-]?\s*(.+)/i
        ]) || COMPANY_BY_CODE[companyCode]?.displayName || '',
      customerGstin: extractField(sections.headerText, [/GSTIN(?:\s*No)?\s*[:\-]?\s*([A-Z0-9]+)/i]),
      billingAddress: extractAddressBlock(sections.headerText, ['Billing Address', 'Address']),
      poNumber: extractField(scopeForHeaders, [/Purchase\s*Order\s*(?:No|Number)\s*[:\-]?\s*(.+)/i, /PO\s*(?:No|Number)\s*[:\-]?\s*(.+)/i]),
      poDate: normalizeDate(extractField(scopeForHeaders, [/PO\s*Date\s*[:\-]?\s*(.+)/i])) || extractField(scopeForHeaders, [/PO\s*Date\s*[:\-]?\s*(.+)/i]),
      paymentTerms,
      creditDays: deriveCreditDays(paymentTerms),
      freightTerms: extractField(scopeForHeaders, [/Freight(?:\s*Terms)?\s*[:\-]?\s*(.+)/i, /Freight\s*[:\-]?\s*(.+)/i]),
      packingForwarding: extractField(scopeForHeaders, [/Packing(?:\s*&\s*Forwarding)?\s*[:\-]?\s*(.+)/i, /P\s*&\s*F\s*[:\-]?\s*(.+)/i]),
      insuranceTerms: extractField(scopeForHeaders, [/Insurance\s*[:\-]?\s*(.+)/i]),
      currency: extractField(sections.headerText, [/Currency\s*[:\-]?\s*(\w+)/i]) || 'INR',
      deliveryTerms: extractField(scopeForHeaders, [/Delivery\s*Terms\s*[:\-]?\s*(.+)/i, /Delivery\s*[:\-]?\s*(.+)/i]),
      remarks: extractField(scopeForHeaders, [/Remarks\s*[:\-]?\s*(.+)/i]),
      plant: extractField(scopeForHeaders, [/Plant\s*[:\-]?\s*(.+)/i]),
      orderType: extractField(scopeForHeaders, [/Order\s*Type\s*[:\-]?\s*(.+)/i]),
      items: parseLineItems(companyCode, sections.tableLines, text)
    };
    return response;
  } catch (error) {
    console.error('PDF parse error', error.message);
    return {};
  }
};

module.exports = parsePoPdf;
