const path = require('path');
const mustache = require('mustache');
const puppeteer = require('puppeteer');
const pool = require('../config/db');

const calculateAmounts = items => {
  let subtotal = 0;
  let taxTotal = 0;
  for (const item of items) {
    const basic = Number(item.quantity || 0) * Number(item.rate || 0);
    const cgstAmount = basic * (Number(item.cgstPercent || 0) / 100);
    const sgstAmount = basic * (Number(item.sgstPercent || 0) / 100);
    const igstAmount = basic * (Number(item.igstPercent || 0) / 100);
    subtotal += basic;
    taxTotal += cgstAmount + sgstAmount + igstAmount;
    item.basicAmount = basic;
    item.cgstAmount = cgstAmount;
    item.sgstAmount = sgstAmount;
    item.igstAmount = igstAmount;
  }
  return { subtotal, taxTotal, netTotal: subtotal + taxTotal };
};

const createCustomerPo = async payload => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const {
      companyId,
      header = {},
      items = [],
      pdfFile,
      remarks,
      termsAndConditions,
      specialNotes,
      inspectionClause,
      testCertificate
    } = payload;

    const totals = calculateAmounts(items);

    const [poResult] = await connection.execute(
      `INSERT INTO customer_pos
        (company_id, po_number, po_date, po_version, order_type, plant, currency, payment_terms,
         credit_days, freight_terms, packing_forwarding, insurance_terms, delivery_terms, status,
         pdf_path, subtotal, tax_total, net_total, remarks, terms_and_conditions, special_notes,
         inspection_clause, test_certificate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ,
      [
        companyId,
        header.poNumber || null,
        header.poDate || null,
        header.poVersion || '1.0',
        header.orderType || 'STANDARD',
        header.plant || null,
        header.currency || 'INR',
        header.paymentTerms || null,
        header.creditDays ? Number(header.creditDays) : null,
        header.freightTerms || null,
        header.packingForwarding || null,
        header.insuranceTerms || null,
        header.deliveryTerms || null,
        'DRAFT',
        pdfFile ? path.relative(process.cwd(), pdfFile) : null,
        totals.subtotal,
        totals.taxTotal,
        totals.netTotal,
        remarks || null,
        termsAndConditions || null,
        specialNotes || null,
        inspectionClause || null,
        testCertificate || null
      ]
    );

    const customerPoId = poResult.insertId;

    for (const item of items) {
      await connection.execute(
        `INSERT INTO customer_po_items
          (customer_po_id, item_code, description, hsn_code, drawing_no, revision_no, quantity,
           unit, rate, basic_amount, discount, cgst_percent, cgst_amount, sgst_percent, sgst_amount,
           igst_percent, igst_amount, delivery_date, purchase_req_no, customer_reference)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ,
        [
          customerPoId,
          item.itemCode || null,
          item.description,
          item.hsnCode || null,
          item.drawingNo || null,
          item.revisionNo || null,
          item.quantity,
          item.unit || 'NOS',
          item.rate,
          item.basicAmount,
          item.discount || 0,
          item.cgstPercent || 0,
          item.cgstAmount,
          item.sgstPercent || 0,
          item.sgstAmount,
          item.igstPercent || 0,
          item.igstAmount,
          item.deliveryDate || null,
          item.purchaseReqNo || null,
          item.customerReference || null
        ]
      );
    }

    await connection.commit();

    return { customerPoId, totals };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const listCustomerPos = async (filters = {}) => {
  let query = `
    SELECT cp.*, c.company_name, 
           (SELECT SUM(quantity) FROM customer_po_items WHERE customer_po_id = cp.id) as total_qty
    FROM customer_pos cp
    JOIN companies c ON c.id = cp.company_id
    WHERE 1=1
  `;
  const params = [];

  if (filters.companyId) {
    query += ' AND cp.company_id = ?';
    params.push(filters.companyId);
  }

  query += ' ORDER BY cp.created_at DESC';

  const [rows] = await pool.query(query, params);
  return rows;
};

const getCustomerPoById = async id => {
  const [rows] = await pool.query(
    `SELECT cp.*, c.company_name, c.customer_type, c.gstin, c.cin, c.pan
     FROM customer_pos cp
     JOIN companies c ON c.id = cp.company_id
     WHERE cp.id = ?`,
    [id]
  );
  if (!rows.length) {
    return null;
  }
  const [items] = await pool.query(
    `SELECT id, item_code, drawing_no, description, quantity, unit, rate, basic_amount, discount, cgst_percent, sgst_percent, igst_percent, delivery_date
     FROM customer_po_items
     WHERE customer_po_id = ?
     ORDER BY id ASC`,
    [id]
  );
  return { ...rows[0], items };
};

const updateCustomerPo = async (id, payload) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const {
      header = {},
      items = [],
      remarks,
      termsAndConditions,
      specialNotes,
      inspectionClause,
      testCertificate
    } = payload;

    const totals = calculateAmounts(items);

    await connection.execute(
      `UPDATE customer_pos
       SET po_number = ?, po_date = ?, po_version = ?, order_type = ?, plant = ?, currency = ?, 
           payment_terms = ?, credit_days = ?, freight_terms = ?, packing_forwarding = ?, 
           insurance_terms = ?, delivery_terms = ?, subtotal = ?, tax_total = ?, net_total = ?, 
           remarks = ?, terms_and_conditions = ?, special_notes = ?, inspection_clause = ?, 
           test_certificate = ?
       WHERE id = ?`
      ,
      [
        header.poNumber || null,
        header.poDate || null,
        header.poVersion || '1.0',
        header.orderType || 'STANDARD',
        header.plant || null,
        header.currency || 'INR',
        header.paymentTerms || null,
        header.creditDays ? Number(header.creditDays) : null,
        header.freightTerms || null,
        header.packingForwarding || null,
        header.insuranceTerms || null,
        header.deliveryTerms || null,
        totals.subtotal,
        totals.taxTotal,
        totals.netTotal,
        remarks || null,
        termsAndConditions || null,
        specialNotes || null,
        inspectionClause || null,
        testCertificate || null,
        id
      ]
    );

    // Delete existing items and re-insert
    await connection.execute('DELETE FROM customer_po_items WHERE customer_po_id = ?', [id]);

    for (const item of items) {
      await connection.execute(
        `INSERT INTO customer_po_items
          (customer_po_id, item_code, description, hsn_code, drawing_no, revision_no, quantity,
           unit, rate, basic_amount, discount, cgst_percent, cgst_amount, sgst_percent, sgst_amount,
           igst_percent, igst_amount, delivery_date, purchase_req_no, customer_reference)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ,
        [
          id,
          item.itemCode || null,
          item.description,
          item.hsnCode || null,
          item.drawingNo || null,
          item.revisionNo || null,
          item.quantity,
          item.unit || 'NOS',
          item.rate,
          item.basicAmount,
          item.discount || 0,
          item.cgstPercent || 0,
          item.cgstAmount,
          item.sgstPercent || 0,
          item.sgstAmount,
          item.igstPercent || 0,
          item.igstAmount,
          item.deliveryDate || null,
          item.purchaseReqNo || null,
          item.customerReference || null
        ]
      );
    }

    await connection.commit();
    return { id, totals };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const deleteCustomerPo = async id => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Delete items first
    await connection.execute('DELETE FROM customer_po_items WHERE customer_po_id = ?', [id]);
    
    // Delete linked sales order items and sales order
    const [soRows] = await connection.execute('SELECT id FROM sales_orders WHERE customer_po_id = ?', [id]);
    for (const so of soRows) {
      await connection.execute('DELETE FROM sales_order_items WHERE sales_order_id = ?', [so.id]);
    }
    await connection.execute('DELETE FROM sales_orders WHERE customer_po_id = ?', [id]);

    // Delete the PO
    const [result] = await connection.execute('DELETE FROM customer_pos WHERE id = ?', [id]);

    await connection.commit();
    return result.affectedRows > 0;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const generateCustomerPoPDF = async poId => {
  const po = await getCustomerPoById(poId);
  if (!po) throw new Error('Customer PO not found');

  const htmlTemplate = `
    <html>
    <head>
      <style>
        body { font-family: 'Inter', system-ui, Avenir, Helvetica, Arial, sans-serif; color: #333; line-height: 1.4; margin: 20px; font-size: 11px; }
        .main-container { border: 1.5px solid #000; padding: 0; }
        .header-title { text-align: center; border-bottom: 1.5px solid #000; padding: 10px; font-size: 18px; font-weight: bold; text-transform: uppercase; }
        .company-name { text-align: center; border-bottom: 1.5px solid #000; padding: 5px; font-size: 22px; font-weight: bold; color: #666; }
        
        .info-section { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1.5px solid #000; }
        .info-box { padding: 8px; border-right: 1.5px solid #000; }
        .info-box:last-child { border-right: none; }
        .label { font-weight: bold; margin-bottom: 4px; display: block; }
        
        .po-details { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1.5px solid #000; }
        .po-box { padding: 8px; border-right: 1.5px solid #000; }
        .po-box:last-child { border-right: none; }

        table { width: 100%; border-collapse: collapse; }
        th { border-bottom: 1.5px solid #000; border-right: 1.5px solid #000; padding: 6px; background: #fff; font-weight: bold; text-align: center; }
        td { border-bottom: 1px solid #ccc; border-right: 1.5px solid #000; padding: 6px; vertical-align: top; }
        th:last-child, td:last-child { border-right: none; }
        
        .item-table { border-bottom: 1.5px solid #000; min-height: 300px; }
        
        .summary-section { display: grid; grid-template-columns: 1fr 240px; border-bottom: 1.5px solid #000; }
        .notes-box { padding: 10px; border-right: 1.5px solid #000; position: relative; }
        .totals-box { }
        .total-row { display: grid; grid-template-columns: 1fr 100px; border-bottom: 1px solid #000; }
        .total-row:last-child { border-bottom: none; font-weight: bold; font-size: 13px; }
        .total-label { padding: 8px; text-align: right; border-right: 1px solid #000; font-weight: bold; }
        .total-value { padding: 8px; text-align: right; }

        .footer-company { padding: 40px 20px 20px; text-align: right; font-weight: bold; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="main-container">
        <div class="header-title">Purchase Order</div>
        <div class="company-name">S. P. INDUSTRIES</div>
        
        <div class="info-section">
          <div class="info-box" style="min-height: 100px;">
            <span class="label">TO</span>
            <div style="font-weight: bold; font-size: 13px; margin-bottom: 5px;">{{company_name}}</div>
            {{#billing_address}}<div style="font-size: 10px; max-width: 250px;">{{billing_address}}</div>{{/billing_address}}
          </div>
          <div class="info-box">
            <span class="label">From</span>
            <div style="font-weight: bold;">SP INDUSTRIES PVT.LTD.</div>
            <div style="font-size: 9px;">PLOT NO. 97, SECT. 7, PCNTDA,</div>
            <div style="font-size: 9px;">Bhosari, Pune - 411 026,</div>
            <div style="font-size: 10px; margin-top: 5px;">Supplier Code - {{supplier_code}}</div>
            <div style="font-size: 10px;">Indend No - {{indent_no}}</div>
            <div style="font-size: 10px;">Quotation Ref - {{quotation_ref}}</div>
          </div>
        </div>

        <div class="po-details" style="grid-template-columns: 1.2fr 0.8fr;">
          <div class="po-box" style="border-right: 1.5px solid #000;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="label" style="margin: 0;">PO No</span>
              <div style="font-weight: bold; font-size: 12px;">{{po_number}}</div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px;">
              <span class="label" style="margin: 0; opacity: 0;">Date</span>
              <div style="font-weight: bold;">{{po_date}}</div>
            </div>
          </div>
          <div class="po-box" style="border-right: none;">
            <!-- Placeholder for alignment as per JPEG -->
          </div>
        </div>

        <div style="padding: 8px; border-bottom: 1.5px solid #000; font-style: italic;">
          Dear sir,<br>
          We hereby ask you to delivery the following goods in accordance with our terms of delivery
        </div>

        <div class="item-table">
          <table>
            <thead>
              <tr>
                <th style="width: 50px;">SR NO</th>
                <th>Description</th>
                <th style="width: 60px;">Qty</th>
                <th style="width: 80px;">Rate</th>
                <th style="width: 100px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              {{#items}}
              <tr>
                <td style="text-align: center; border-right: 1.5px solid #000;">{{index}}</td>
                <td style="border-right: 1.5px solid #000;">
                  <div style="font-weight: normal; font-size: 10px;">{{description}}</div>
                </td>
                <td style="text-align: center; border-right: 1.5px solid #000;">{{quantity}}</td>
                <td style="text-align: right; border-right: 1.5px solid #000;">{{rate}}</td>
                <td style="text-align: right;">{{basic_amount}}</td>
              </tr>
              {{/items}}
              {{#empty_rows}}
              <tr style="height: 22px;">
                <td style="border-right: 1.5px solid #000;"></td>
                <td style="border-right: 1.5px solid #000;"></td>
                <td style="border-right: 1.5px solid #000;"></td>
                <td style="border-right: 1.5px solid #000;"></td>
                <td></td>
              </tr>
              {{/empty_rows}}
            </tbody>
          </table>
        </div>

        <div class="summary-section">
          <div class="notes-box">
            {{#remarks}}
            <span class="label" style="text-decoration: underline;">Remarks:</span>
            <div style="font-size: 10px; margin-top: 5px;">{{remarks}}</div>
            {{/remarks}}
          </div>
          <div class="totals-box">
            <div class="total-row">
              <div class="total-label">Taxable Amt</div>
              <div class="total-value">{{subtotal}}</div>
            </div>
            <div class="total-row">
              <div class="total-label">CGST 9%</div>
              <div class="total-value">{{cgst_total}}</div>
            </div>
            <div class="total-row">
              <div class="total-label">SGST 9%</div>
              <div class="total-value">{{sgst_total}}</div>
            </div>
            <div class="total-row">
              <div class="total-label" style="font-size: 14px;">Total</div>
              <div class="total-value" style="font-size: 14px;">{{net_total}}</div>
            </div>
          </div>
        </div>

        <div class="footer-company">
          SP INDUSTRIES
        </div>
      </div>
    </body>
    </html>
  `;

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.') : '—';

  const viewData = {
    ...po,
    po_date: formatDate(po.po_date),
    subtotal: parseFloat(po.subtotal || 0).toFixed(0),
    cgst_total: parseFloat(po.tax_total / 2 || 0).toFixed(2),
    sgst_total: parseFloat(po.tax_total / 2 || 0).toFixed(2),
    net_total: Math.round(po.net_total || 0),
    items: (po.items || []).map((i, idx) => ({
      ...i,
      index: idx + 1,
      quantity: parseFloat(i.quantity).toFixed(0),
      rate: parseFloat(i.rate).toFixed(0),
      basic_amount: parseFloat(i.basic_amount).toFixed(0)
    })),
    empty_rows: Array.from({ length: Math.max(0, 15 - (po.items || []).length) })
  };

  const html = mustache.render(htmlTemplate, viewData);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({ 
    format: 'A4', 
    printBackground: true,
    margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
  });
  await browser.close();

  return pdf;
};

module.exports = {
  createCustomerPo,
  listCustomerPos,
  getCustomerPoById,
  updateCustomerPo,
  deleteCustomerPo,
  generateCustomerPoPDF
};
