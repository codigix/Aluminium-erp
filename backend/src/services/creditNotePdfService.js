const pool = require('../config/db');

// Credit Note PDF – same A4 layout as the Sales Invoice tax invoice PDF, kept separate so the
// sales invoice generator is not affected.

const COPY_ORDER = ['Original for Recipient', 'Duplicate for Transporter', 'Triplicate for Supplier', 'Extra Copy'];
const ITEMS_PER_PAGE = 10;

const CREDIT_NOTE_REASONS = {
  SALES_RETURN: 'Sales Return',
  QUALITY_REJECTION: 'Quality Rejection by Customer',
  SHORT_SUPPLY: 'Short Supply',
  RATE_DIFFERENCE: 'Rate Difference',
  DISCOUNT: 'Discount / Rebate',
  OTHER: 'Other Adjustment'
};

// Single copy label, comma-separated list, or 'all' → known labels in fixed print order
const resolveCopyTypes = (copyType) => {
  const raw = String(copyType || '').trim();
  if (raw.toLowerCase() === 'all' || raw.toLowerCase().includes('all copies')) return [...COPY_ORDER];
  const requested = raw.split(',').map(c => c.trim()).map(c => (c === 'Additional Copy' ? 'Extra Copy' : c));
  const copies = COPY_ORDER.filter(c => requested.includes(c));
  return copies.length ? copies : [COPY_ORDER[0]];
};

const numberToWords = (num) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const convert = (n) => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : '');
    return '';
  };
  const formatWords = (n) => {
    if (n === 0) return 'Zero';
    let words = '';
    if (n >= 10000000) { words += convert(Math.floor(n / 10000000)) + ' Crore '; n %= 10000000; }
    if (n >= 100000) { words += convert(Math.floor(n / 100000)) + ' Lakh '; n %= 100000; }
    if (n >= 1000) { words += convert(Math.floor(n / 1000)) + ' Thousand '; n %= 1000; }
    words += convert(n);
    return words.trim();
  };
  const amount = Math.floor(num || 0);
  const paisa = Math.round(((num || 0) - amount) * 100);
  return paisa > 0
    ? `INR ${formatWords(amount)} and ${formatWords(paisa)} Paisa Only`
    : `INR ${formatWords(amount)} Only`;
};

const formatDate = (date) => (date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/\s/g, '-') : '');
const formatCurrency = (val) => Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rateStr = (r) => (r % 1 === 0 ? String(r) : r.toFixed(1)) + '%';

const getHostCompany = async (hostCompanyId) => {
  const adminCompanyMasterService = require('./adminCompanyMasterService');
  let company = null;
  if (hostCompanyId) {
    try {
      company = await adminCompanyMasterService.getCompanyById(hostCompanyId);
    } catch (e) {
      console.warn(`Could not fetch company by id ${hostCompanyId}, falling back to active company`);
    }
  }
  return company || adminCompanyMasterService.getActiveCompany();
};

const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4 portrait; margin: 4mm 6mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; font-size: 7.2pt; line-height: 1.2; color: #000; background: #fff; }
    .invoice-page { width: 100%; height: 287mm; border: 1px solid #000; display: flex; flex-direction: column; page-break-after: always; box-sizing: border-box; }
    .invoice-page:last-child { page-break-after: avoid; }
    .title-header { position: relative; text-align: center; padding: 3px 8px; border-bottom: 1px solid #000; min-height: 20px; }
    .title-main { font-size: 10pt; font-weight: bold; line-height: 18px; }
    .header-right-badges { position: absolute; right: 8px; top: 2.5px; display: flex; gap: 6px; align-items: center; }
    .header-left-badges { position: absolute; left: 8px; top: 2.5px; }
    .copy-type-title { font-size: 8pt; font-weight: bold; text-transform: uppercase; color: #000; padding: 1px 7px; border-radius: 2px; letter-spacing: 0.3px; }
    .cancelled-badge { font-size: 8pt; font-weight: bold; color: #b91c1c; border: 1px solid #b91c1c; padding: 0 6px; border-radius: 2px; }
    .page-badge { font-size: 7.5pt; font-weight: bold; color: #333; background-color: #f0f0f0; border: 1px solid #bbb; padding: 1px 6px; border-radius: 2px; }
    .row-flex { display: flex; width: 100%; }
    .border-b { border-bottom: 1px solid #000; }
    .seller-box { width: 58%; border-right: 1px solid #000; display: flex; flex-direction: column; }
    .seller-name { font-weight: bold; font-size: 8.5pt; margin-bottom: 1px; text-transform: uppercase; }
    .seller-line { font-size: 7.2pt; margin-bottom: 1px; line-height: 1.2; }
    .meta-box { width: 42%; }
    .meta-table { width: 100%; height: 100%; border-collapse: collapse; }
    .meta-table td { border-bottom: 1px solid #000; border-right: 1px solid #000; padding: 1.5px 4px; vertical-align: top; font-size: 7.2pt; height: 16px; }
    .meta-table tr td:last-child { border-right: none; }
    .meta-table tr:last-child td { border-bottom: none; }
    .meta-lbl { font-size: 6.2pt; color: #333; display: block; margin-bottom: 0px; line-height: 1.1; }
    .meta-val { font-weight: bold; font-size: 7.2pt; line-height: 1.15; }
    .party-title { font-size: 6.8pt; color: #333; font-weight: normal; margin-bottom: 1px; }
    .party-name { font-weight: bold; font-size: 8pt; margin-bottom: 1px; text-transform: uppercase; }
    .table-wrapper { flex: 1; display: flex; flex-direction: column; border-bottom: 1px solid #000; min-height: 0; }
    .item-table { width: 100%; border-collapse: collapse; height: 100%; }
    .item-table th { border: 1px solid #000; padding: 2px 2px; font-size: 6.8pt; font-weight: bold; text-align: center; background-color: #ffffff; height: 16px; }
    .item-table td { border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px 4px; vertical-align: top; font-size: 7.2pt; line-height: 1.2; }
    .item-table tr.item-row td { padding: 3px 4px 4px; }
    .item-code { font-weight: bold; font-size: 7.2pt; }
    .item-desc { font-size: 7.2pt; font-weight: bold; margin-top: 0px; text-transform: uppercase; }
    .item-table tr.tax-row td { height: 16px; padding: 1.5px 4px; vertical-align: middle; }
    .item-table tr.tax-row td.lbl { text-align: right; font-style: italic; font-weight: bold; white-space: nowrap; }
    .item-table tr.tax-row td.pct { text-align: center; font-style: italic; font-weight: bold; white-space: nowrap; }
    .item-table tr.tax-row td.amt { text-align: right; font-weight: bold; white-space: nowrap; }
    .item-table tr.total-row td { border-top: 1px solid #000; border-bottom: 2px solid #000; font-weight: bold; font-size: 7.5pt; padding: 2px 4px; vertical-align: middle; }
    .item-table tr.spacer-row td { height: 100%; padding: 0; }
    .charge-box { padding: 3px 6px; border-bottom: 1px solid #000; display: flex; justify-content: space-between; align-items: flex-end; }
    .charge-lbl { font-size: 6.5pt; color: #333; line-height: 1.1; }
    .charge-words { font-weight: bold; font-size: 7.5pt; margin-top: 1px; line-height: 1.2; }
    .gst-table { width: 100%; border-collapse: collapse; border-bottom: 1px solid #000; }
    .gst-table th, .gst-table td { border: 1px solid #000; padding: 1.5px 3px; font-size: 6.8pt; text-align: center; height: 14px; }
    .gst-table th { font-weight: bold; }
    .gst-table td.num { text-align: right; }
    .tax-words-box { padding: 2.5px 6px; border-bottom: 1px solid #000; font-size: 7pt; line-height: 1.2; }
    .footer-flex { display: flex; border-bottom: 1px solid #000; min-height: 48px; }
    .decl-box { width: 50%; padding: 3px 6px; font-size: 6.8pt; line-height: 1.2; border-right: 1px solid #000; }
    .sig-box-right { width: 50%; padding: 3px 6px; display: flex; flex-direction: column; justify-content: space-between; text-align: center; font-size: 7.2pt; }
    .computer-msg { text-align: center; font-size: 6.5pt; padding: 2px 0; }
  </style>
</head>
<body>
  {{#pages}}
  <div class="invoice-page">
    <div class="title-header">
      {{#is_cancelled}}<div class="header-left-badges"><span class="cancelled-badge">CANCELLED</span></div>{{/is_cancelled}}
      <span class="title-main">Credit Note</span>
      <div class="header-right-badges">
        <span class="copy-type-title">({{copy_type}})</span>
        {{#show_page_number}}<span class="page-badge">Page {{page_number}} of {{total_pages}}</span>{{/show_page_number}}
      </div>
    </div>

    <div class="row-flex border-b">
      <div class="seller-box">
        <div style="padding: 4px 6px; border-bottom: 1px solid #000; flex: 1;">
          <div class="seller-name">{{hostCompanyName}}</div>
          {{#hostCompanyAddressLines}}<div class="seller-line">{{.}}</div>{{/hostCompanyAddressLines}}
          <div class="seller-line"><strong>GST No:</strong> {{hostGSTIN}}</div>
          <div class="seller-line"><strong>State Name :</strong> {{hostStateName}}</div>
        </div>
        <div style="padding: 4px 6px; border-bottom: 1px solid #000; flex: 1;">
          <div class="party-title">Consignee (Ship to)</div>
          <div class="party-name">{{customer_name}}</div>
          <div class="seller-line">{{consignee_address}}</div>
          <div class="seller-line"><strong>GSTIN/UIN :</strong> {{customer_gstin}}</div>
        </div>
        <div style="padding: 4px 6px; flex: 1;">
          <div class="party-title">Buyer (Bill to)</div>
          <div class="party-name">{{customer_name}}</div>
          <div class="seller-line">{{buyer_address}}</div>
          <div class="seller-line"><strong>GSTIN/UIN :</strong> {{customer_gstin}}</div>
        </div>
      </div>

      <div class="meta-box">
        <table class="meta-table">
          <tr>
            <td style="width: 50%;"><span class="meta-lbl">Credit Note No.</span><span class="meta-val">{{voucher_no}}</span></td>
            <td style="width: 50%;"><span class="meta-lbl">Dated</span><span class="meta-val">{{voucher_date}}</span></td>
          </tr>
          <tr>
            <td><span class="meta-lbl">Original Invoice No.</span><span class="meta-val">{{invoice_no}}</span></td>
            <td><span class="meta-lbl">Invoice Dated</span><span class="meta-val">{{invoice_date}}</span></td>
          </tr>
          <tr>
            <td><span class="meta-lbl">Reason</span><span class="meta-val">{{reason_label}}</span></td>
            <td><span class="meta-lbl">Ledger Account</span><span class="meta-val">{{affected_ledger}}</span></td>
          </tr>
          <tr>
            <td><span class="meta-lbl">Buyer's Order No.</span><span class="meta-val">{{po_number}}</span></td>
            <td><span class="meta-lbl">Bank</span><span class="meta-val">{{bank_label}}</span></td>
          </tr>
          <tr>
            <td colspan="2"><span class="meta-lbl">Narration</span><span class="meta-val">{{narration}}</span></td>
          </tr>
        </table>
      </div>
    </div>

    <div class="table-wrapper">
      <table class="item-table">
        <thead>
          <tr>
            <th style="width: 4%; white-space: nowrap;">Sl No.</th>
            <th style="width: 40%; white-space: nowrap;">Description of Goods</th>
            <th style="width: 10%; white-space: nowrap;">HSN/SAC</th>
            <th style="width: 10%; white-space: nowrap;">Quantity</th>
            <th style="width: 12%; white-space: nowrap;">Rate</th>
            <th style="width: 5%; white-space: nowrap;">per</th>
            <th style="width: 7%; white-space: nowrap;">GST %</th>
            <th style="width: 12%; white-space: nowrap;">Amount</th>
          </tr>
        </thead>
        <tbody>
          {{#items}}
          <tr class="item-row">
            <td style="text-align: center;">{{index}}</td>
            <td>
              {{#drawing_no}}<div class="item-code">{{drawing_no}}</div>{{/drawing_no}}
              <div class="item-desc">{{description}}</div>
            </td>
            <td style="text-align: center;">{{hsn_code}}</td>
            <td style="text-align: right; font-weight: bold; white-space: nowrap;">{{quantity}}</td>
            <td style="text-align: right; white-space: nowrap;">{{rate}}</td>
            <td style="text-align: center;">{{unit}}</td>
            <td style="text-align: center;">{{gst_percent}}</td>
            <td style="text-align: right; font-weight: bold; white-space: nowrap;">{{amount}}</td>
          </tr>
          {{/items}}

          {{#is_last_page}}
            {{#has_cgst}}
            <tr class="tax-row"><td></td><td class="lbl">Output CGST @ {{cgst_rate_str}}</td><td></td><td></td><td></td><td></td><td class="pct">{{cgst_rate_str}}</td><td class="amt">{{cgst_total}}</td></tr>
            {{/has_cgst}}
            {{#has_sgst}}
            <tr class="tax-row"><td></td><td class="lbl">Output SGST @ {{sgst_rate_str}}</td><td></td><td></td><td></td><td></td><td class="pct">{{sgst_rate_str}}</td><td class="amt">{{sgst_total}}</td></tr>
            {{/has_sgst}}
            {{#has_igst}}
            <tr class="tax-row"><td></td><td class="lbl">Output IGST @ {{igst_rate_str}}</td><td></td><td></td><td></td><td></td><td class="pct">{{igst_rate_str}}</td><td class="amt">{{igst_total}}</td></tr>
            {{/has_igst}}
            <tr class="spacer-row"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr class="total-row">
              <td></td>
              <td style="text-align: right;">Total Credit</td>
              <td></td>
              <td style="text-align: right; white-space: nowrap;">{{total_quantity}}</td>
              <td></td><td></td><td></td>
              <td style="text-align: right; white-space: nowrap;">₹ {{net_total}}</td>
            </tr>
          {{/is_last_page}}

          {{^is_last_page}}
            <tr class="spacer-row"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr class="total-row">
              <td></td>
              <td style="text-align: right; font-style: italic;">Carried Over to Page {{next_page}}</td>
              <td></td><td></td><td></td><td></td><td></td>
              <td style="text-align: right; white-space: nowrap;">₹ {{page_total_amt}}</td>
            </tr>
          {{/is_last_page}}
        </tbody>
      </table>
    </div>

    {{#is_last_page}}
    <div class="charge-box">
      <div>
        <div class="charge-lbl">Amount Credited (in words)</div>
        <div class="charge-words">{{net_total_words}}</div>
      </div>
      <div style="font-weight: bold; font-size: 8pt;">E. & O.E</div>
    </div>

    <table class="gst-table">
      <thead>
        <tr>
          <th rowspan="2" style="width: 14%;">HSN/SAC</th>
          <th rowspan="2" style="width: 16%;">Taxable Value</th>
          {{#has_igst}}<th colspan="2">Integrated Tax</th>{{/has_igst}}
          {{^has_igst}}<th colspan="2">Central Tax</th><th colspan="2">State Tax</th>{{/has_igst}}
          <th rowspan="2" style="width: 16%;">Total Tax Amount</th>
        </tr>
        <tr>
          {{#has_igst}}<th style="width: 10%;">Rate</th><th style="width: 15%;">Amount</th>{{/has_igst}}
          {{^has_igst}}<th style="width: 9%;">Rate</th><th style="width: 14%;">Amount</th><th style="width: 9%;">Rate</th><th style="width: 14%;">Amount</th>{{/has_igst}}
        </tr>
      </thead>
      <tbody>
        {{#tax_summary}}
        <tr>
          <td>{{hsn_code}}</td>
          <td class="num">{{taxable_value}}</td>
          {{#has_igst}}<td>{{igst_rate}}</td><td class="num">{{igst_amount}}</td>{{/has_igst}}
          {{^has_igst}}<td>{{central_rate}}</td><td class="num">{{central_amount}}</td><td>{{state_rate}}</td><td class="num">{{state_amount}}</td>{{/has_igst}}
          <td class="num" style="font-weight: bold;">{{total_tax}}</td>
        </tr>
        {{/tax_summary}}
        <tr style="font-weight: bold;">
          <td style="text-align: right;">Total</td>
          <td class="num">{{subtotal}}</td>
          {{#has_igst}}<td></td><td class="num">{{igst_total}}</td>{{/has_igst}}
          {{^has_igst}}<td></td><td class="num">{{cgst_total}}</td><td></td><td class="num">{{sgst_total}}</td>{{/has_igst}}
          <td class="num">{{tax_total_summary}}</td>
        </tr>
      </tbody>
    </table>

    <div class="tax-words-box">
      <strong>Tax Amount (in words) : </strong> <span>{{tax_total_words}}</span>
    </div>
    {{/is_last_page}}

    <div class="footer-flex">
      <div class="decl-box">
        <strong>Declaration:</strong><br/>
        We declare that this credit note is issued against the original invoice stated above and that all particulars are true and correct.
        {{^is_last_page}}<br/><em>(Continued on Page {{next_page}}...)</em>{{/is_last_page}}
      </div>
      <div class="sig-box-right">
        <div><strong>for {{hostCompanyName}}</strong></div>
        {{#signatureBase64}}<div style="margin-top: 2px; margin-bottom: 2px;"><img src="{{signatureBase64}}" style="max-height: 28px;" /></div>{{/signatureBase64}}
        {{^signatureBase64}}<div style="margin-top: 20px;"></div>{{/signatureBase64}}
        <div style="font-size: 7.2pt; font-weight: bold;">Authorised Signatory</div>
      </div>
    </div>

    <div class="computer-msg">This is a Computer Generated Credit Note{{#show_page_number}} — Page {{page_number}} of {{total_pages}}{{/show_page_number}}</div>
  </div>
  {{/pages}}
</body>
</html>
`;

const generateCreditNotePDF = async (creditNoteId, copyType = 'Original for Recipient') => {
  const [rows] = await pool.query(
    `SELECT cn.*, c.company_name AS customer_name, c.gstin AS company_gstin,
            si.invoice_no, si.invoice_date, si.billing_address, si.shipping_address,
            si.gstin AS invoice_gstin, si.customer_po_no, si.host_company_id,
            o.host_company_id AS order_host_company_id,
            ba.bank_name, ba.account_number AS bank_account_number
     FROM credit_notes cn
     JOIN companies c ON c.id = cn.customer_id
     LEFT JOIN sales_invoices si ON si.id = cn.sales_invoice_id
     LEFT JOIN orders o ON o.id = si.order_id
     LEFT JOIN bank_accounts ba ON ba.id = cn.bank_account_id
     WHERE cn.id = ?`,
    [creditNoteId]
  );
  if (rows.length === 0) {
    const error = new Error('Credit note not found');
    error.status = 404;
    throw error;
  }
  const cn = rows[0];

  const [items] = await pool.query(
    `SELECT cni.*, sii.hsn_code
     FROM credit_note_items cni
     LEFT JOIN sales_invoice_items sii ON sii.id = cni.sales_invoice_item_id
     WHERE cni.credit_note_id = ?
     ORDER BY cni.id`,
    [cn.id]
  );

  // On-account credit notes have no invoice address – fall back to the customer's saved address
  let customerAddress = '';
  if (!cn.billing_address && !cn.shipping_address) {
    const [addr] = await pool.query(
      `SELECT line1, line2, city, state, pincode FROM company_addresses WHERE company_id = ?
       ORDER BY (address_type = 'BILLING') DESC, id LIMIT 1`,
      [cn.customer_id]
    );
    if (addr.length) {
      const a = addr[0];
      customerAddress = [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ');
    }
  }

  const activeCompany = await getHostCompany(cn.host_company_id || cn.order_host_company_id);
  const hostCompanyName = activeCompany?.company_name || 'SP TECHPIONEER PRIVATE LIMITED';
  const rawAddressLines = (activeCompany?.company_address || 'Plot No. 97, Sector 7,\nPCNTDA, Bhosari, Pune - 26')
    .split('\n').map(l => l.trim().replace(/\r/g, '')).filter(Boolean);
  let hostCompanyAddressLines = rawAddressLines.filter(line => {
    const l = line.toLowerCase();
    return !l.includes('code:') && !l.includes('code :') && !l.startsWith('gst') && !l.startsWith('state');
  });
  if (hostCompanyName.toUpperCase().includes('S.P.') || rawAddressLines.some(l => l.includes('Sector No 7') || l.includes('Plot No 97'))) {
    hostCompanyAddressLines = ['Sector No 7,Plot No 97 ,PCNTDA , Bhosari', 'Pune - 411026  ,Maharashtra'];
  }

  let signatureBase64 = null;
  if (activeCompany && activeCompany.authorized_signature) {
    const fs = require('fs');
    const path = require('path');
    const signaturePath = path.join(__dirname, '../../', activeCompany.authorized_signature);
    if (fs.existsSync(signaturePath)) {
      signatureBase64 = `data:image/png;base64,${fs.readFileSync(signaturePath).toString('base64')}`;
    }
  }

  const isInter = cn.gst_type === 'INTER';
  const cgstTotal = parseFloat(cn.cgst_amount) || 0;
  const sgstTotal = parseFloat(cn.sgst_amount) || 0;
  const igstTotal = parseFloat(cn.igst_amount) || 0;
  const taxableTotal = parseFloat(cn.taxable_amount) || 0;
  const netTotal = parseFloat(cn.total_amount) || 0;
  const gstRate = Math.max(0, ...items.map(it => parseFloat(it.gst_percent) || 0));

  // Per-HSN GST summary from the stored line amounts
  const taxMap = new Map();
  let totalQty = 0;
  let defaultUnit = 'Nos';
  const formattedItems = items.map((it, idx) => {
    const isItemLine = Boolean(it.sales_invoice_item_id);
    const qty = parseFloat(it.quantity) || 0;
    const gstPct = parseFloat(it.gst_percent) || 0;
    const taxable = parseFloat(it.taxable_amount) || 0;
    const gstAmt = parseFloat(it.gst_amount) || 0;
    const hsn = it.hsn_code || (isItemLine ? '84779000' : '—');
    if (isItemLine) {
      totalQty += qty;
      defaultUnit = it.unit || defaultUnit;
    }

    if (!taxMap.has(hsn)) {
      taxMap.set(hsn, { hsn_code: hsn, taxable: 0, gst: 0, rate: gstPct });
    }
    const entry = taxMap.get(hsn);
    entry.taxable += taxable;
    entry.gst += gstAmt;

    return {
      index: idx + 1,
      drawing_no: it.drawing_no || it.item_code || '',
      description: it.description || '',
      hsn_code: isItemLine ? hsn : '',
      quantity: isItemLine ? `${qty.toFixed(3)} ${it.unit || 'Nos'}` : '',
      unit: isItemLine ? (it.unit || 'Nos') : '',
      rate: isItemLine ? formatCurrency(it.rate) : '',
      gst_percent: gstPct > 0 ? rateStr(gstPct) : '',
      amount: formatCurrency(taxable),
      amount_num: taxable
    };
  });

  const taxSummary = Array.from(taxMap.values()).map(t => {
    const half = Math.round((t.gst / 2) * 100) / 100;
    return {
      hsn_code: t.hsn_code,
      taxable_value: formatCurrency(t.taxable),
      central_rate: !isInter && t.rate > 0 ? rateStr(t.rate / 2) : '—',
      central_amount: formatCurrency(isInter ? 0 : half),
      state_rate: !isInter && t.rate > 0 ? rateStr(t.rate / 2) : '—',
      state_amount: formatCurrency(isInter ? 0 : t.gst - half),
      igst_rate: isInter && t.rate > 0 ? rateStr(t.rate) : '—',
      igst_amount: formatCurrency(isInter ? t.gst : 0),
      total_tax: formatCurrency(t.gst)
    };
  });

  const chunks = [];
  for (let i = 0; i < formattedItems.length; i += ITEMS_PER_PAGE) chunks.push(formattedItems.slice(i, i + ITEMS_PER_PAGE));
  if (chunks.length === 0) chunks.push([]);
  const totalPages = chunks.length;
  const pages = chunks.map((chunk, idx) => ({
    page_number: idx + 1,
    next_page: idx + 2,
    total_pages: totalPages,
    is_last_page: idx + 1 === totalPages,
    show_page_number: totalPages > 1,
    items: chunk,
    page_total_amt: formatCurrency(chunk.reduce((s, it) => s + it.amount_num, 0))
  }));
  const copyPages = resolveCopyTypes(copyType).flatMap(copy => pages.map(p => ({ ...p, copy_type: copy })));

  const customerGstin = cn.invoice_gstin || cn.company_gstin || 'N/A';
  const totalTax = cgstTotal + sgstTotal + igstTotal;
  const viewData = {
    pages: copyPages,
    is_cancelled: cn.status === 'CANCELLED',
    voucher_no: cn.voucher_no,
    voucher_date: formatDate(cn.voucher_date),
    invoice_no: cn.invoice_no || cn.reference_invoice_no || 'On Account',
    invoice_date: formatDate(cn.invoice_date),
    reason_label: CREDIT_NOTE_REASONS[cn.reason] || cn.reason,
    affected_ledger: cn.affected_ledger || '',
    po_number: cn.customer_po_no || '',
    bank_label: cn.bank_name ? `${cn.bank_name}${cn.bank_account_number ? ` (A/c ${cn.bank_account_number})` : ''}` : '',
    narration: cn.narration || '',

    hostCompanyName,
    hostCompanyAddressLines,
    hostGSTIN: (activeCompany?.gstin || '27ANRPP4356J1ZA').toUpperCase(),
    hostStateName: activeCompany?.state || 'Maharashtra',
    signatureBase64,

    customer_name: cn.customer_name,
    customer_gstin: customerGstin,
    consignee_address: cn.shipping_address || cn.billing_address || customerAddress,
    buyer_address: cn.billing_address || cn.shipping_address || customerAddress,

    has_cgst: !isInter && cgstTotal > 0,
    cgst_rate_str: rateStr(gstRate / 2),
    cgst_total: formatCurrency(cgstTotal),
    has_sgst: !isInter && sgstTotal > 0,
    sgst_rate_str: rateStr(gstRate / 2),
    sgst_total: formatCurrency(sgstTotal),
    has_igst: isInter && igstTotal > 0,
    igst_rate_str: rateStr(gstRate),
    igst_total: formatCurrency(igstTotal),

    total_quantity: totalQty > 0 ? `${totalQty.toFixed(3)} ${defaultUnit}` : '',
    net_total: formatCurrency(netTotal),
    net_total_words: numberToWords(netTotal),
    subtotal: formatCurrency(taxableTotal),
    tax_summary: taxSummary,
    tax_total_summary: formatCurrency(totalTax),
    tax_total_words: numberToWords(totalTax)
  };

  const mustache = require('mustache');
  const puppeteer = require('puppeteer');
  const html = mustache.render(htmlTemplate, viewData);

  try {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();
    return { pdf, voucherNo: cn.voucher_no };
  } catch (error) {
    console.error('[Credit Note PDF Generation] Puppeteer error:', error.message);
    throw new Error('PDF generation unavailable: ' + error.message);
  }
};

module.exports = { generateCreditNotePDF };
