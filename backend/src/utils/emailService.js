const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');
const pool = require('../config/db');

const createTransporter = () => {
  const isGmail = process.env.MAIL_HOST === 'smtp.gmail.com';

  const config = {
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT || 587),
    secure: process.env.MAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER || process.env.MAIL_FROM_ADDRESS,
      pass: process.env.EMAIL_PASSWORD || process.env.MAIL_PASSWORD
    }
  };

  // Gmail specific configuration for better reliability
  if (isGmail) {
    config.service = 'gmail';
    // If using service: 'gmail', nodemailer handles host/port/secure
    delete config.host;
    delete config.port;
    if (process.env.MAIL_SECURE !== 'true') {
      delete config.secure;
    }
  }

  return nodemailer.createTransport(config);
};

// Client quotation sheet — same layout as the received-quote (RFQ) PDF in quotationService.generateQuotationPDF:
// A4, 10 item rows per sheet, header / services band / party box / salutation / table / totals / terms / note / signature / footer.
// The same HTML is used for the Download PDF button and for the PDF attached to the quotation email.
const generateQuotationHTML = async (clientName, items, totalAmount, notes, clientId, quoteNumber, hostCompany = null, clientDetails = null) => {
  const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmtINR = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Item note: spaces collapsed, outer brackets removed (re-added when printed), max 500 chars — same rule as the received quote
  const cleanNote = (v) => {
    let s = String(v ?? '').replace(/\s+/g, ' ').trim();
    while (s.startsWith('(') && s.endsWith(')')) s = s.slice(1, -1).trim();
    return s ? s.slice(0, 500) : null;
  };

  // ── "To," block: taken from the Customer Master (customers / customer_contacts), matched by GSTIN (else by name).
  // The quotation's own saved client fields are only the fallback — they can hold stale or repeated text. ──
  const dedupeAddress = (addr) => {
    const seen = new Set();
    const out = [];
    for (const part of String(addr ?? '').split(/[\n\r,]+/)) {
      const t = part.trim();
      const k = t.toLowerCase();
      if (!t || ['n/a', '—', '-'].includes(k) || seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
    return out.join(', ');
  };
  let partyName = clientName;
  let partyAddress = dedupeAddress(clientDetails?.address);
  let partyGstin = clientDetails?.gstin || '';
  let partyContact = clientDetails?.contact_person || '';
  let partyPhone = clientDetails?.phone || '';
  let partyEmail = clientDetails?.email || '';
  try {
    let gst = String(partyGstin || '').trim();
    if (!gst && clientId) {
      const [g] = await pool.query('SELECT gstin FROM companies WHERE id = ?', [clientId]);
      gst = String(g[0]?.gstin || '').trim();
    }
    let master = null;
    if (gst) {
      const [m] = await pool.query('SELECT * FROM customers WHERE gst_no = ? LIMIT 1', [gst]);
      master = m[0] || null;
    }
    if (!master && clientName) {
      const [m] = await pool.query('SELECT * FROM customers WHERE LOWER(TRIM(customer_name)) = LOWER(TRIM(?)) LIMIT 1', [clientName]);
      master = m[0] || null;
    }
    if (master) {
      partyName = master.customer_name || partyName;
      partyAddress = dedupeAddress(master.address) || partyAddress;
      partyGstin = master.gst_no || partyGstin;
      // Contact: keep the person this quotation was addressed to; if none, use the master's first contact
      if (!partyContact || !partyEmail || !partyPhone) {
        const [cc] = await pool.query('SELECT contact_name, mobile, email FROM customer_contacts WHERE customer_id = ? ORDER BY sort_order, id LIMIT 1', [master.id]);
        const first = cc[0];
        if (!partyContact) partyContact = first?.contact_name || '';
        if (!partyPhone) partyPhone = first?.mobile || '';
        if (!partyEmail) partyEmail = first?.email || master.email || '';
      }
    }
  } catch (e) {
    console.error('[Quotation PDF] Customer master lookup failed, using the quotation\'s own client details:', e.message);
  }

  // ── Amounts (unchanged logic): rejected lines are listed but not counted ──
  let subTotal = 0;
  let totalTax = 0;
  const gstRatesUsed = new Set();
  const rows = (items || []).map((item, idx) => {
    const isRejected = item.status === 'REJECTED';
    const quantity = parseFloat(item.quantity) || 1;
    const gstRate = item.gst_percentage !== undefined && item.gst_percentage !== null && item.gst_percentage !== '' ? parseFloat(item.gst_percentage) : 18;
    const unitRate = parseFloat(item.quotedPrice) || 0;
    const lineTotalBase = unitRate * quantity;
    if (!isRejected) {
      subTotal += lineTotalBase;
      totalTax += lineTotalBase * (gstRate / 100);
      gstRatesUsed.add(gstRate);
    }
    const note = cleanNote(item.item_notes);
    return {
      sr: idx + 1,
      drawing_no: item.drawing_no || '—',
      description: item.description || '',
      note,
      isRejected,
      reason: item.rejection_reason || 'Not specified',
      qtyStr: `${quantity % 1 === 0 ? quantity.toFixed(0) : quantity.toFixed(3)} Nos`,
      unitRateStr: isRejected ? 'REJECTED' : fmtINR(unitRate),
      amountStr: isRejected ? 'REJECTED' : fmtINR(lineTotalBase)
    };
  });

  const discountType = (items && items[0]) ? items[0].discount_type || 'percentage' : 'percentage';
  const discountValue = (items && items[0]) ? parseFloat(items[0].discount_value) || 0 : 0;
  let discountAmount = discountType === 'percentage' ? subTotal * (discountValue / 100) : discountValue;
  if (discountAmount > subTotal) discountAmount = subTotal;
  const discountRatio = subTotal > 0 ? (subTotal - discountAmount) / subTotal : 1;
  const finalTax = totalTax * discountRatio;
  const grandTotal = subTotal - discountAmount + finalTax;

  // ── Company / client ──
  const { getHostCompanyLogoBase64, getHostCompanySignatureBase64 } = require('./hostCompanyLogoHelper');
  const logoBase64 = getHostCompanyLogoBase64(hostCompany);
  const signatureBase64 = getHostCompanySignatureBase64(hostCompany);

  const hostCompanyName = hostCompany?.company_name || 'SP TECHPIONEER PVT. LTD.';
  const hostCompanyAddress = String(hostCompany?.company_address || 'Plot No. 97, Sector 7, PCNTDA, Bhosari, Pune – 411026')
    .split(/[\r\n]+/).map(p => p.trim()).filter(Boolean).join(', ');
  const hostGSTIN = hostCompany?.gstin || '';
  const hostEmail = hostCompany?.email || hostCompany?.company_email || '';
  const hostPhone = hostCompany?.phone || hostCompany?.company_phone || hostCompany?.contact_mobile || '';

  const clientGSTIN = partyGstin || '';
  const hostStateCode = String(hostGSTIN).trim().slice(0, 2);
  const clientStateCode = String(clientGSTIN).trim().slice(0, 2);
  const isIGST = /^\d{2}$/.test(hostStateCode) && /^\d{2}$/.test(clientStateCode) && hostStateCode !== clientStateCode;
  const singleRate = gstRatesUsed.size === 1 ? [...gstRatesUsed][0] : null;
  const halfRate = singleRate !== null ? Number((singleRate / 2).toFixed(2)) : null;
  const cgstAmount = Number((finalTax / 2).toFixed(2));
  const sgstAmount = Number((finalTax - cgstAmount).toFixed(2));
  const taxTerm = singleRate !== null
    ? (isIGST ? `IGST ${singleRate}%` : `CGST ${halfRate}% and SGST ${halfRate}%`)
    : (isIGST ? 'IGST as applicable' : 'CGST and SGST as applicable');

  const clientContactLine = [
    partyPhone ? `Mob: ${partyPhone}` : '',
    partyEmail ? `Email: ${partyEmail}` : ''
  ].filter(Boolean).join(' | ');

  const quoteNo = quoteNumber || `QT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const quoteDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const generatedAt = new Date().toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const noteText = (notes && !String(notes).trim().startsWith('Drawing Numbers:')) ? String(notes).trim()
    : (hostCompany?.invoice_footer_notes ? String(hostCompany.invoice_footer_notes).trim() : '');

  // Note box has a fixed height (12mm ≈ 45px): a long note steps its font down (8.5px → 5px) until all of it fits
  const noteFontPx = (() => {
    const len = noteText.length + 6; // "Note: "
    for (const f of [8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5]) {
      const perLine = Math.floor(700 / (f * 0.62));
      const lines = Math.ceil(len / perLine);
      if (lines * f * 1.3 + 6 <= 45) return f;
    }
    return 5;
  })();

  // ── Pages: the last sheet (totals / terms / signature) holds up to 10 item rows; every earlier sheet is filled with
  // up to 15 item rows and the next sheet follows directly. Short sheets are padded with blank rows. ──
  const LAST_PAGE_ROWS = 10;
  const FULL_PAGE_ROWS = 15;
  const pageChunks = [];
  const remainingRows = rows.slice();
  while (remainingRows.length > LAST_PAGE_ROWS) {
    pageChunks.push(remainingRows.splice(0, Math.min(FULL_PAGE_ROWS, remainingRows.length - 1)));
  }
  pageChunks.push(remainingRows);
  const totalPages = pageChunks.length;

  const rowHtml = (r) => {
    if (!r) return '<tr class="item-row blank-row"><td></td><td></td><td></td><td></td><td></td><td></td></tr>';
    return `
              <tr class="item-row">
                <td class="center-col"><div class="cell">${r.sr}</div></td>
                <td><div class="cell"><span class="one-line" style="font-weight: 700;">${esc(r.drawing_no)}</span></div></td>
                <td>
                  <div class="cell">
                    <span class="desc-line" style="font-weight: 700;">${esc(r.description || r.drawing_no)}${r.note ? ` (${esc(r.note)})` : ''}</span>
                    ${r.isRejected ? `<span class="one-line sub-text" style="font-weight: 700; color: #dc2626;">Reason: ${esc(r.reason)}</span>` : ''}
                  </div>
                </td>
                <td class="center-col"><div class="cell"><span class="one-line">${esc(r.qtyStr)}</span></div></td>
                <td class="amount-col"${r.isRejected ? ' style="color: #dc2626; font-weight: 700;"' : ''}>${esc(r.unitRateStr)}</td>
                <td class="amount-col"${r.isRejected ? ' style="color: #dc2626; font-weight: 700;"' : ''}>${esc(r.amountStr)}</td>
              </tr>`;
  };

  const totalsHtml = () => `
              <tr class="totals-row first-total"><td colspan="5" class="totals-label">Sub Total</td><td class="amount-col">${fmtINR(subTotal)}</td></tr>
              ${discountAmount > 0 ? `<tr class="totals-row"><td colspan="5" class="totals-label">Discount${discountType === 'percentage' ? ` @ ${discountValue}%` : ''}</td><td class="amount-col">- ${fmtINR(discountAmount)}</td></tr>` : ''}
              ${isIGST
                ? `<tr class="totals-row"><td colspan="5" class="totals-label">IGST${singleRate !== null ? ` @ ${singleRate}%` : ''}</td><td class="amount-col">${fmtINR(finalTax)}</td></tr>`
                : `<tr class="totals-row"><td colspan="5" class="totals-label">CGST${halfRate !== null ? ` @ ${halfRate}%` : ''}</td><td class="amount-col">${fmtINR(cgstAmount)}</td></tr>
              <tr class="totals-row"><td colspan="5" class="totals-label">SGST${halfRate !== null ? ` @ ${halfRate}%` : ''}</td><td class="amount-col">${fmtINR(sgstAmount)}</td></tr>`}
              <tr class="totals-row grand-row"><td colspan="5" class="totals-label">Grand Total</td><td class="amount-col">${fmtINR(grandTotal)}</td></tr>`;

  const pagesHtml = Array.from({ length: totalPages }, (_, p) => {
    const isLastPage = p === totalPages - 1;
    const pageRows = pageChunks[p].slice();
    while (pageRows.length < (isLastPage ? LAST_PAGE_ROWS : FULL_PAGE_ROWS)) pageRows.push(null);
    return `
      <div class="page-wrap${isLastPage ? ' last-page' : ''}">
        <div class="sheet">
          <div class="header-block">
            <div class="doc-title">Quotation</div>
            <div class="header">
              <div class="logo-container">
                ${logoBase64 ? `<img src="${logoBase64}" style="max-height: 54px; max-width: 68px; object-fit: contain;" />` : '<div class="logo-placeholder">SP<br><span style="font-size: 10px;">TP</span></div>'}
              </div>
              <div class="header-content">
                <h1 class="company-name">${esc(hostCompanyName)}</h1>
                <p class="company-line">${esc(hostCompanyAddress)}</p>
                ${hostPhone ? `<p class="company-line">Mob no - ${esc(hostPhone)}</p>` : ''}
                <p class="company-line" style="font-weight: 500;">${hostGSTIN ? `GSTIN: ${esc(hostGSTIN)}` : ''}${hostEmail ? `${hostGSTIN ? ' | ' : ''}Email: ${esc(hostEmail)}` : ''}</p>
              </div>
            </div>
          </div>

          <div class="services-band">
            <p>Special Purpose Machines / Fixtures Design &amp; Manufacturing, Reverse Engineering,</p>
            <p>Precision Engineering Work, CAD Services</p>
          </div>

          <div class="party-grid">
            <div class="party-to">
              <p>To,</p>
              <p style="font-weight: 700; font-size: 10px;">${esc(partyName)}</p>
              ${partyAddress ? `<p>${esc(partyAddress)}</p>` : ''}
              ${partyContact ? `<p>Kind Attn: ${esc(partyContact)}</p>` : ''}
              ${clientContactLine ? `<p>${esc(clientContactLine)}</p>` : ''}
              ${clientGSTIN ? `<p>GSTIN: ${esc(clientGSTIN)}</p>` : ''}
            </div>
            <div class="party-meta">
              <table class="meta-table">
                <tr><td class="meta-label">Quotation No</td><td class="meta-value" style="word-break: break-all;">: ${esc(quoteNo)}</td></tr>
                <tr><td class="meta-label">Date</td><td class="meta-value">: ${quoteDate}</td></tr>
              </table>
            </div>
          </div>

          <div class="salutation">
            <p>Dear Sir,</p>
            <p style="padding-left: 12px;">We thank you for your enquiry. Please find our quotation for the following requirement.</p>
          </div>

          <table class="details-table${isLastPage ? '' : ' full-page'}">
            <colgroup>
              <col style="width: 5%;">
              <col style="width: 13%;">
              <col style="width: 44%;">
              <col style="width: 10%;">
              <col style="width: 13%;">
              <col style="width: 15%;">
            </colgroup>
            <thead>
              <tr>
                <th rowspan="2">Sr no</th>
                <th rowspan="2">Drawing No.</th>
                <th rowspan="2">Description</th>
                <th rowspan="2">Quantity</th>
                <th class="money-head">Unit Rate</th>
                <th class="money-head">Amount</th>
              </tr>
              <tr>
                <th><div class="rs-ps"><span>Rs.</span><span>Ps.</span></div></th>
                <th><div class="rs-ps"><span>Rs.</span><span>Ps.</span></div></th>
              </tr>
            </thead>
            <tbody>
              ${pageRows.map(rowHtml).join('')}
              ${isLastPage ? totalsHtml() : ''}
            </tbody>
          </table>

          ${isLastPage ? `
          <div class="terms">
            <p class="terms-title">Terms &amp; Conditions</p>
            <ol>
              <li>Validity: This quotation hold good for acceptance for 30days after which it is subject to our confirmation.<br>We hope that the above is clear &amp; look forward to the pleasure of receiving your valuable order at the earliest.</li>
              <li>Prices quoted are on F.O.R. basis.</li>
              <li>Packing &amp; Forwarding Charges</li>
              <li>Taxes: ${esc(taxTerm)}</li>
              <li>Delivery: Depends on delivery schedule</li>
              <li>Payment Terms: 30 days</li>
            </ol>
          </div>
          ${noteText ? `<div class="note-box" style="font-size: ${noteFontPx}px;"><p><strong>Note:</strong> ${esc(noteText)}</p></div>` : ''}
          ` : ''}

          ${isLastPage ? `
          <div class="sign-row">
            <div class="sign-for">For ${esc(hostCompanyName)}</div>
            ${signatureBase64 ? `<img src="${signatureBase64}" style="max-height: 26px; max-width: 120px; object-fit: contain;" />` : ''}
            <div class="sign-label">Authorised Signatory</div>
          </div>` : ''}
        </div>

        <div class="footer">
          <div>Generated By: System Admin | Generated Date &amp; Time: ${generatedAt}</div>
          <div>${esc(hostCompanyName)} | Page ${p + 1} of ${totalPages}</div>
        </div>
      </div>`;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Quotation - ${esc(hostCompanyName)}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @page { size: A4 portrait; margin: 0; }
        * { box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; color: #111827; line-height: 1.3; margin: 0; padding: 0; background-color: #fff; font-size: 9.5px; }
        .page-wrap { width: 210mm; height: 297mm; padding: 7mm 8mm 0 8mm; overflow: hidden; page-break-after: always; }
        .page-wrap.last-page { page-break-after: auto; }
        .sheet { height: 278mm; border: 1.5px solid #111827; display: flex; flex-direction: column; overflow: hidden; }
        .header-block { height: 22mm; flex-shrink: 0; }
        .doc-title { text-align: center; font-size: 12px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; padding: 3px 0 0 0; }
        .header { display: flex; align-items: center; padding: 0 10px; }
        .logo-container { width: 70px; height: 54px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .logo-placeholder { font-size: 20px; font-weight: 800; color: #64748b; border: 2px solid #64748b; padding: 4px; text-align: center; border-radius: 4px; line-height: 1; }
        .header-content { flex-grow: 1; text-align: center; padding-right: 70px; overflow: hidden; }
        .company-name { font-size: 19px; font-weight: 800; margin: 0 0 2px 0; }
        .company-line { font-size: 9px; font-weight: 600; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .services-band { height: 8mm; flex-shrink: 0; border-top: 1px solid #111827; padding: 2px 10px; text-align: center; font-size: 9px; font-weight: 600; text-transform: uppercase; line-height: 1.3; display: flex; flex-direction: column; justify-content: center; }
        .services-band p { margin: 0; }
        .party-grid { height: 26mm; flex-shrink: 0; display: grid; grid-template-columns: 3fr 2fr; border-top: 1px solid #111827; border-bottom: 1px solid #111827; overflow: hidden; }
        .party-to { padding: 4px 10px; border-right: 1px solid #111827; overflow: hidden; }
        .party-to p, .party-meta p { margin: 0; }
        .party-meta { padding: 4px 10px; overflow: hidden; }
        .meta-table { width: 100%; border-collapse: collapse; }
        .meta-table td { padding: 0.5px 0; font-size: 9px; vertical-align: top; }
        .meta-label { width: 40%; color: #374151; }
        .meta-value { font-weight: 700; }
        .salutation { height: 7mm; flex-shrink: 0; padding: 2px 10px; border-bottom: 1px solid #111827; display: flex; flex-direction: column; justify-content: center; }
        .salutation p { margin: 0; font-weight: 700; }
        .details-table { width: 100%; border-collapse: collapse; table-layout: fixed; flex-shrink: 0; }
        .details-table th { height: 6mm; border-bottom: 1px solid #111827; border-right: 1px solid #111827; padding: 0 4px; font-size: 9px; font-weight: 700; text-align: center; vertical-align: middle; }
        .details-table td { border-right: 1px solid #111827; border-bottom: 1px solid #e5e7eb; padding: 0 5px; font-size: 9px; vertical-align: middle; }
        .details-table th:last-child, .details-table td:last-child { border-right: none; }
        .item-row td { height: 13mm; border-bottom: none; }
        .cell { height: 13mm; padding: 0.6mm 0; overflow: hidden; display: flex; flex-direction: column; justify-content: center; gap: 1px; line-height: 1.1; }
        /* Continuation sheets have no totals / terms / signature block: more, slightly taller rows fill the whole sheet */
        .details-table.full-page .item-row td, .details-table.full-page .cell { height: 13.5mm; }
        .one-line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        /* Description line 1 with the item note in brackets right after it (wraps over at most 3 lines) */
        .desc-line { white-space: normal; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; line-height: 1.15; }
        .amount-col { text-align: right !important; white-space: nowrap; }
        .center-col { text-align: center !important; }
        .details-table th.money-head { border-bottom: 1px solid #111827; }
        .rs-ps { display: flex; justify-content: space-between; padding: 0 4px; }
        .sub-text { font-size: 8px; color: #374151; }
        .details-table .totals-row td { height: 4.8mm; border-bottom: none; padding: 0 6px; font-weight: 600; }
        .details-table .totals-row.first-total td { border-top: 1px solid #111827; }
        .totals-label { text-align: right; }
        .details-table .grand-row td { border-top: 1px solid #111827; font-size: 10px; font-weight: 800; }
        .terms { flex: 0 0 auto; min-height: 0; overflow: hidden; border-top: 1px solid #111827; padding: 3px 10px 2px 10px; font-size: 8.5px; }
        .terms-title { font-size: 10px; font-weight: 800; margin: 0 0 2px 0; }
        .terms ol { margin: 0; padding-left: 18px; }
        .terms li { margin: 1px 0; }
        .note-box { flex-shrink: 0; border-top: 1px solid #111827; padding: 3px 10px; max-height: 12mm; overflow: hidden; }
        .note-box p { margin: 0; }
        .continued { flex: 1 1 auto; border-top: 1px solid #111827; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #374151; }
        .sign-row { flex: 1 1 auto; min-height: 12mm; display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end; border-top: 1px solid #111827; padding: 4px 10px 5px 10px; }
        .sign-for { font-weight: 700; font-size: 11px; }
        .sign-label { font-size: 10px; font-weight: 600; color: #111827; }
        .footer { height: 5mm; display: flex; justify-content: space-between; align-items: center; color: #6b7280; font-size: 7.5px; }
      </style>
    </head>
    <body>
      ${pagesHtml}
    </body>
    </html>
  `;

  return html;
};

const generateChallanHTML = (challan) => {
  const dispatchDate = challan.dispatch_time ? new Date(challan.dispatch_time).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');
  const dispatchTime = challan.dispatch_time ? new Date(challan.dispatch_time).toLocaleTimeString('en-IN') : new Date().toLocaleTimeString('en-IN');
  const totalQty = (challan.items || []).reduce((sum, item) => sum + Number(item.quantity), 0).toFixed(0);

  const itemsHTML = (challan.items || [])
    .map((item, idx) => `
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">${idx + 1}</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #1e3a8a;">${item.item_code}</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">${item.description || ''}</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">732690</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${Number(item.quantity).toFixed(0)}</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">${item.unit || 'PCS'}</td>
      </tr>
    `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: sans-serif; color: #334155; margin: 0; padding: 0; line-height: 1.5; }
        .container { width: 210mm; margin: 0 auto; background: white; border: 1px solid #e2e8f0; }
        .header { background-color: #4f6ebc; color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; text-transform: ; letter-spacing: 2px; }
        .header p { margin: 5px 0 0; font-size: 12px; opacity: 0.9; }
        .title-section { padding: 20px 40px; display: flex; justify-content: space-between; border-bottom: 2px solid #f1f5f9; }
        .title-section h2 { margin: 0; font-size: 28px; color: #1e3a8a; }
        .info-grid { padding: 30px 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        .card { border: 1px solid #f1f5f9; border-radius: 12px; background: #f8fafc; overflow: hidden; }
        .card-header { background: #f1f5f9; padding: 8px 15px; font-size: 10px; font-weight: bold; color: #64748b; text-transform: ; }
        .card-body { padding: 15px; font-size: 12px; }
        .table-container { padding: 0 40px; margin-top: 20px; }
        table { width: 100%; border-collapse: collapse; border: 2px solid #f1f5f9; border-radius: 15px; overflow: hidden; }
        th { background: #e0e7ff; color: #1e3a8a; font-size: 10px; text-transform: ; padding: 12px; text-align: left; }
        .totals { background: #fffbeb; border: 2px solid #fde68a; padding: 20px; border-radius: 20px; margin: 20px 40px; }
        .footer { background: #f1f5f9; padding: 15px; text-align: center; font-size: 9px; color: #64748b; margin-top: auto; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>SPTECHPIONEER PRIVATE LIMITED</h1>
          <p>MIDC Bhosari, Pune – 411026, Maharashtra</p>
          <p>GSTIN: 27ABCDE1234F1Z5 | Phone: +91-9876543210</p>
        </div>
        <div style="padding: 20px 40px; border-bottom: 2px solid #f1f5f9; overflow: hidden;">
          <div style="float: left;"><h2 style="margin:0; color:#1e3a8a;">DELIVERY CHALLAN</h2></div>
          <div style="float: right; text-align: right; font-size: 11px; color: #64748b; font-weight: bold;">
            <div>CHALLAN NO: <span style="color:#0f172a;">${challan.challan_number}</span></div>
            <div>DATE: <span style="color:#0f172a;">${dispatchDate}</span></div>
            <div>SHIPMENT: <span style="color:#0f172a;">${challan.shipment_code}</span></div>
          </div>
        </div>
        <div style="padding: 20px 40px; overflow: hidden;">
          <div style="float: left; width: 48%;">
            <div class="card">
              <div class="card-header">Bill To:</div>
              <div class="card-body">
                <div style="font-size: 16px; font-weight: bold; color: #1e3a8a;">${challan.snapshot_customer_name || challan.customer_name}</div>
                <div style="margin-top: 5px; color: #475569;">
                  GSTIN: ${challan.snapshot_customer_gst || '27XXXXX1234Z1A1'}<br>
                  Contact: ${challan.snapshot_customer_phone || 'N/A'}<br>
                  Email: ${challan.snapshot_customer_email || 'N/A'}
                </div>
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0;">
                  <div style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: ;">Billing Address:</div>
                  <div style="margin-top: 3px;">${challan.snapshot_billing_address || 'N/A'}</div>
                </div>
              </div>
            </div>
            <div class="card" style="margin-top: 15px;">
              <div class="card-header">Ship To:</div>
              <div class="card-body">${challan.snapshot_shipping_address || 'Address not set'}</div>
            </div>
          </div>
          <div style="float: right; width: 48%;">
            <div class="card">
              <div class="card-header">Transport Details:</div>
              <div class="card-body">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                  <span style="color: #94a3b8; font-size: 10px; text-transform: ;">Transporter:</span>
                  <span style="font-weight: bold;">${challan.transporter || '—'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                  <span style="color: #94a3b8; font-size: 10px; text-transform: ;">Vehicle No:</span>
                  <span style="background: #eef2ff; color: #4338ca; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${challan.vehicle_number || '—'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                  <span style="color: #94a3b8; font-size: 10px; text-transform: ;">Driver:</span>
                  <span style="font-weight: bold;">${challan.driver_name || '—'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                  <span style="color: #94a3b8; font-size: 10px; text-transform: ;">Dispatch Time:</span>
                  <span style="font-weight: bold;">${dispatchTime}</span>
                </div>
                <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #e2e8f0; overflow: hidden;">
                  <div style="float: left; width: 45%; background: #f1f5f9; padding: 10px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 8px; font-weight: bold; color: #94a3b8; text-transform: ;">Total Qty</div>
                    <div style="font-size: 16px; font-weight: bold; color: #1e3a8a;">${totalQty} <span style="font-size: 9px;">PCS</span></div>
                  </div>
                  <div style="float: right; width: 45%; background: #f1f5f9; padding: 10px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 8px; font-weight: bold; color: #94a3b8; text-transform: ;">Total Weight</div>
                    <div style="font-size: 16px; font-weight: bold; color: #1e3a8a;">200 <span style="font-size: 9px;">KG</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">Sr</th>
                <th>Item Code</th>
                <th>Description</th>
                <th style="width: 60px; text-align: center;">HSN</th>
                <th style="width: 60px; text-align: right;">Qty</th>
                <th style="width: 60px; text-align: center;">Unit</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>
        </div>
        <div class="totals">
          <div style="font-size: 10px; font-weight: bold; color: #92400e; text-transform: ; margin-bottom: 5px;">Remarks:</div>
          <div style="font-size: 12px; color: #b45309; font-style: italic;">"${challan.remarks || 'Material sent for delivery. Please check items and quantities before receiving.'}"</div>
        </div>
        <div class="footer">
          THIS IS A COMPUTER GENERATED DELIVERY CHALLAN. SUBJECT TO PUNE JURISDICTION.
        </div>
      </div>
    </body>
    </html>
  `;
};

const sendShipmentStatusEmail = async (shipmentData, status, attachments = []) => {
  try {
    const transporter = createTransporter();
    const {
      snapshot_customer_name,
      customer_name,
      snapshot_customer_email,
      customer_email,
      shipment_code,
      driver_name,
      driver_contact,
      driver_email,
      vehicle_number,
      transporter: transporterName
    } = shipmentData;

    const name = snapshot_customer_name || customer_name;
    const email = snapshot_customer_email || customer_email;

    // Determine recipients
    let recipients = [];
    if (email) recipients.push(email);

    // For DISPATCHED, add driver email to recipients if available
    if (status === 'DISPATCHED' && driver_email) {
      recipients.push(driver_email);
    }

    if (recipients.length === 0) {
      console.warn(`[Email Service] No recipients found for shipment ${shipment_code}, skipping notification.`);
      return;
    }

    let subject = '';
    let body = '';

    switch (status) {
      case 'DISPATCHED':
        subject = `Shipment Dispatched: ${shipment_code} - SPTECHPIONEER`;
        body = `
          <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
            <h2 style="color: #4f6ebc;">Shipment Dispatched</h2>
            <p>Dear ${name},</p>
            <p>We are pleased to inform you that your shipment <strong>${shipment_code}</strong> has been dispatched from our warehouse.</p>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin: 0 0 10px; color: #1e3a8a;">Delivery Details:</h4>
              <p style="margin: 5px 0;"><strong>Transporter:</strong> ${transporterName || 'N/A'}</p>
              <p style="margin: 5px 0;"><strong>Vehicle No:</strong> ${vehicle_number || 'N/A'}</p>
              <p style="margin: 5px 0;"><strong>Driver:</strong> ${driver_name || 'N/A'} (${driver_contact || 'N/A'})</p>
            </div>
            <p>Please find the attached Delivery Challan for your reference.</p>
            <p>Best regards,<br/><strong>Logistics Team</strong><br/>SPTECHPIONEER PVT. LTD.</p>
          </div>
        `;
        break;
      case 'OUT_FOR_DELIVERY':
        subject = `Out for Delivery: ${shipment_code} - SPTECHPIONEER`;
        body = `
          <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
            <h2 style="color: #f59e0b;">Out for Delivery</h2>
            <p>Dear ${name},</p>
            <p>Great news! Your shipment <strong>${shipment_code}</strong> is out for delivery and should reach you today.</p>
            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin: 0 0 10px; color: #92400e;">Delivery Contact:</h4>
              <p style="margin: 5px 0;"><strong>Driver:</strong> ${driver_name || 'N/A'}</p>
              <p style="margin: 5px 0;"><strong>Contact No:</strong> ${driver_contact || 'N/A'}</p>
              <p style="margin: 5px 0;"><strong>Vehicle No:</strong> ${vehicle_number || 'N/A'}</p>
            </div>
            <p>Please ensure someone is available to receive the material.</p>
            <p>Best regards,<br/><strong>Logistics Team</strong><br/>SPTECHPIONEER PVT. LTD.</p>
          </div>
        `;
        break;
      case 'DELIVERED':
        subject = `Shipment Delivered: ${shipment_code} - SPTECHPIONEER`;
        body = `
          <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
            <h2 style="color: #10b981;">Successfully Delivered</h2>
            <p>Dear ${name},</p>
            <p>Your shipment <strong>${shipment_code}</strong> has been successfully delivered.</p>
            <p>Thank you for choosing SPTECHPIONEER PVT. LTD. We hope to serve you again soon!</p>
            <p>Best regards,<br/><strong>Customer Success Team</strong><br/>SPTECHPIONEER PVT. LTD.</p>
          </div>
        `;
        break;
    }

    const mailOptions = {
      from: process.env.EMAIL_USER || process.env.MAIL_FROM_ADDRESS || 'noreply@sptechpioneer.com',
      to: recipients.join(','),
      subject: subject,
      html: body,
      attachments: attachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email Service] Shipment ${status} email sent to ${email}:`, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[Email Service] Failed to send shipment ${status} email:`, error.message);
  }
};

const sendQuotationEmail = async (clientEmail, clientName, items, totalAmount, notes, clientId, quoteNumber, hostCompanyId = null, passedClientDetails = null, customSubject = null, customMessage = null, attachPDF = true, customAttachments = [], cc = null, bcc = null) => {
  try {
    const transporter = createTransporter();
    const adminCompanyMasterService = require('../services/adminCompanyMasterService');
    let hostCompany = null;
    if (hostCompanyId) {
      try {
        hostCompany = await adminCompanyMasterService.getCompanyById(hostCompanyId);
      } catch (err) {
        console.error('Error fetching host company in email service:', err);
      }
    }
    if (!hostCompany) {
      try {
        hostCompany = await adminCompanyMasterService.getActiveCompany();
      } catch (err) {
        console.error('Error fetching active company in email service:', err);
      }
    }

    let clientDetails = { email: '', phone: '', gstin: '' };
    if (clientId) {
      try {
        const [clientRows] = await pool.query(
          `SELECT c.gstin,
                  (SELECT email FROM contacts WHERE company_id = c.id AND (contact_type = 'PRIMARY' OR contact_type = 'PURCHASE') LIMIT 1) as email,
                  (SELECT phone FROM contacts WHERE company_id = c.id AND (contact_type = 'PRIMARY' OR contact_type = 'PURCHASE') LIMIT 1) as phone
           FROM companies c WHERE c.id = ?`,
          [clientId]
        );
        if (clientRows.length > 0) {
          clientDetails = {
            email: clientRows[0].email || '',
            phone: clientRows[0].phone || '',
            gstin: clientRows[0].gstin || ''
          };
        }
      } catch (err) {
        console.error('Error fetching client details in email service:', err);
      }
    }

    if (passedClientDetails) {
      clientDetails = {
        ...clientDetails,
        ...passedClientDetails
      };
    }

    // Generate PDF buffer only if attachPDF is true
    let pdfBuffer;
    if (attachPDF) {
      const html = await generateQuotationHTML(clientName, items, totalAmount, notes, clientId, quoteNumber, hostCompany, clientDetails);
      try {
        const browser = await puppeteer.launch({
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
          margin: { top: '0', right: '0', bottom: '0', left: '0' }
        });
        await browser.close();
      } catch (pdfError) {
        console.error('[Email Service] PDF generation failed:', pdfError.message);
      }
    }

    const formattedQuoteNumber = quoteNumber ? `[${quoteNumber}]` : '';

    const mailOptions = {
      from: process.env.EMAIL_USER || process.env.MAIL_FROM_ADDRESS || 'noreply@sptechpioneer.com',
      to: clientEmail,
      ...(cc ? { cc } : {}),
      ...(bcc ? { bcc } : {}),
      subject: customSubject || `Quotation Request ${formattedQuoteNumber} from SP TECHPIONEER - ${clientName}`,
      html: customMessage ? `
        <div style="font-family: 'Inter', system-ui, Avenir, Helvetica, Arial, sans-serif; color: #333; line-height: 1.6;">
          <p>${customMessage.replace(/\n/g, '<br>')}</p>
        </div>
      ` : `
        <div style="font-family: 'Inter', system-ui, Avenir, Helvetica, Arial, sans-serif; color: #333; line-height: 1.6;">
          <h2 style="color: #f26522;">Dear ${clientName},</h2>
          <p>Please find the attached quotation ${formattedQuoteNumber} for your approved drawings from <strong>SP TECHPIONEER PVT. LTD.</strong></p>
          <p><strong>Total Quotation Value (Incl. GST):</strong> ₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          <p>The detailed breakdown of items, quantities, and pricing is provided in the attached PDF.</p>
          <p>We look forward to your feedback and approval.</p>
          <br/>
          <p>Best regards,</p>
          <p><strong>Sales Team</strong><br/>SP TECHPIONEER PVT. LTD.</p>
          <p style="font-size: 11px; color: #666; margin-top: 20px;">Plot No. 97, Sector 7, PCNTDA, Bhosari, Pune – 411026</p>
        </div>
      `,
      replyTo: process.env.REPLY_TO_EMAIL || process.env.MAIL_FROM_ADDRESS || 'reactjscodigix@gmail.com',
      attachments: [
        ...((attachPDF && pdfBuffer) ? [{
          filename: `Quotation_${clientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
          content: pdfBuffer
        }] : []),
        ...(customAttachments || []).map(att => ({
          filename: att.filename,
          content: att.content,
          encoding: 'base64'
        }))
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[Email Service] Quotation sent successfully with PDF:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email Service] Failed to send quotation email:', error.message);
    throw new Error(`Failed to send quotation email: ${error.message}`);
  }
};

const sendReplyEmail = async (to, subject, message, replyToId) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_USER || process.env.MAIL_FROM_ADDRESS || 'noreply@sptechpioneer.com',
      to: to,
      subject: subject,
      html: `
        <div style="font-family: 'Inter', system-ui, Avenir, Helvetica, Arial, sans-serif; color: #333; line-height: 1.6;">
          <div style="white-space: pre-wrap;">${message}</div>
          <br/>
          <p>Best regards,</p>
          <p><strong>Sales Team</strong><br/>SP TECHPIONEER PVT. LTD.</p>
        </div>
      `,
      replyTo: process.env.REPLY_TO_EMAIL || process.env.MAIL_FROM_ADDRESS || 'reactjscodigix@gmail.com'
    };

    if (replyToId) {
      mailOptions.inReplyTo = replyToId;
      mailOptions.references = [replyToId];
    }

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email Service] Failed to send reply email:', error.message);
    throw new Error(`Failed to send reply email: ${error.message}`);
  }
};

const generateQuotationPDF = async (clientName, items, totalAmount, notes, clientId, quoteNumber, hostCompanyId = null, passedClientDetails = null) => {
  const adminCompanyMasterService = require('../services/adminCompanyMasterService');
  let hostCompany = null;
  if (hostCompanyId) {
    try {
      hostCompany = await adminCompanyMasterService.getCompanyById(hostCompanyId);
    } catch (err) {
      console.error('Error fetching host company in PDF service:', err);
    }
  }
  if (!hostCompany) {
    try {
      hostCompany = await adminCompanyMasterService.getActiveCompany();
    } catch (err) {
      console.error('Error fetching active company in PDF service:', err);
    }
  }

  let clientDetails = { email: '', phone: '', gstin: '' };
  if (clientId) {
    try {
      const [clientRows] = await pool.query(
        `SELECT c.gstin,
                (SELECT email FROM contacts WHERE company_id = c.id AND (contact_type = 'PRIMARY' OR contact_type = 'PURCHASE') LIMIT 1) as email,
                (SELECT phone FROM contacts WHERE company_id = c.id AND (contact_type = 'PRIMARY' OR contact_type = 'PURCHASE') LIMIT 1) as phone
         FROM companies c WHERE c.id = ?`,
        [clientId]
      );
      if (clientRows.length > 0) {
        clientDetails = {
          email: clientRows[0].email || '',
          phone: clientRows[0].phone || '',
          gstin: clientRows[0].gstin || ''
        };
      }
    } catch (err) {
      console.error('Error fetching client details in PDF service:', err);
    }
  }

  if (passedClientDetails) {
    clientDetails = {
      ...clientDetails,
      ...passedClientDetails
    };
  }

  const html = await generateQuotationHTML(clientName, items, totalAmount, notes, clientId, quoteNumber, hostCompany, clientDetails);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' }
  });
  await browser.close();
  return pdf;
};

const generateCostBreakdownPDF = async (clientName, quoteNumber, projectName, dataRows) => {
  // Get body rows (exclude the last placeholder row, which is the Grand Total row sent from controller)
  const bodyRows = dataRows.slice(1, -1);
  const grandTotalEntry = dataRows[dataRows.length - 1];

  // Compute column sums from parent (non-child) rows
  const NUM_COLS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19];
  const colTotals = {};
  NUM_COLS.forEach(c => { colTotals[c] = 0; });
  let totalQty = 0;

  bodyRows.forEach(r => {
    const isChild = typeof r[0] === 'string' && r[0].startsWith('↳');
    if (!isChild) {
      NUM_COLS.forEach(c => { colTotals[c] += (parseFloat(r[c]) || 0); });
      totalQty += (parseFloat(r[17]) || 0);
    }
  });

  const fmt = (val) =>
    (val !== undefined && val !== null && val !== '')
      ? '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '₹0.00';

  const fmtOrBlank = (val) =>
    (val !== undefined && val !== null && val !== '' && !isNaN(Number(val)) && Number(val) !== 0)
      ? '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '';

  const formattedRowsHtml = bodyRows.map(r => {
    const isChild    = typeof r[0] === 'string' && r[0].startsWith('↳');
    const isAssembly = r[3] === 'ASM';

    let rowClass = '';
    if (isChild)    rowClass = 'child-row bg-slate-50';
    else if (isAssembly) rowClass = 'font-bold bg-slate-50';

    return `
      <tr class="${rowClass}">
        <td class="text-center" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${r[0] || ''}</td>
        <td class="${isChild ? 'pl-4' : 'font-bold'}" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${r[1] || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 4px 3px; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${r[2] || ''}</td>
        <td class="text-center font-bold" style="border: 1px solid #cbd5e1; padding: 4px 3px; color: ${isAssembly ? '#2563eb' : '#475569'};">${r[3] || ''}</td>
        <td class="text-right" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmt(r[4])}</td>
        <td class="text-right" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmt(r[5])}</td>
        <td class="text-right" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmt(r[6])}</td>
        <td class="text-right" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmt(r[7])}</td>
        <td class="text-right" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmt(r[8])}</td>
        <td class="text-right" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmt(r[9])}</td>
        <td class="text-right" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmt(r[10])}</td>
        <td class="text-right" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmt(r[11])}</td>
        <td class="text-right" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmt(r[12])}</td>
        <td class="text-right" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmt(r[13])}</td>
        <td class="text-right" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmt(r[14])}</td>
        <td class="text-right" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmt(r[15])}</td>
        <td class="text-right" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmt(r[16])}</td>
        <td class="text-center font-bold" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${r[17] !== undefined ? r[17] : ''}</td>
        <td class="text-right font-semibold" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmtOrBlank(r[18])}</td>
        <td class="text-right font-bold text-indigo-750" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmtOrBlank(r[19])}</td>
      </tr>
    `;
  }).join('');

  // ── Grand Total row HTML ──
  const grandTotalHtml = `
    <tr class="bg-slate-100 font-bold">
      <td colspan="4" class="text-left font-bold" style="border: 1px solid #94a3b8; padding: 5px 4px;">Grand Total</td>
      <td class="text-right" style="border: 1px solid #94a3b8; padding: 5px 3px;">${fmt(colTotals[4])}</td>
      <td class="text-right" style="border: 1px solid #94a3b8; padding: 5px 3px;">${fmt(colTotals[5])}</td>
      <td class="text-right" style="border: 1px solid #94a3b8; padding: 5px 3px;">${fmt(colTotals[6])}</td>
      <td class="text-right" style="border: 1px solid #94a3b8; padding: 5px 3px;">${fmt(colTotals[7])}</td>
      <td class="text-right" style="border: 1px solid #94a3b8; padding: 5px 3px;">${fmt(colTotals[8])}</td>
      <td class="text-right" style="border: 1px solid #94a3b8; padding: 5px 3px;">${fmt(colTotals[9])}</td>
      <td class="text-right" style="border: 1px solid #94a3b8; padding: 5px 3px;">${fmt(colTotals[10])}</td>
      <td class="text-right" style="border: 1px solid #94a3b8; padding: 5px 3px;">${fmt(colTotals[11])}</td>
      <td class="text-right" style="border: 1px solid #94a3b8; padding: 5px 3px;">${fmt(colTotals[12])}</td>
      <td class="text-right" style="border: 1px solid #94a3b8; padding: 5px 3px;">${fmt(colTotals[13])}</td>
      <td class="text-right" style="border: 1px solid #94a3b8; padding: 5px 3px;">${fmt(colTotals[14])}</td>
      <td class="text-right" style="border: 1px solid #94a3b8; padding: 5px 3px;">${fmt(colTotals[15])}</td>
      <td class="text-right" style="border: 1px solid #94a3b8; padding: 5px 3px;">${fmt(colTotals[16])}</td>
      <td class="text-center" style="border: 1px solid #94a3b8; padding: 5px 3px;">${totalQty}</td>
      <td style="border: 1px solid #94a3b8; padding: 5px 3px;"></td>
      <td class="text-right font-bold" style="border: 1px solid #94a3b8; padding: 5px 3px; color: #1e40af;">
        ${fmt(parseFloat(grandTotalEntry[19]) || colTotals[19])}
      </td>
    </tr>
  `;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Cost Breakdown - ${quoteNumber}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        @page {
          size: A3 landscape;
          margin: 10mm;
        }

        body {
          font-family: 'Inter', sans-serif;
          margin: 0;
          padding: 0;
          color: #1e293b;
          font-size: 9.5px;
          background-color: #ffffff;
          -webkit-print-color-adjust: exact;
        }
        .container {
          width: 100%;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #2563eb;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .company-title {
          font-size: 18px;
          font-weight: 700;
          color: #1e3a8a;
          margin: 0;
        }
        .doc-title {
          font-size: 13px;
          font-weight: 600;
          color: #475569;
          margin: 3px 0 0 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .metadata-box {
          text-align: right;
          font-size: 10px;
          color: #475569;
          line-height: 1.4;
        }
        .metadata-row {
          margin-bottom: 2px;
        }
        .metadata-label {
          font-weight: 600;
          color: #1e293b;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 5px;
        }
        th {
          background-color: #f1f5f9;
          color: #1e293b;
          font-weight: 700;
          text-align: center;
          border: 1px solid #94a3b8;
          padding: 5px 3px;
          font-size: 9px;
        }
        .text-right {
          text-align: right;
        }
        .text-center {
          text-align: center;
        }
        .font-bold {
          font-weight: 700;
        }
        .pl-4 {
          padding-left: 12px !important;
        }
        .bg-slate-50 {
          background-color: #f8fafc;
        }
        .bg-slate-100 {
          background-color: #e2e8f0;
        }
        .child-row {
          color: #475569;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div>
            <h1 class="company-title">${clientName}</h1>
            <h2 class="doc-title">Quotation Cost Breakdown Sheet</h2>
          </div>
          <div class="metadata-box">
            <div class="metadata-row"><span class="metadata-label">Quotation No:</span> ${quoteNumber}</div>
            <div class="metadata-row"><span class="metadata-label">Project:</span> ${projectName || '—'}</div>
            <div class="metadata-row"><span class="metadata-label">Date:</span> ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 45px;">Sr No</th>
              <th style="text-align: left; width: 180px;">Component Number</th>
              <th style="text-align: left; width: 250px;">Description</th>
              <th style="width: 60px;">Type</th>
              <th class="text-right" style="width: 85px;">Material Cost</th>
              <th class="text-right" style="width: 85px;">CNC/Turning</th>
              <th class="text-right" style="width: 85px;">Milling/Cutting</th>
              <th class="text-right" style="width: 85px;">VMC</th>
              <th class="text-right" style="width: 85px;">Drilling</th>
              <th class="text-right" style="width: 85px;">Tapping</th>
              <th class="text-right" style="width: 85px;">Grinding</th>
              <th class="text-right" style="width: 100px;">Laser Cutting</th>
              <th class="text-right" style="width: 85px;">Sparking</th>
              <th class="text-right" style="width: 85px;">Finish</th>
              <th class="text-right" style="width: 85px;">QC</th>
              <th class="text-right" style="width: 85px;">Packing</th>
              <th class="text-right" style="width: 100px;">Profit & Overheads</th>
              <th style="width: 45px;">Qty</th>
              <th class="text-right" style="width: 85px;">Unit Price</th>
              <th class="text-right" style="width: 95px;">Total Price</th>
            </tr>
          </thead>
          <tbody>
            ${formattedRowsHtml}
          </tbody>
        </table>
      </div>
    </body>
    </html>
  `;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({
    format: 'A3',
    landscape: true,
    margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    printBackground: true
  });
  await browser.close();
  return pdf;
};

module.exports = {
  sendQuotationEmail,
  generateQuotationHTML,
  generateQuotationPDF,
  generateCostBreakdownPDF,
  sendReplyEmail,
  sendShipmentStatusEmail,
  generateChallanHTML
};
