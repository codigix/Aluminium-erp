// Return Challan (paper-form layout, same style as the Delivery Challan) for a Purchase Return.
// Read-only: nothing is written to the DB.
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const mustache = require('mustache');
const pool = require('../config/db');

// A4 (297mm) minus 10mm top + 10mm bottom margin, in CSS px (96 dpi), with a small safety gap
const PAGE_CONTENT_HEIGHT_PX = Math.floor((277 * 96) / 25.4) - 6;

const formatDate = (v) => {
  if (!v) return '';
  const s = String(v);
  let y, m, d;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) [y, m, d] = s.slice(0, 10).split('-');
  else {
    const dt = new Date(v);
    if (Number.isNaN(dt.getTime())) return '';
    y = dt.getFullYear(); m = String(dt.getMonth() + 1).padStart(2, '0'); d = String(dt.getDate()).padStart(2, '0');
  }
  return `${d}/${m}/${y}`;
};

const fmt = (v) => {
  const n = parseFloat(v || 0);
  if (!Number.isFinite(n) || Math.abs(n) < 0.0005) return '';
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
};

const loadCompany = async (companyId) => {
  if (companyId) {
    const [rows] = await pool.query('SELECT * FROM company_master WHERE id = ?', [companyId]);
    if (rows.length) return rows[0];
  }
  try {
    return await require('../services/adminCompanyMasterService').getActiveCompany();
  } catch (e) {
    return null;
  }
};

const logoFor = (company) => {
  if (company && company.company_logo) {
    const p = path.join(__dirname, '../../', company.company_logo);
    if (fs.existsSync(p)) return `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
  }
  const p = path.join(__dirname, '../../../frontend/src/assets/sptechpioneer logo.png');
  return fs.existsSync(p) ? `data:image/png;base64,${fs.readFileSync(p).toString('base64')}` : null;
};

const generateReturnChallanPdf = async (pr) => {
  const template = fs.readFileSync(path.join(__dirname, '../../templates/return-challan.html'), 'utf8');
  const company = await loadCompany(pr.host_company_id);
  const [[vendor]] = await pool.query('SELECT vendor_name, vendor_code, location, phone, gstin FROM vendors WHERE id = ?', [pr.vendor_id]);
  const [[po]] = pr.po_id ? await pool.query('SELECT created_at FROM purchase_orders WHERE id = ?', [pr.po_id]) : [[null]];
  const grnIds = [...new Set((pr.items || []).map(i => i.grn_id).filter(Boolean))];
  let grnDate = '';
  if (grnIds.length) {
    const [[g]] = await pool.query('SELECT grn_date FROM grns WHERE id = ?', [grnIds[0]]);
    grnDate = g ? formatDate(g.grn_date) : '';
  }

  const contact = [];
  if (company?.phone) contact.push(`Mob.: ${company.phone}`);
  if (company?.email) contact.push(`Email: ${company.email}`);

  const rows = (pr.items || []).map((i, idx) => ({
    sr: idx + 1,
    main: [i.item_code, i.description && i.description !== i.item_code ? i.description : null].filter(Boolean).join(' – '),
    sub: [i.size_text, i.grn_no ? `GRN: ${i.grn_no}` : null].filter(Boolean).join('  |  '),
    qty: fmt(i.quantity) ? `${fmt(i.quantity)} ${String(i.unit || '').toUpperCase() === 'KG' ? 'Nos' : (i.unit || 'Nos')}` : '',
    weight: fmt(i.weight),
    remarks: i.remarks || 'QC Rejected'
  }));

  const html = mustache.render(template, {
    logoBase64: logoFor(company),
    hostCompanyName: company?.company_name || 'SP TECHPIONEER PRIVATE LIMITED',
    hostCompanyAddress: company?.company_address || 'Plot No. 97, Sector 7, PCNTDA, Bhosari, Pune – 411026',
    hostContact: contact.join('   ') || null,
    hostGstin: String(company?.gstin || '27AAPCS1193L1ZQ').toUpperCase(),
    returnTypeLabel: pr.return_type === 'DEBIT_NOTE' ? 'against Debit Note' : 'for Replacement',
    vendorName: vendor?.vendor_name || pr.vendor_name || '',
    vendorAddress: vendor?.location || null,
    vendorPhone: vendor?.phone || null,
    vendorGstin: vendor?.gstin || null,
    vendorCode: vendor?.vendor_code || '',
    returnNo: pr.return_no,
    returnDate: formatDate(pr.return_date),
    poNumber: pr.po_number || '',
    poDate: po ? formatDate(po.created_at) : '',
    grnNos: grnIds.map(id => `GRN-${String(id).padStart(4, '0')}`).join(', '),
    grnDate,
    rows,
    totalQty: fmt(pr.total_qty),
    totalWeight: fmt(pr.total_weight),
    reason: pr.reason || '',
    remarks: pr.remarks || null,
    vehicleNo: pr.vehicle_no || '',
    transporter: pr.transporter || null
  });

  const outputDir = path.join(__dirname, '../../pdf');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const pdfPath = path.join(outputDir, `Return_Challan_${pr.id}.pdf`);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: Math.floor((190 * 96) / 25.4), height: 1123 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
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
  return { pdfPath, fileName: `Return_Challan_${pr.return_no}.pdf` };
};

module.exports = generateReturnChallanPdf;
