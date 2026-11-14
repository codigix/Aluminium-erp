// Delivery Challan (paper-form layout) for an outward sub-contract challan.
// System values come from the outward challan / job card; user edits are kept in
// delivery_challan_details (print only — outward challan, job card and stock are never changed).
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const mustache = require('mustache');
const pool = require('../config/db');

// A4 (297mm) minus 10mm top + 10mm bottom margin, in CSS px (96 dpi), with a small safety gap
const PAGE_CONTENT_HEIGHT_PX = Math.floor((277 * 96) / 25.4) - 6;
const MAX_LINES = 50;

const toYmd = (v) => {
  if (!v) return '';
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
};

const formatDate = (v) => {
  const ymd = toYmd(v);
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
};

const fmtQty = (v) => {
  const n = parseFloat(v || 0);
  if (!Number.isFinite(n)) return '';
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
};

const clean = (v, max) => {
  if (v === undefined || v === null) return '';
  return String(v).trim().slice(0, max);
};

// D. Ch. No. shown on the print — derived from the challan id (no new number series stored)
const deliveryChallanNo = (challan) => `SPTPL-${String(challan.id).padStart(4, '0')}`;

const loadChallan = async (id) => {
  const [challans] = await pool.query(
    `SELECT oc.*, v.vendor_name, v.vendor_code, v.location AS vendor_location, v.phone AS vendor_phone,
            v.gstin AS vendor_gstin, jc.job_card_no, wo.wo_number, wo.plan_id AS wo_plan_id,
            wo.item_code AS wo_item_code, wo.item_name AS wo_item_name,
            cp.po_number AS customer_po_number, cp.po_date AS customer_po_date,
            so.host_company_id AS so_company_id, cp.host_company_id AS cpo_company_id
     FROM outward_challans oc
     JOIN vendors v ON oc.vendor_id = v.id
     LEFT JOIN job_cards jc ON oc.job_card_id = jc.id
     LEFT JOIN work_orders wo ON oc.work_order_id = wo.id
     LEFT JOIN sales_order_items soi ON soi.id = wo.sales_order_item_id
     LEFT JOIN sales_orders so ON so.id = COALESCE(wo.sales_order_id, soi.sales_order_id)
     LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
     WHERE oc.id = ?`,
    [id]
  );
  if (!challans.length) return null;
  const challan = challans[0];
  const [items] = await pool.query('SELECT * FROM outward_challan_items WHERE challan_id = ? ORDER BY id', [challan.id]);
  challan.items = items;
  await applyPlanOrderLink(challan);
  return challan;
};

// A plan's sales_order_id can point at the current Sales Order module (`orders`) or the older one
// (`sales_orders`); ids overlap, so use the same resolver as the company filters / change requests.
// Gives the real Sales Order company (incl. approved Company Change Requests) and its Customer PO.
const applyPlanOrderLink = async (challan) => {
  if (!challan.wo_plan_id) return;
  let link = null;
  try {
    link = await require('../services/companyChangeService').resolvePlanOrder(challan.wo_plan_id);
  } catch (err) {
    console.error('[generateDeliveryChallanPdf] resolvePlanOrder failed:', err.message);
    return;
  }
  if (!link) return;
  challan.so_company_id = link.company_id || null;
  challan.cpo_company_id = null;
  let cpo = null;
  if (link.kind === 'ORDER') {
    const [[o]] = await pool.query('SELECT source_type, quotation_id FROM orders WHERE id = ?', [link.order_id]);
    if (o && o.source_type === 'DIRECT' && o.quotation_id) {
      [[cpo]] = await pool.query('SELECT po_number, po_date, host_company_id FROM customer_pos WHERE id = ?', [o.quotation_id]);
    }
  } else {
    const [[so]] = await pool.query('SELECT customer_po_id FROM sales_orders WHERE id = ?', [link.order_id]);
    if (so && so.customer_po_id) {
      [[cpo]] = await pool.query('SELECT po_number, po_date, host_company_id FROM customer_pos WHERE id = ?', [so.customer_po_id]);
    }
  }
  challan.customer_po_number = cpo ? cpo.po_number : null;
  challan.customer_po_date = cpo ? cpo.po_date : null;
  if (!challan.so_company_id && cpo) challan.so_company_id = cpo.host_company_id || null;
  challan.sales_order_no = link.order_no || null;
};

// What the system prints when nothing has been edited
const buildSystemData = async (challan) => {
  const codes = [...new Set((challan.items || []).map(i => i.item_code).filter(Boolean))];
  const nameByCode = {};
  if (codes.length) {
    const ph = codes.map(() => '?').join(',');
    const [sb] = await pool.query(
      `SELECT item_code, material_name, item_description FROM stock_balance WHERE item_code IN (${ph})`, codes
    );
    sb.forEach(r => { if (!nameByCode[r.item_code]) nameByCode[r.item_code] = r.material_name || r.item_description || ''; });
    const [it] = await pool.query(`SELECT item_code, description FROM items WHERE item_code IN (${ph})`, codes);
    it.forEach(r => { if (!nameByCode[r.item_code] && r.description) nameByCode[r.item_code] = r.description; });
  }

  const operation = challan.operation_name || '';
  const lines = [];
  // 1) The job-card part sent for the sub-contract operation
  const partName = [challan.wo_item_code, challan.wo_item_name].filter(Boolean).join(' – ');
  lines.push({
    main: partName || `Job Card ${challan.job_card_no || ''}`.trim(),
    sub: [operation ? `For ${operation}` : '', challan.job_card_no ? `Job Card: ${challan.job_card_no}` : '', challan.wo_number ? `WO: ${challan.wo_number}` : '']
      .filter(Boolean).join('  |  '),
    qty: `${fmtQty(challan.dispatch_qty)} Nos`,
    remarks: operation ? `Sent for ${operation}` : ''
  });
  // 2) Released material lines — when the released material is the same part, show it once on line 1
  const partCode = String(challan.wo_item_code || '').trim().toUpperCase();
  let partAlsoReleased = false;
  (challan.items || []).forEach(item => {
    if (partCode && String(item.item_code || '').trim().toUpperCase() === partCode) {
      partAlsoReleased = true;
      return;
    }
    const name = nameByCode[item.item_code] || '';
    lines.push({
      main: name ? `${item.item_code} – ${name}` : item.item_code,
      sub: '',
      qty: fmtQty(item.release_qty),
      remarks: 'Material released'
    });
  });
  if (partAlsoReleased) {
    lines[0].remarks = [lines[0].remarks, 'Material released'].filter(Boolean).join(' / ');
  }

  return {
    dc_date: toYmd(challan.dispatch_date || challan.created_at),
    your_ch_no: challan.challan_number || '',
    your_ch_date: toYmd(challan.dispatch_date || challan.created_at),
    po_no: challan.customer_po_number || '',
    po_date: toYmd(challan.customer_po_date),
    vehicle_no: '',
    notes: challan.notes || '',
    lines
  };
};

const HEADER_FIELDS = ['dc_date', 'your_ch_no', 'your_ch_date', 'po_no', 'po_date', 'vehicle_no', 'notes'];
const DATE_FIELDS = new Set(['dc_date', 'your_ch_date', 'po_date']);

const loadSaved = async (challanId) => {
  try {
    const [rows] = await pool.query('SELECT * FROM delivery_challan_details WHERE outward_challan_id = ?', [challanId]);
    return rows[0] || null;
  } catch (e) {
    // table not created yet (migration pending) → behave as "no edits"
    if (e.code === 'ER_NO_SUCH_TABLE') return null;
    throw e;
  }
};

// system values overlaid with saved edits (NULL in the saved row = system value)
const mergeData = (system, saved) => {
  const out = { ...system, lines: system.lines.map(l => ({ ...l })) };
  const edited = [];
  if (saved) {
    HEADER_FIELDS.forEach(f => {
      if (saved[f] !== null && saved[f] !== undefined) {
        out[f] = DATE_FIELDS.has(f) ? toYmd(saved[f]) : String(saved[f]);
        edited.push(f);
      }
    });
    if (saved.lines_json) {
      try {
        const parsed = JSON.parse(saved.lines_json);
        if (Array.isArray(parsed)) { out.lines = parsed; edited.push('lines'); }
      } catch { /* ignore broken JSON → system lines */ }
    }
  }
  return { data: out, edited };
};

// Issuing company of the job card's Sales Order (approved Company Change Requests update the Sales Order),
// else the Customer PO company, else the active company.
const loadIssuingCompany = async (challan) => {
  const companyId = challan.so_company_id || challan.cpo_company_id || null;
  if (companyId) {
    const [rows] = await pool.query('SELECT * FROM company_master WHERE id = ?', [companyId]);
    if (rows.length) return rows[0];
  }
  try {
    return await require('../services/adminCompanyMasterService').getActiveCompany();
  } catch (err) {
    console.error('[generateDeliveryChallanPdf] Error loading company profile:', err.message);
    return null;
  }
};

const getDeliveryChallan = async (id) => {
  const challan = await loadChallan(id);
  if (!challan) return null;
  const company = await loadIssuingCompany(challan);
  const system = await buildSystemData(challan);
  const saved = await loadSaved(challan.id);
  const { data, edited } = mergeData(system, saved);
  return {
    id: challan.id,
    dc_no: deliveryChallanNo(challan),
    outward_challan_no: challan.challan_number,
    vendor_name: challan.vendor_name,
    vendor_code: challan.vendor_code,
    job_card_no: challan.job_card_no,
    operation_name: challan.operation_name,
    status: challan.status,
    company_name: company?.company_name || 'SP TECHPIONEER PRIVATE LIMITED',
    sales_order_no: challan.sales_order_no || null,
    data,
    system,
    edited,
    challan,
    company
  };
};

const normLines = (lines) => (Array.isArray(lines) ? lines : [])
  .slice(0, MAX_LINES)
  .map(l => ({
    main: clean(l?.main, 500),
    sub: clean(l?.sub, 500),
    qty: clean(l?.qty, 50),
    remarks: clean(l?.remarks, 300)
  }))
  .filter(l => l.main || l.sub || l.qty || l.remarks);

// Save the edits. A value equal to the system value is stored as NULL so it keeps following the system.
const saveDeliveryChallan = async (id, body = {}) => {
  const info = await getDeliveryChallan(id);
  if (!info) return null;
  const { system } = info;
  const vals = {};
  HEADER_FIELDS.forEach(f => {
    if (DATE_FIELDS.has(f)) {
      const d = toYmd(body[f]);
      vals[f] = d && d !== system[f] ? d : null;
    } else {
      const v = clean(body[f], f === 'notes' ? 2000 : (f === 'vehicle_no' ? 50 : 100));
      vals[f] = v === String(system[f] || '') ? null : v;
    }
  });
  let linesJson = null;
  if (body.lines !== undefined) {
    const lines = normLines(body.lines);
    if (!lines.length) {
      const err = new Error('At least one line is required on the Delivery Challan');
      err.statusCode = 400;
      throw err;
    }
    linesJson = JSON.stringify(lines) === JSON.stringify(normLines(system.lines)) ? null : JSON.stringify(lines);
  }
  await pool.query(
    `INSERT INTO delivery_challan_details
       (outward_challan_id, dc_date, your_ch_no, your_ch_date, po_no, po_date, vehicle_no, notes, lines_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE dc_date = VALUES(dc_date), your_ch_no = VALUES(your_ch_no), your_ch_date = VALUES(your_ch_date),
       po_no = VALUES(po_no), po_date = VALUES(po_date), vehicle_no = VALUES(vehicle_no), notes = VALUES(notes),
       lines_json = VALUES(lines_json)`,
    [info.id, vals.dc_date, vals.your_ch_no, vals.your_ch_date, vals.po_no, vals.po_date, vals.vehicle_no, vals.notes, linesJson]
  );
  return getDeliveryChallan(id);
};

// Back to the system values
const resetDeliveryChallan = async (id) => {
  await pool.query('DELETE FROM delivery_challan_details WHERE outward_challan_id = ?', [id]);
  return getDeliveryChallan(id);
};

const renderPdf = async (info) => {
  const { challan, data } = info;
  const template = fs.readFileSync(path.join(__dirname, '../../templates/delivery-challan.html'), 'utf8');

  const activeCompany = info.company || null;

  let logoBase64 = null;
  if (activeCompany && activeCompany.company_logo) {
    const p = path.join(__dirname, '../../', activeCompany.company_logo);
    if (fs.existsSync(p)) logoBase64 = `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
  }
  if (!logoBase64) {
    const p = path.join(__dirname, '../../../frontend/src/assets/sptechpioneer logo.png');
    if (fs.existsSync(p)) logoBase64 = `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
  }

  const hostCompanyName = activeCompany?.company_name || 'SP TECHPIONEER PRIVATE LIMITED';
  const hostCompanyAddress = activeCompany?.company_address || 'Plot No. 97, Sector 7, PCNTDA, Bhosari, Pune – 411026';
  const contactParts = [];
  if (activeCompany?.phone) contactParts.push(`Mob.: ${activeCompany.phone}`);
  if (activeCompany?.email) contactParts.push(`Email: ${activeCompany.email}`);
  const hostGstin = String(activeCompany?.gstin || '27AAPCS1193L1ZQ').toUpperCase();

  const rows = (data.lines || []).map((l, i) => ({ sr: i + 1, main: l.main, sub: l.sub, qty: l.qty, remarks: l.remarks }));

  const html = mustache.render(template, {
    logoBase64,
    hostCompanyName,
    hostCompanyAddress,
    hostContact: contactParts.join('   ') || null,
    hostGstin,
    vendorName: challan.vendor_name || '',
    vendorAddress: challan.vendor_location || null,
    vendorPhone: challan.vendor_phone || null,
    vendorGstin: challan.vendor_gstin || null,
    vendorCode: challan.vendor_code || '',
    dcNo: info.dc_no,
    dcDate: formatDate(data.dc_date),
    yourChNo: data.your_ch_no || '',
    yourChDate: formatDate(data.your_ch_date),
    poNo: data.po_no || '',
    poDate: formatDate(data.po_date),
    vehicleNo: data.vehicle_no || '',
    notes: data.notes || null,
    rows
  });

  const outputDir = path.join(__dirname, '../../pdf');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const pdfPath = path.join(outputDir, `Delivery_Challan_${challan.id}.pdf`);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    // 190mm printable width, so text wraps exactly as in the PDF while measuring
    await page.setViewport({ width: Math.floor((190 * 96) / 25.4), height: 1123 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    // Stretch the items section so the challan fills the full A4 page
    await page.evaluate((target) => {
      const sheet = document.querySelector('.sheet');
      const filler = document.getElementById('filler-row');
      if (!sheet || !filler) return;
      const gap = target - sheet.getBoundingClientRect().height;
      const base = Math.max(24, filler.getBoundingClientRect().height);
      filler.style.height = `${Math.max(24, base + gap)}px`;
    }, PAGE_CONTENT_HEIGHT_PX);
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
  } finally {
    await browser.close();
  }
  return pdfPath;
};

// Generate the PDF for an outward challan id → { pdfPath, fileName } (null if not found)
const generateDeliveryChallanPdf = async (id) => {
  const info = await getDeliveryChallan(id);
  if (!info) return null;
  const pdfPath = await renderPdf(info);
  return { pdfPath, fileName: `Delivery_Challan_${info.dc_no}.pdf` };
};

module.exports = generateDeliveryChallanPdf;
module.exports.deliveryChallanNo = deliveryChallanNo;
module.exports.getDeliveryChallan = getDeliveryChallan;
module.exports.saveDeliveryChallan = saveDeliveryChallan;
module.exports.resetDeliveryChallan = resetDeliveryChallan;
