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
    if (n >= 10000000) {
      words += convert(Math.floor(n / 10000000)) + ' Crore ';
      n %= 10000000;
    }
    if (n >= 100000) {
      words += convert(Math.floor(n / 100000)) + ' Lakh ';
      n %= 100000;
    }
    if (n >= 1000) {
      words += convert(Math.floor(n / 1000)) + ' Thousand ';
      n %= 1000;
    }
    words += convert(n);
    return words.trim();
  };

  const amount = Math.floor(num);
  const paisa = Math.round((num - amount) * 100);
  
  let result = 'INR ' + formatWords(amount) + ' Only';
  if (paisa > 0) {
    result = 'INR ' + formatWords(amount) + ' and ' + formatWords(paisa) + ' Paisa Only';
  }
  return result;
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
              (po_item_id, drawing_no, description, quantity, unit, rate, hsn_code, delivery_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ,
            [
              poItemId,
              sa.drawingNo || null,
              sa.description || null,
              sa.quantity || 0,
              sa.unit || 'NOS',
              sa.rate || 0,
              sa.hsn_code || null,
              sa.delivery_date || null
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
           (SELECT SUM(quantity) FROM customer_po_items WHERE customer_po_id = cp.id) as total_qty,
           (SELECT email FROM contacts WHERE company_id = c.id ORDER BY contact_type = 'PRIMARY' DESC, id ASC LIMIT 1) as company_email
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
    `SELECT cp.*, c.company_name, c.customer_type, c.gstin, c.cin, c.pan,
            ba.line1 as billing_address_line1, ba.line2 as billing_address_line2, 
            ba.city as billing_city, ba.state as billing_state, ba.pincode as billing_pincode,
            (SELECT email FROM contacts WHERE company_id = c.id ORDER BY contact_type = 'PRIMARY' DESC, id ASC LIMIT 1) as company_email
     FROM customer_pos cp
     JOIN companies c ON c.id = cp.company_id
     LEFT JOIN company_addresses ba ON ba.company_id = c.id AND ba.address_type = 'BILLING'
     WHERE cp.id = ?`,
    [id]
  );
  if (!rows.length) {
    return null;
  }
  
  // Format billing address string
  const po = rows[0];
  let addrParts = [
    po.billing_address_line1,
    po.billing_address_line2,
    po.billing_city,
    po.billing_state,
    po.billing_pincode ? `Pincode: ${po.billing_pincode}` : null
  ].filter(part => part && String(part).trim() !== '' && String(part).toUpperCase() !== 'N/A');

  if (addrParts.length === 0) {
    // Fallback: try to get any address for this company if billing address is missing
    const [anyAddress] = await pool.query(
      'SELECT line1, line2, city, state, pincode FROM company_addresses WHERE company_id = ? LIMIT 1',
      [po.company_id]
    );
    if (anyAddress.length > 0) {
      const addr = anyAddress[0];
      addrParts = [
        addr.line1,
        addr.line2,
        addr.city,
        addr.state,
        addr.pincode ? `Pincode: ${addr.pincode}` : null
      ].filter(part => part && String(part).trim() !== '' && String(part).toUpperCase() !== 'N/A');
    }
  }
  
  po.billing_address = addrParts.join(', ') || 'N/A';
  po.billing_state_code = ''; // Fallback since state_code is missing in schema

  const [items] = await pool.query(
    `SELECT id, item_code, drawing_no, description, quantity, unit, rate, basic_amount, discount, 
            cgst_percent, sgst_percent, igst_percent, cgst_amount, sgst_amount, igst_amount, hsn_code, delivery_date
     FROM customer_po_items
     WHERE customer_po_id = ?
     ORDER BY id ASC`,
    [id]
  );

  const enrichedItems = await Promise.all(items.map(async (item) => {
    // 1. Try to fetch stored sub-assemblies first (as a snapshot)
    const [storedSA] = await pool.query(
      `SELECT drawing_no as drawingNo, description, quantity, unit, rate, hsn_code, delivery_date 
       FROM customer_po_item_subassemblies 
       WHERE po_item_id = ?`,
      [item.id]
    );

    if (storedSA.length > 0) {
      return { ...item, sub_assemblies: storedSA };
    }

    // 2. Fallback to dynamic BOM fetching ONLY for legacy records that have NO stored sub-assemblies
    // and are clearly Finished Goods.
    const isFG = (item.item_code || '').startsWith('FG-') || 
                 (item.drawing_no && item.drawing_no !== '—');
    
    if (isFG && storedSA.length === 0) {
      // Check if we already have some sub-assemblies for other items in this PO. 
      // If we do, it means this is a modern record and we should NOT fallback.
      const [anyStoredSA] = await pool.query(
        'SELECT id FROM customer_po_item_subassemblies WHERE po_item_id IN (SELECT id FROM customer_po_items WHERE customer_po_id = ?)',
        [id]
      );

      if (anyStoredSA.length > 0) {
        return item; // Modern record, trust the (empty) snapshot
      }

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
    await connection.execute('DELETE FROM customer_po_item_subassemblies WHERE po_item_id IN (SELECT id FROM customer_po_items WHERE customer_po_id = ?)', [id]);
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
              (po_item_id, drawing_no, description, quantity, unit, rate, hsn_code, delivery_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ,
            [
              poItemId,
              sa.drawingNo || null,
              sa.description || null,
              sa.quantity || 0,
              sa.unit || 'NOS',
              sa.rate || 0,
              sa.hsn_code || null,
              sa.delivery_date || null
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
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        @page { size: A4; margin: 10mm; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #000; line-height: 1.3; margin: 0; font-size: 10px; }
        .invoice-container { border: 1px solid #000; min-height: 270mm; position: relative; }
        
        .header-section { display: flex; border-bottom: 1px solid #000; }
        .header-left { flex: 1.5; padding: 10px; border-right: 1px solid #000; }
        .header-right { flex: 1; padding: 10px; }
        
        .tax-invoice-label { text-align: center; border-bottom: 1px solid #000; font-weight: bold; font-size: 14px; padding: 5px; }
        
        .company-name { font-size: 16px; font-weight: bold; margin-bottom: 5px; }
        .address-text { font-size: 9px; margin-bottom: 2px; }
        
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; width: 100%; border-bottom: 1px solid #000; }
        .info-box { padding: 8px; border-right: 1px solid #000; min-height: 80px; }
        .info-box:last-child { border-right: none; }
        .label { font-weight: bold; text-decoration: underline; margin-bottom: 5px; display: block; font-size: 11px; }
        
        .meta-table { width: 100%; border-collapse: collapse; }
        .meta-table td { padding: 4px; border: 1px solid #000; }
        .meta-label { font-weight: bold; width: 40%; }
        
        .items-table { width: 100%; border-collapse: collapse; border-bottom: 1px solid #000; }
        .items-table th { border: 1px solid #000; padding: 6px; background: #f0f0f0; font-weight: bold; text-align: center; font-size: 9px; }
        .items-table td { border-left: 1px solid #000; border-right: 1px solid #000; padding: 6px; vertical-align: top; }
        .items-table tr.item-row { min-height: 30px; }
        .items-table tr.sub-assembly-row td { background: #fafafa; padding-top: 2px; padding-bottom: 2px; border-top: none; border-bottom: none; }
        
        .total-section { display: flex; border-bottom: 1px solid #000; }
        .words-section { flex: 1.5; padding: 10px; border-right: 1px solid #000; }
        .calc-section { flex: 1; }
        
        .calc-table { width: 100%; border-collapse: collapse; }
        .calc-table td { padding: 5px; border-bottom: 1px solid #000; text-align: right; }
        .calc-table td:first-child { text-align: left; font-weight: bold; border-right: 1px solid #000; }
        .calc-table tr:last-child td { border-bottom: none; font-size: 12px; font-weight: bold; }
        
        .tax-summary-table { width: 100%; border-collapse: collapse; border-bottom: 1px solid #000; margin-top: 0; }
        .tax-summary-table th, .tax-summary-table td { border: 1px solid #000; padding: 4px; text-align: center; }
        .tax-summary-table th { font-size: 8px; background: #f0f0f0; }
        
        .footer-section { display: flex; padding: 20px 10px; border-top: 1px solid #000; position: absolute; bottom: 0; width: 100%; box-sizing: border-box; }
        .footer-col { flex: 1; text-align: center; }
        .signature-box { margin-top: 40px; border-top: 1px dashed #000; display: inline-block; min-width: 150px; padding-top: 5px; }

        .sa-branch { color: #666; margin-right: 5px; font-family: monospace; }
        .sa-tag { font-size: 7px; background: #eee; padding: 1px 3px; border-radius: 2px; color: #444; border: 0.5px solid #ccc; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="tax-invoice-label">TAX INVOICE</div>
        
        <div class="header-section">
          <div class="header-left">
            <div class="company-name">SP TECHPIONEER PVT LTD</div>
            <div class="address-text">PLOT NO.97, SECTOR NO 07, PCNDTA</div>
            <div class="address-text">BHOSARI, PUNE-411026</div>
            <div class="address-text">GSTIN/UIN: 27AAPCS1193L1ZQ</div>
            <div class="address-text">State Name: Maharashtra, Code: 27</div>
          </div>
          <div class="header-right">
            <table class="meta-table">
              <tr>
                <td class="meta-label">Invoice No.</td>
                <td>{{po_number}}</td>
              </tr>
              <tr>
                <td class="meta-label">Dated</td>
                <td>{{po_date}}</td>
              </tr>
              <tr>
                <td class="meta-label">Reference No.</td>
                <td>{{quotation_ref}}</td>
              </tr>
            </table>
          </div>
        </div>
        
        <div class="info-grid">
          <div class="info-box">
            <span class="label">Consignee (Ship to)</span>
            <div style="font-weight: bold; font-size: 11px;">{{company_name}}</div>
            <div class="address-text">{{billing_address}}</div>
            <div class="address-text">GSTIN/UIN: {{gstin}}</div>
            <div class="address-text">State Name: {{billing_state}}, Code: {{billing_state_code}}</div>
          </div>
          <div class="info-box">
            <span class="label">Buyer (Bill to)</span>
            <div style="font-weight: bold; font-size: 11px;">{{company_name}}</div>
            <div class="address-text">{{billing_address}}</div>
            <div class="address-text">GSTIN/UIN: {{gstin}}</div>
            <div class="address-text">State Name: {{billing_state}}, Code: {{billing_state_code}}</div>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 25px;">Sl No.</th>
              <th>Description of Goods</th>
              <th style="width: 65px;">HSN Code</th>
              <th style="width: 75px;">Delivery Date</th>
              <th style="width: 55px;">Quantity</th>
              <th style="width: 75px;">Rate</th>
              <th style="width: 35px;">per</th>
              <th style="width: 85px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            {{#items}}
            <tr class="item-row">
              <td style="text-align: center;">{{index}}</td>
              <td>
                <div style="font-weight: bold;">{{description}}</div>
                {{#drawing_no}}<div style="font-size: 8px; color: #444;">DRW: {{drawing_no}}</div>{{/drawing_no}}
              </td>
              <td style="text-align: center;">{{hsn_code}}</td>
              <td style="text-align: center;">{{formatted_delivery_date}}</td>
              <td style="text-align: center;">{{quantity}} {{unit}}</td>
              <td style="text-align: right;">{{rate}}</td>
              <td style="text-align: center;">{{unit}}</td>
              <td style="text-align: right; font-weight: bold;">{{basic_amount}}</td>
            </tr>
            {{#sub_assemblies}}
            <tr class="sub-assembly-row">
              <td></td>
              <td>
                <div style="font-weight: bold;">{{description}} ({{drawingNo}})</div>
              </td>
              <td style="text-align: center;">{{hsn_code}}</td>
              <td style="text-align: center;">{{formatted_delivery_date}}</td>
              <td style="text-align: center;">{{displayQuantity}}</td>
              <td style="text-align: right;">{{displayRate}}</td>
              <td style="text-align: center;">{{unit}}</td>
              <td style="text-align: right; font-weight: bold;">{{displayTotal}}</td>
            </tr>
            {{/sub_assemblies}}
            {{/items}}
            {{#empty_rows}}
            <tr style="height: 25px;">
              <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
            </tr>
            {{/empty_rows}}
          </tbody>
        </table>

        <div class="total-section">
          <div class="words-section">
            <div style="font-style: italic; margin-bottom: 10px;">Amount Chargeable (in words)</div>
            <div style="font-weight: bold; font-size: 11px;">{{net_total_words}}</div>
          </div>
          <div class="calc-section">
            <table class="calc-table">
              <tr>
                <td>Total Taxable Value</td>
                <td>{{subtotal}}</td>
              </tr>
              {{#cgst_total}}
              <tr>
                <td>Output CGST @ 9%</td>
                <td>{{cgst_total}}</td>
              </tr>
              {{/cgst_total}}
              {{#sgst_total}}
              <tr>
                <td>Output SGST @ 9%</td>
                <td>{{sgst_total}}</td>
              </tr>
              {{/sgst_total}}
              {{#igst_total}}
              <tr>
                <td>Output IGST @ 18%</td>
                <td>{{igst_total}}</td>
              </tr>
              {{/igst_total}}
              <tr>
                <td>Total</td>
                <td>₹ {{net_total}}</td>
              </tr>
            </table>
          </div>
        </div>

        <table class="tax-summary-table">
          <thead>
            <tr>
              <th rowspan="2">HSN/SAC</th>
              <th rowspan="2">Taxable Value</th>
              <th colspan="2">Central Tax</th>
              <th colspan="2">State Tax</th>
              <th rowspan="2">Total Tax Amount</th>
            </tr>
            <tr>
              <th>Rate</th>
              <th>Amount</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {{#tax_summary}}
            <tr>
              <td>{{hsn_code}}</td>
              <td>{{taxable_value}}</td>
              <td>{{central_rate}}</td>
              <td>{{central_amount}}</td>
              <td>{{state_rate}}</td>
              <td>{{state_amount}}</td>
              <td>{{total_tax}}</td>
            </tr>
            {{/tax_summary}}
            <tr style="font-weight: bold; background: #f9f9f9;">
              <td>Total</td>
              <td>{{subtotal}}</td>
              <td></td>
              <td>{{cgst_total}}</td>
              <td></td>
              <td>{{sgst_total}}</td>
              <td>{{tax_total_summary}}</td>
            </tr>
          </tbody>
        </table>

        <div style="padding: 10px; font-size: 9px;">
          <div style="font-weight: bold; text-decoration: underline; margin-bottom: 5px;">Declaration:</div>
          We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
        </div>

        <div class="footer-section">
          <div class="footer-col">
            <div style="margin-bottom: 50px;">Customer's Seal and Signature</div>
            <div class="signature-box">Authorized Signatory</div>
          </div>
          <div class="footer-col" style="text-align: right;">
            <div style="font-weight: bold;">for SP TECHPIONEER PVT LTD</div>
            <div class="signature-box">Authorized Signatory</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : '—';
  const formatCurrency = (val) => Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Group items by HSN for tax summary
  const taxMap = new Map();
  po.items.forEach(item => {
    const hsn = item.hsn_code || 'N/A';
    if (!taxMap.has(hsn)) {
      const cgstRate = Number(item.cgst_percent || 0);
      const sgstRate = Number(item.sgst_percent || 0);
      const igstRate = Number(item.igst_percent || 0);
      
      taxMap.set(hsn, {
        hsn_code: hsn,
        taxable_value: 0,
        central_rate: (cgstRate || igstRate / 2 || 0).toFixed(1) + '%',
        central_amount: 0,
        state_rate: (sgstRate || igstRate / 2 || 0).toFixed(1) + '%',
        state_amount: 0,
        total_tax: 0
      });
    }
    const entry = taxMap.get(hsn);
    entry.taxable_value += Number(item.basic_amount);
    entry.central_amount += Number(item.cgst_amount || item.igst_amount / 2 || 0);
    entry.state_amount += Number(item.sgst_amount || item.igst_amount / 2 || 0);
    entry.total_tax += Number(item.cgst_amount || 0) + Number(item.sgst_amount || 0) + Number(item.igst_amount || 0);
  });

  const taxSummary = Array.from(taxMap.values()).map(t => ({
    ...t,
    taxable_value: formatCurrency(t.taxable_value),
    central_amount: formatCurrency(t.central_amount),
    state_amount: formatCurrency(t.state_amount),
    total_tax: formatCurrency(t.total_tax)
  }));

  const viewData = {
    ...po,
    po_date: formatDate(po.po_date),
    subtotal: formatCurrency(po.subtotal),
    tax_total_summary: formatCurrency(po.tax_total),
    cgst_total: formatCurrency(po.items.reduce((sum, i) => sum + Number(i.cgst_amount || 0), 0)),
    sgst_total: formatCurrency(po.items.reduce((sum, i) => sum + Number(i.sgst_amount || 0), 0)),
    igst_total: formatCurrency(po.items.reduce((sum, i) => sum + Number(i.igst_amount || 0), 0)),
    net_total: formatCurrency(po.net_total),
    net_total_words: numberToWords(po.net_total),
    tax_summary: taxSummary,
    items: (po.items || []).map((i, idx) => ({
      ...i,
      index: idx + 1,
      quantity: Number(i.quantity).toFixed(0),
      rate: formatCurrency(i.rate),
      basic_amount: formatCurrency(i.basic_amount),
      hsn_code: i.hsn_code || '—',
      formatted_delivery_date: i.delivery_date ? formatDate(i.delivery_date) : '—',
      sub_assemblies: (i.sub_assemblies || []).map(sa => {
        const saQty = (parseFloat(sa.quantity || 0) * (parseFloat(i.quantity) || 0));
        const saRate = parseFloat(sa.rate || 0);
        return {
          ...sa,
          displayQuantity: saQty.toFixed(3),
          displayRate: formatCurrency(saRate),
          displayTotal: formatCurrency(saQty * saRate),
          unit: sa.unit || 'NOS',
          hsn_code: sa.hsn_code || i.hsn_code || '—',
          formatted_delivery_date: sa.delivery_date ? formatDate(sa.delivery_date) : (i.delivery_date ? formatDate(i.delivery_date) : '—')
        };
      })
    })),
    empty_rows: Array.from({ length: Math.max(0, 10 - (po.items || []).length) })
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
    printBackground: true
  });
  await browser.close();

  return pdf;
};

const uploadCustomerPoPdf = async (id, pdfPath) => {
  const [rows] = await pool.query('SELECT pdf_path FROM customer_pos WHERE id = ?', [id]);
  if (!rows.length) return false;
  let newPath = pdfPath;
  if (rows[0].pdf_path) {
    const existing = rows[0].pdf_path.split(',').map(f => f.trim()).filter(Boolean);
    if (!existing.includes(pdfPath)) {
      newPath = `${rows[0].pdf_path},${pdfPath}`;
    } else {
      newPath = rows[0].pdf_path;
    }
  }
  const [result] = await pool.query(
    'UPDATE customer_pos SET pdf_path = ? WHERE id = ?',
    [newPath, id]
  );
  return result.affectedRows > 0;
};

module.exports = {
  createCustomerPo,
  listCustomerPos,
  getCustomerPoById,
  updateCustomerPo,
  deleteCustomerPo,
  generateCustomerPoPDF,
  uploadCustomerPoPdf
};

