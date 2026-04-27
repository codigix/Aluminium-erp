const path = require('path');
const mustache = require('mustache');
const puppeteer = require('puppeteer');
const pool = require('../config/db');
const bomService = require('./bomService');

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
      projectName,
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
        (company_id, project_name, po_number, po_date, po_version, order_type, plant, currency, payment_terms,
         credit_days, freight_terms, packing_forwarding, insurance_terms, delivery_terms, status,
         pdf_path, subtotal, tax_total, net_total, remarks, terms_and_conditions, special_notes,
         inspection_clause, test_certificate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ,
      [
        companyId,
        projectName || null,
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
      const [itemResult] = await connection.execute(
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

      const poItemId = itemResult.insertId;

      if (item.sub_assemblies && Array.isArray(item.sub_assemblies)) {
        for (const sa of item.sub_assemblies) {
          await connection.execute(
            `INSERT INTO customer_po_item_subassemblies
              (po_item_id, drawing_no, description, quantity, unit, rate)
             VALUES (?, ?, ?, ?, ?, ?)`
            ,
            [
              poItemId,
              sa.drawingNo || null,
              sa.description || null,
              sa.quantity || 0,
              sa.unit || 'NOS',
              sa.rate || 0
            ]
          );
        }
      }
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
           COALESCE(cp.project_name, (SELECT project_name FROM sales_orders WHERE customer_po_id = cp.id LIMIT 1)) as project_name,
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

  const enrichedItems = await Promise.all(items.map(async (item) => {
    // 1. Try to fetch stored sub-assemblies first (as a snapshot)
    const [storedSA] = await pool.query(
      `SELECT drawing_no as drawingNo, description, quantity, unit, rate 
       FROM customer_po_item_subassemblies 
       WHERE po_item_id = ?`,
      [item.id]
    );

    if (storedSA.length > 0) {
      return { ...item, sub_assemblies: storedSA };
    }

    // 2. Fallback to dynamic BOM fetching for older records
    const isFG = (item.item_code || '').startsWith('FG-') || 
                 (item.drawing_no && item.drawing_no !== '—');
    
    if (isFG) {
      const sub_assemblies = await bomService.getItemComponents(null, item.item_code, item.drawing_no);
      return { 
        ...item, 
        sub_assemblies: sub_assemblies.map(sa => ({
          drawingNo: sa.drawing_no || sa.component_code,
          description: sa.description,
          quantity: sa.quantity || sa.qty,
          unit: sa.unit || sa.uom || 'Nos',
          rate: sa.rate || sa.selling_rate || 0
        }))
      };
    }
    return item;
  }));

  return { ...rows[0], items: enrichedItems };
};

const updateCustomerPo = async (id, payload) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const {
      projectName,
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
       SET project_name = ?, po_number = ?, po_date = ?, po_version = ?, order_type = ?, plant = ?, currency = ?, 
           payment_terms = ?, credit_days = ?, freight_terms = ?, packing_forwarding = ?, 
           insurance_terms = ?, delivery_terms = ?, subtotal = ?, tax_total = ?, net_total = ?, 
           remarks = ?, terms_and_conditions = ?, special_notes = ?, inspection_clause = ?, 
           test_certificate = ?
       WHERE id = ?`
      ,
      [
        projectName || null,
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
      const [itemResult] = await connection.execute(
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

      const poItemId = itemResult.insertId;

      if (item.sub_assemblies && Array.isArray(item.sub_assemblies)) {
        for (const sa of item.sub_assemblies) {
          await connection.execute(
            `INSERT INTO customer_po_item_subassemblies
              (po_item_id, drawing_no, description, quantity, unit, rate)
             VALUES (?, ?, ?, ?, ?, ?)`
            ,
            [
              poItemId,
              sa.drawingNo || null,
              sa.description || null,
              sa.quantity || 0,
              sa.unit || 'NOS',
              sa.rate || 0
            ]
          );
        }
      }
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
    
    // Find linked sales orders
    const [soRows] = await connection.execute('SELECT id FROM sales_orders WHERE customer_po_id = ?', [id]);
    
    for (const so of soRows) {
      // Find and delete related production plans, work orders, and job cards
      const [planRows] = await connection.execute('SELECT id FROM production_plans WHERE sales_order_id = ?', [so.id]);
      for (const plan of planRows) {
        // Delete job cards linked via work orders
        await connection.execute(
          `DELETE FROM job_cards 
           WHERE work_order_id IN (SELECT id FROM work_orders WHERE plan_id = ?)`,
          [plan.id]
        );
        // Delete work orders
        await connection.execute('DELETE FROM work_orders WHERE plan_id = ?', [plan.id]);
        
        // Delete material requests linked to this plan
        await connection.execute('DELETE FROM material_request_items WHERE mr_id IN (SELECT id FROM material_requests WHERE plan_id = ?)', [plan.id]);
        await connection.execute('DELETE FROM material_requests WHERE plan_id = ?', [plan.id]);

        // Delete production plan (cascades to production_plan_items, materials, operations, etc. in many schemas)
        await connection.execute('DELETE FROM production_plans WHERE id = ?', [plan.id]);
      }

      // Find sales order items to clean up their BOM components
      const [soiRows] = await connection.execute('SELECT id FROM sales_order_items WHERE sales_order_id = ?', [so.id]);
      for (const soi of soiRows) {
        await connection.execute('DELETE FROM sales_order_item_materials WHERE sales_order_item_id = ?', [soi.id]);
        await connection.execute('DELETE FROM sales_order_item_components WHERE sales_order_item_id = ?', [soi.id]);
        await connection.execute('DELETE FROM sales_order_item_operations WHERE sales_order_item_id = ?', [soi.id]);
        await connection.execute('DELETE FROM sales_order_item_scrap WHERE sales_order_item_id = ?', [soi.id]);
      }

      // Delete linked sales order items
      await connection.execute('DELETE FROM sales_order_items WHERE sales_order_id = ?', [so.id]);
      // Delete the sales order
      await connection.execute('DELETE FROM sales_orders WHERE id = ?', [so.id]);
    }

    // Also check for direct orders in the new system linked to this PO (if any)
    const [orderRows] = await connection.execute('SELECT id FROM orders WHERE quotation_id IN (SELECT id FROM sales_orders WHERE customer_po_id = ?)', [id]);
    for (const order of orderRows) {
       // Cleanup production plans for direct orders
       const [planRows] = await connection.execute('SELECT id FROM production_plans WHERE sales_order_id = ?', [order.id]);
       for (const plan of planRows) {
         await connection.execute(`DELETE FROM job_cards WHERE work_order_id IN (SELECT id FROM work_orders WHERE plan_id = ?)`, [plan.id]);
         await connection.execute('DELETE FROM work_orders WHERE plan_id = ?', [plan.id]);
         await connection.execute('DELETE FROM material_request_items WHERE mr_id IN (SELECT id FROM material_requests WHERE plan_id = ?)', [plan.id]);
         await connection.execute('DELETE FROM material_requests WHERE plan_id = ?', [plan.id]);
         await connection.execute('DELETE FROM production_plans WHERE id = ?', [plan.id]);
       }
       // Note: order_items usually don't have separate BOM tables like sales_order_items yet, 
       // they often link back to sales_order_items for BOM.
       await connection.execute('DELETE FROM order_items WHERE order_id = ?', [order.id]);
       await connection.execute('DELETE FROM orders WHERE id = ?', [order.id]);
    }

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
        body { font-family: 'roboto', sans-serif; color: #333; line-height: 1.4; margin: 20px; font-size: 11px; }
        .main-container { border: 1.5px solid #000; padding: 0; }
        .header-title { text-align: center; border-bottom: 1.5px solid #000; padding: 10px; font-size: 18px; font-weight: bold; text-transform: ; }
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
                  <div style="font-weight: bold; font-size: 10px;">{{description}}</div>
                  {{#drawing_no}}<div style="font-size: 8px; color: #666;">DRW: {{drawing_no}}</div>{{/drawing_no}}
                </td>
                <td style="text-align: center; border-right: 1.5px solid #000;">{{quantity}}</td>
                <td style="text-align: right; border-right: 1.5px solid #000;">{{rate}}</td>
                <td style="text-align: right;">{{basic_amount}}</td>
              </tr>
              {{#sub_assemblies}}
              <tr style="background-color: #f9f9f9; font-size: 9px;">
                <td style="border-right: 1.5px solid #000;"></td>
                <td style="border-right: 1.5px solid #000; padding-left: 20px;">
                  <div style="color: #444;">↳ {{description}} ({{drawingNo}}) <span style="font-size: 7px; background: #eee; padding: 1px 3px; border-radius: 2px;">SA</span></div>
                </td>
                <td style="text-align: center; border-right: 1.5px solid #000;">{{displayQuantity}}</td>
                <td style="text-align: right; border-right: 1.5px solid #000;">{{displayRate}}</td>
                <td style="text-align: right;">{{displayTotal}}</td>
              </tr>
              {{/sub_assemblies}}
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
      basic_amount: parseFloat(i.basic_amount).toFixed(0),
      sub_assemblies: (i.sub_assemblies || []).map(sa => {
        const saQty = (parseFloat(sa.quantity || 0) * (parseFloat(i.quantity) || 0));
        const saRate = parseFloat(sa.rate || 0);
        return {
          ...sa,
          displayQuantity: saQty.toFixed(3),
          displayRate: saRate.toFixed(2),
          displayTotal: (saQty * saRate).toFixed(2)
        };
      })
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
