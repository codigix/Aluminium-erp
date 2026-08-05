const path = require('path');
const mustache = require('mustache');
const puppeteer = require('puppeteer');
const pool = require('../config/db');
const bomService = require('./bomService');

const cleanAddress = (addr) => {
  if (!addr) return 'N/A';
  const parts = addr.split(/[\n\r,]+/);
  const seen = new Set();
  const uniqueParts = [];

  for (let part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Filter out standard placeholders
    const upper = trimmed.toUpperCase();
    if (upper === 'N/A' || upper === '—' || upper === '-') continue;

    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      uniqueParts.push(trimmed);
    }
  }

  return uniqueParts.join(', ') || 'N/A';
};

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
      testCertificate,
      hostCompanyId,
      contactPerson,
      email,
      phone,
      gstin,
      billingAddress,
      shippingAddress
    } = payload;

    const totals = calculateAmounts(items);

    if (!header.poNumber || !header.poNumber.trim()) {
      throw new Error('Customer PO Number is required.');
    }

    const trimmedPoNumber = header.poNumber.trim();

    const [poResult] = await connection.execute(
      `INSERT INTO customer_pos
        (company_id, project_name, po_number, po_date, po_version, order_type, plant, currency, payment_terms,
         credit_days, freight_terms, packing_forwarding, insurance_terms, delivery_terms, status,
         pdf_path, subtotal, tax_total, net_total, remarks, terms_and_conditions, special_notes,
         inspection_clause, test_certificate, host_company_id, contact_person, email, phone, gstin, billing_address, shipping_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ,
      [
        companyId,
        projectName || null,
        trimmedPoNumber,
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
        pdfFile ? (pdfFile.includes(',') || pdfFile.startsWith('uploads') ? pdfFile : path.relative(process.cwd(), pdfFile)) : null,
        totals.subtotal,
        totals.taxTotal,
        totals.netTotal,
        remarks || null,
        termsAndConditions || null,
        specialNotes || null,
        inspectionClause || null,
        testCertificate || null,
        hostCompanyId ? Number(hostCompanyId) : null,
        contactPerson || null,
        email || null,
        phone || null,
        gstin || null,
        billingAddress || null,
        shippingAddress || null
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
    // Auto-link any matching sales orders that have customer_po_id IS NULL
    if (companyId && projectName) {
      await connection.execute(
        `UPDATE sales_orders 
         SET customer_po_id = ? 
         WHERE company_id = ? 
           AND TRIM(UPPER(project_name)) = TRIM(UPPER(?)) 
           AND customer_po_id IS NULL`,
        [customerPoId, companyId, projectName]
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
  if (rows.length === 0) return [];

  const poIds = rows.map(r => r.id);
  const [items] = await pool.query(
    `SELECT id, customer_po_id, drawing_no, description FROM customer_po_items WHERE customer_po_id IN (?)`,
    [poIds]
  );

  let subassemblies = [];
  const parentItemIds = items.map(item => item.id);
  if (parentItemIds.length > 0) {
    const [saRows] = await pool.query(
      `SELECT po_item_id, drawing_no, drawing_no as drawingNo, description FROM customer_po_item_subassemblies WHERE po_item_id IN (?)`,
      [parentItemIds]
    );
    subassemblies = saRows;
  }

  return rows.map(r => {
    const rItems = items.filter(item => item.customer_po_id === r.id);
    return {
      ...r,
      items: rItems.map(item => ({
        ...item,
        sub_assemblies: subassemblies.filter(sa => sa.po_item_id === item.id)
      }))
    };
  });
};

const getCustomerPoById = async id => {
  const [rows] = await pool.query(
    `SELECT cp.*, c.company_name, c.company_code, c.customer_type, c.gstin, c.cin, c.pan,
            (SELECT email FROM contacts WHERE company_id = c.id ORDER BY contact_type = 'PRIMARY' DESC, id ASC LIMIT 1) as company_email
     FROM customer_pos cp
     JOIN companies c ON c.id = cp.company_id
     WHERE cp.id = ?`,
    [id]
  );
  if (!rows.length) {
    return null;
  }
  const po = rows[0];

  const companyService = require('./companyService');
  let companyDetails = null;
  try {
    companyDetails = await companyService.getCompanyById(po.company_id);
  } catch (err) {
    console.error('Error fetching company details for PO:', err);
  }

  const billing = companyDetails?.addresses?.find(a => a.address_type === 'BILLING') || {};
  const shipping = companyDetails?.addresses?.find(a => a.address_type === 'SHIPPING') || {};
  const billingContact = companyDetails?.contacts?.find(c => c.contact_type === 'ACCOUNTS') ||
    companyDetails?.contacts?.find(c => c.contact_type === 'PRIMARY') ||
    companyDetails?.contacts?.[0] || {};
  const shippingContact = companyDetails?.contacts?.find(c => c.contact_type === 'PURCHASE') ||
    companyDetails?.contacts?.find(c => c.contact_type === 'TECHNICAL') ||
    companyDetails?.contacts?.find(c => c.contact_type === 'PRIMARY') ||
    companyDetails?.contacts?.[0] || {};

  // Format billing address
  if (po.billing_address) {
    po.billing_address = cleanAddress(po.billing_address);
  } else {
    let billingAddrParts = [
      billing.line1,
      billing.line2,
      billing.city,
      billing.state,
      billing.pincode ? `Pincode: ${billing.pincode}` : null
    ].filter(part => part && String(part).trim() !== '' && String(part).toUpperCase() !== 'N/A');
    po.billing_address = cleanAddress(billingAddrParts.join(', ') || 'N/A');
  }
  po.billing_state = billing.state || 'N/A';
  po.billing_state_code = ''; // Fallback since state_code is missing in schema

  // Format shipping address
  if (po.shipping_address) {
    po.shipping_address = cleanAddress(po.shipping_address);
  } else {
    let shippingAddrParts = [
      shipping.line1,
      shipping.line2,
      shipping.city,
      shipping.state,
      shipping.pincode ? `Pincode: ${shipping.pincode}` : null
    ].filter(part => part && String(part).trim() !== '' && String(part).toUpperCase() !== 'N/A');
    po.shipping_address = cleanAddress(shippingAddrParts.join(', ') || po.billing_address);
  }
  po.shipping_state = shipping.state || po.billing_state;

  // Contacts
  po.billing_contact_name = po.contact_person || billingContact.name || '';
  po.billing_contact_phone = po.phone || billingContact.phone || '';
  po.shipping_contact_name = po.contact_person || shippingContact.name || '';
  po.shipping_contact_phone = po.phone || shippingContact.phone || '';

  // GSTIN / PAN / CIN
  po.gstin = po.gstin || companyDetails?.gstin || '';
  po.pan = companyDetails?.pan || po.pan || '';
  po.cin = companyDetails?.cin || po.cin || '';

  // Fetch linked quotation request details if available to override with precise project contacts
  try {
    if (po.project_name) {
      const [quotes] = await pool.query(
        `SELECT qr.id,
                COALESCE(qr.client_email, cd_proj.email, cd_contact.email, ct.email, '') as resolved_client_email,
                COALESCE(qr.client_phone, cd_proj.phone, cd_contact.phone, ct.phone, '') as resolved_client_phone,
                COALESCE(qr.contact_person, cd_proj.contact_person, cd_contact.contact_person, ct.name, '') as resolved_contact_person,
                COALESCE(qr.client_address, cd_proj.billing_address, (SELECT CONCAT(line1, ', ', IFNULL(line2, ''), city, ', ', state, ' ', pincode) FROM company_addresses WHERE company_id = c.id LIMIT 1)) as resolved_client_address
         FROM quotation_requests qr
         JOIN companies c ON c.id = qr.company_id
         LEFT JOIN sales_orders so ON so.id = qr.sales_order_id
         LEFT JOIN (
           SELECT company_id, email, phone, name, 
                  ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY contact_type = 'PRIMARY' DESC, id ASC) as rn
           FROM contacts
         ) ct ON ct.company_id = c.id AND ct.rn = 1
         LEFT JOIN (
           SELECT soi.sales_order_id, cd.contact_person, cd.phone, cd.email,
                  ROW_NUMBER() OVER (PARTITION BY soi.sales_order_id ORDER BY cd.id ASC) as rn
           FROM sales_order_items soi
           JOIN customer_drawings cd ON soi.drawing_id = cd.id
           WHERE cd.contact_person IS NOT NULL OR cd.phone IS NOT NULL OR cd.email IS NOT NULL
         ) cd_contact ON cd_contact.sales_order_id = qr.sales_order_id AND cd_contact.rn = 1
         LEFT JOIN (
           SELECT client_name, project_name, email, phone, contact_person, billing_address,
                  ROW_NUMBER() OVER (PARTITION BY client_name, project_name ORDER BY id DESC) as rn
           FROM customer_drawings
           WHERE contact_person IS NOT NULL OR phone IS NOT NULL OR email IS NOT NULL
         ) cd_proj ON cd_proj.client_name = c.company_name 
                  AND TRIM(LOWER(cd_proj.project_name)) = TRIM(LOWER(COALESCE(qr.project_name, so.project_name)))
                  AND cd_proj.rn = 1
         WHERE qr.company_id = ? AND TRIM(UPPER(qr.project_name)) = TRIM(UPPER(?))
         ORDER BY qr.version DESC, qr.id DESC
         LIMIT 1`,
        [po.company_id, po.project_name]
      );

      if (quotes.length > 0) {
        po.contact_person = po.contact_person || quotes[0].resolved_contact_person || '—';
        po.email = po.email || quotes[0].resolved_client_email || '—';
        po.phone = po.phone || quotes[0].resolved_client_phone || '—';
        po.billing_address = cleanAddress(po.billing_address || quotes[0].resolved_client_address || '—');
        po.shipping_address = cleanAddress(po.shipping_address || quotes[0].resolved_client_address || '—');
      }
    }
  } catch (err) {
    console.error('Error fetching quotation details for PO view:', err);
  }

  const [items] = await pool.query(
    `SELECT id, item_code, drawing_no, description, quantity, unit, rate, basic_amount, discount, 
            cgst_percent, sgst_percent, igst_percent, cgst_amount, sgst_amount, igst_amount, hsn_code, delivery_date
     FROM customer_po_items
     WHERE customer_po_id = ?
     ORDER BY id ASC`,
    [id]
  );

  const dispatchMap = new Map();
  try {
    const [salesOrders] = await pool.query(
      `SELECT id FROM sales_orders WHERE customer_po_id = ? OR (customer_po_id IS NULL AND company_id = ? AND TRIM(UPPER(project_name)) = TRIM(UPPER(?)))`,
      [id, po.company_id, po.project_name]
    );
    const salesOrderIds = salesOrders.map(so => so.id);

    let linkedOrderIds = [];
    if (salesOrderIds.length > 0) {
      const [orders] = await pool.query(
        `SELECT id FROM orders WHERE quotation_id IN (?)`,
        [salesOrderIds]
      );
      linkedOrderIds = orders.map(o => o.id);
    }

    if (salesOrderIds.length > 0) {
      const allSalesOrderIds = salesOrderIds;
      const allLinkedOrderIds = linkedOrderIds;
      
      const queryParams = [allSalesOrderIds];
      if (allLinkedOrderIds.length > 0) {
        queryParams.push(allLinkedOrderIds);
      }

      const [dispRows] = await pool.query(
        `SELECT 
           COALESCE(soi.item_code, oi.item_code, wo.item_code) as item_code,
           COALESCE(soi.drawing_no, oi.drawing_no, wo.bom_no) as drawing_no,
           SUM(COALESCE(jc.dispatch_qty, jc.accepted_qty, 0)) as dispatched_qty
         FROM job_cards jc
         JOIN work_orders wo ON jc.work_order_id = wo.id
         LEFT JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
         LEFT JOIN order_items oi ON wo.sales_order_item_id = oi.id
         WHERE (jc.operation_name = 'shipment' OR jc.operation_name = 'dispatch')
           AND wo.source_type = 'FG'
           AND (
             wo.sales_order_id IN (?)
             ${allLinkedOrderIds.length > 0 ? 'OR wo.sales_order_id IN (?)' : ''}
           )
         GROUP BY 
           COALESCE(soi.item_code, oi.item_code, wo.item_code),
           COALESCE(soi.drawing_no, oi.drawing_no, wo.bom_no)`,
         queryParams
      );

      for (const r of dispRows) {
        if (r.item_code) {
          const key = String(r.item_code).trim().toUpperCase();
          dispatchMap.set(key, (dispatchMap.get(key) || 0) + Number(r.dispatched_qty));
        }
        if (r.drawing_no) {
          const key = String(r.drawing_no).trim().toUpperCase();
          dispatchMap.set(key, (dispatchMap.get(key) || 0) + Number(r.dispatched_qty));
        }
      }
    }
  } catch (err) {
    console.error('Error pre-fetching PO dispatch quantities:', err);
  }

  const enrichedItems = await Promise.all(items.map(async (item) => {
    let dispatched_qty = 0;
    const itemCodeKey = item.item_code ? String(item.item_code).trim().toUpperCase() : null;
    const drawingNoKey = item.drawing_no ? String(item.drawing_no).trim().toUpperCase() : null;

    if (itemCodeKey && dispatchMap.has(itemCodeKey)) {
      dispatched_qty = dispatchMap.get(itemCodeKey);
    } else if (drawingNoKey && dispatchMap.has(drawingNoKey)) {
      dispatched_qty = dispatchMap.get(drawingNoKey);
    }

    // 1. Try to fetch stored sub-assemblies first (as a snapshot)
    const [storedSA] = await pool.query(
      `SELECT drawing_no, drawing_no as drawingNo, description, quantity, unit, rate, hsn_code, delivery_date 
       FROM customer_po_item_subassemblies 
       WHERE po_item_id = ?`,
      [item.id]
    );

    if (storedSA.length > 0) {
      return { ...item, sub_assemblies: storedSA, dispatched_qty };
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
        return { ...item, dispatched_qty }; // Modern record, trust the (empty) snapshot
      }

      const sub_assemblies = await bomService.getItemComponents(null, item.item_code, item.drawing_no);
      return {
        ...item,
        dispatched_qty,
        sub_assemblies: sub_assemblies.map(sa => ({
          drawingNo: sa.drawing_no || sa.component_code,
          description: sa.description,
          quantity: sa.quantity || sa.qty,
          unit: sa.unit || sa.uom || 'Nos',
          rate: sa.rate || sa.selling_rate || 0
        }))
      };
    }
    return { ...item, dispatched_qty };
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
      pdfFile,
      remarks,
      termsAndConditions,
      specialNotes,
      inspectionClause,
      testCertificate,
      hostCompanyId,
      contactPerson,
      email,
      phone,
      gstin,
      billingAddress,
      shippingAddress
    } = payload;

    const totals = calculateAmounts(items);

    if (!header.poNumber || !header.poNumber.trim()) {
      throw new Error('Customer PO Number is required.');
    }

    const trimmedPoNumber = header.poNumber.trim();

    await connection.execute(
      `UPDATE customer_pos
       SET project_name = ?, po_number = ?, po_date = ?, po_version = ?, order_type = ?, plant = ?, currency = ?, 
           payment_terms = ?, credit_days = ?, freight_terms = ?, packing_forwarding = ?, 
           insurance_terms = ?, delivery_terms = ?, subtotal = ?, tax_total = ?, net_total = ?, 
           remarks = ?, terms_and_conditions = ?, special_notes = ?, inspection_clause = ?, 
           test_certificate = ?, host_company_id = ?, pdf_path = ?,
           contact_person = ?, email = ?, phone = ?, gstin = ?, billing_address = ?, shipping_address = ?
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
        hostCompanyId ? Number(hostCompanyId) : null,
        pdfFile || null,
        contactPerson || null,
        email || null,
        phone || null,
        gstin || null,
        billingAddress || null,
        shippingAddress || null,
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
    // Auto-link any matching sales orders that have customer_po_id IS NULL
    const [poRows] = await connection.execute('SELECT company_id FROM customer_pos WHERE id = ?', [id]);
    const companyId = poRows[0]?.company_id;
    if (companyId && projectName) {
      await connection.execute(
        `UPDATE sales_orders 
         SET customer_po_id = ? 
         WHERE company_id = ? 
           AND TRIM(UPPER(project_name)) = TRIM(UPPER(?)) 
           AND customer_po_id IS NULL`,
        [id, companyId, projectName]
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

    // Unlink sales orders instead of deleting them (which would cascade delete quotation requests, drawings, BOMs, etc.)
    await connection.execute('UPDATE sales_orders SET customer_po_id = NULL WHERE customer_po_id = ?', [id]);

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

const customerPoSummaryTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>{{poTitle}} - {{po_number}}</title>
<style>
  @page {
    size: A4 portrait;
    margin: 12mm;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: Arial, Helvetica, sans-serif;
  }

  body {
    background: #fff;
    color: #222222;
    font-size: 11px;
    line-height: 1.4;
    -webkit-print-color-adjust: exact;
  }

  .po-container {
    width: 100%;
    display: flex;
    flex-direction: column;
  }

  /* Header Section */
  .header-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #FFF59D;
    color: #333333;
    padding: 12px 15px;
    border: 1px solid #D6D6D6;
    border-radius: 4px;
    margin-bottom: 15px;
  }

  .title-block h1 {
    font-size: 18px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
    color: #333333;
  }

  .title-block p {
    font-size: 10px;
    color: #333333;
  }

  .po-meta-table {
    border-collapse: collapse;
    font-size: 11px;
  }

  .po-meta-table td {
    padding: 2px 4px;
    vertical-align: top;
    color: #222222;
  }

  .po-meta-table td.label {
    font-weight: bold;
    text-align: right;
    width: 70px;
    color: #333333;
  }

  /* Address Section */
  .address-section {
    display: flex;
    justify-content: space-between;
    margin-bottom: 20px;
    gap: 20px;
  }

  .address-box {
    width: 48%;
  }

  .address-box h3 {
    font-size: 10px;
    font-weight: bold;
    text-transform: uppercase;
    border-bottom: 1px solid #D6D6D6;
    padding-bottom: 4px;
    margin-bottom: 6px;
    color: #333333;
  }

  .address-box p {
    margin-bottom: 3px;
    line-height: 1.35;
    color: #222222;
  }

  /* Items Table */
  .items-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
    border: 1px solid #D6D6D6;
  }

  .items-table th {
    background-color: #FFF176;
    color: #333333;
    border: 1px solid #D6D6D6;
    padding: 6px 4px;
    font-size: 10px;
    font-weight: bold;
    text-transform: uppercase;
    text-align: left;
  }

  .items-table td {
    border: 1px solid #D6D6D6;
    padding: 8px 4px;
    vertical-align: top;
    color: #222222;
  }

  .items-table tr:nth-child(even) td {
    background-color: #FFFDE7;
  }

  .items-table th.right-align,
  .items-table td.right-align {
    text-align: right;
  }

  .items-table th.center-align,
  .items-table td.center-align {
    text-align: center;
  }

  .item-desc-bold {
    font-weight: bold;
    margin-bottom: 2px;
    color: #222222;
  }

  .item-desc-sub {
    font-size: 9.5px;
    color: #333333;
  }

  /* Summary Footer Section */
  .footer-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-top: 10px;
    page-break-inside: avoid;
  }

  .status-box {
    border: 1px solid #D6D6D6;
    padding: 8px 12px;
    border-radius: 4px;
    background: #FFFDE7;
    min-width: 150px;
  }

  .status-box p {
    margin-bottom: 2px;
  }

  .status-box .status-value {
    font-size: 12px;
    font-weight: bold;
    text-transform: uppercase;
    color: #333333;
  }

  .totals-table {
    width: 280px;
    border-collapse: collapse;
    font-size: 11px;
    border: 1px solid #D6D6D6;
  }

  .totals-table td {
    padding: 4px 6px;
    border: 1px solid #D6D6D6;
    color: #222222;
  }

  .totals-table td.val {
    text-align: right;
  }

  .totals-table tr.grand-total-row td {
    border-top: 1.5px solid #D6D6D6;
    border-bottom: 1.5px solid #D6D6D6;
    background-color: #FFF176;
    font-size: 13px;
    font-weight: bold;
    padding: 6px 6px;
    color: #333333;
  }

  @media print {
    body {
      background: #fff !important;
      -webkit-print-color-adjust: exact !important;
    }
  }
</style>
</head>
<body>

<div class="po-container">

  <!-- HEADER -->
  <div class="header-section">
    <div class="title-block">
      <h1>{{poTitle}}</h1>
      <p>Issued by: {{hostCompanyName}}</p>
    </div>
    <div>
      <table class="po-meta-table">
        <tr>
          <td class="label">PO No:</td>
          <td>{{po_number}}</td>
        </tr>
        <tr>
          <td class="label">PO Date:</td>
          <td>{{po_date}}</td>
        </tr>
      </table>
    </div>
  </div>

  <!-- ADDRESSES -->
  <div class="address-section">
    <div class="address-box">
      <h3>Customer</h3>
      <p><strong>{{vendor_name}}</strong></p>
      <p>{{{vendor_address_html}}}</p>
    </div>
    <div class="address-box">
      <h3>Dispatch Address</h3>
      <p>{{{shipping_address_html}}}</p>
    </div>
  </div>

  <!-- ITEMS TABLE -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 5%;" class="center-align">Sr</th>
        <th style="width: 15%;">Item Code</th>
        <th style="width: 35%;">Description</th>
        <th style="width: 10%;" class="center-align">HSN Code</th>
        <th style="width: 8%;" class="right-align">Qty</th>
        <th style="width: 11%;" class="right-align">Rate (₹)</th>
        <th style="width: 11%;" class="right-align">Amount (₹)</th>
        <th style="width: 10%;" class="center-align">Status</th>
      </tr>
    </thead>
    <tbody>
      {{#items}}
      <tr>
        <td class="center-align">{{sl_no}}</td>
        <td>{{item_code}}</td>
        <td>
          <div class="item-desc-bold">{{material_name}}</div>
          {{#description}}
          <div class="item-desc-sub">{{description}}</div>
          {{/description}}
        </td>
        <td class="center-align">{{hsn_code}}</td>
        <td class="right-align">{{quantity}}</td>
        <td class="right-align">{{unit_rate}}</td>
        <td class="right-align">{{amount}}</td>
        <td class="center-align">{{dispatch_status_str}}</td>
      </tr>
      {{/items}}
    </tbody>
  </table>

  <!-- SUMMARY FOOTER -->
  <div class="footer-section">
    <div class="status-box">
      <p style="color: #666; font-size: 9px; font-weight: bold; text-transform: uppercase;">PO Status</p>
      <div class="status-value">{{status}}</div>
    </div>
    
    <table class="totals-table">
      <tr>
        <td>Sub Total</td>
        <td class="val">₹ {{subtotal}}</td>
      </tr>
      {{#cgst_total}}
      <tr>
        <td>CGST ({{cgst_rate_summary}}%)</td>
        <td class="val">₹ {{cgst_total}}</td>
      </tr>
      {{/cgst_total}}
      {{#sgst_total}}
      <tr>
        <td>SGST ({{sgst_rate_summary}}%)</td>
        <td class="val">₹ {{sgst_total}}</td>
      </tr>
      {{/sgst_total}}
      <tr class="grand-total-row">
        <td>Grand Total</td>
        <td class="val">₹ {{total_amount}}</td>
      </tr>
    </table>
  </div>

</div>

</body>
</html>
`;

const generateCustomerPoPDF = async (poId, currentUser = null, includeDispatchStatus = false, balanceReport = false, sentReport = false) => {
  const po = await getCustomerPoById(poId);
  if (!po) throw new Error('Customer PO not found');

  let displayedItems = po.items || [];
  // Keep all items for the Sent PO report as requested, including not dispatched ones
  if (sentReport) {
    // No filtering: include all items (including not dispatched ones)
  } else if (balanceReport) {
    displayedItems = displayedItems.filter(item => parseFloat(item.dispatched_qty || 0) < parseFloat(item.quantity));
    displayedItems = displayedItems.map(item => {
      const originalQty = parseFloat(item.quantity) || 0;
      const dispatched = parseFloat(item.dispatched_qty) || 0;
      const remainingQty = Math.max(originalQty - dispatched, 0);
      const rate = parseFloat(item.rate) || 0;
      const basicAmount = remainingQty * rate;

      const cgstAmount = basicAmount * ((parseFloat(item.cgst_percent) || 0) / 100);
      const sgstAmount = basicAmount * ((parseFloat(item.sgst_percent) || 0) / 100);
      const igstAmount = basicAmount * ((parseFloat(item.igst_percent) || 0) / 100);

      return {
        ...item,
        original_quantity: originalQty,
        quantity: remainingQty,
        basic_amount: basicAmount,
        cgst_amount: cgstAmount,
        sgst_amount: sgstAmount,
        igst_amount: igstAmount
      };
    });
  }

  let creator = null;
  if (currentUser && currentUser.id) {
    try {
      const [userRows] = await pool.query('SELECT first_name, last_name, phone, email FROM users WHERE id = ?', [currentUser.id]);
      if (userRows.length > 0) {
        creator = userRows[0];
      }
    } catch (err) {
      console.error('Error fetching current user for PO PDF:', err);
    }
  }

  if (!creator) {
    try {
      const [userRows] = await pool.query('SELECT first_name, last_name, phone, email FROM users WHERE status = ? LIMIT 1', ['ACTIVE']);
      if (userRows.length > 0) {
        creator = userRows[0];
      }
    } catch (err) {
      console.error('Error fetching fallback user for PO PDF:', err);
    }
  }

  const adminCompanyMasterService = require('./adminCompanyMasterService');
  let activeCompany = null;

  // Try to find the host_company_id directly from the customer PO
  if (po && po.host_company_id) {
    try {
      activeCompany = await adminCompanyMasterService.getCompanyById(po.host_company_id);
    } catch (err) {
      console.error('Error fetching host company directly from customer PO:', err);
    }
  }

  // Try to find the host_company_id from a linked sales order
  if (!activeCompany) {
    try {
      const [soRow] = await pool.query('SELECT host_company_id FROM sales_orders WHERE customer_po_id = ? LIMIT 1', [poId]);
      if (soRow.length > 0 && soRow[0].host_company_id) {
        activeCompany = await adminCompanyMasterService.getCompanyById(soRow[0].host_company_id);
      }
    } catch (err) {
      console.error('Error fetching sales order host_company_id for customer PO:', err);
    }
  }

  // Fallback to active company
  if (!activeCompany) {
    try {
      activeCompany = await adminCompanyMasterService.getActiveCompany();
    } catch (err) {
      console.error('Error fetching active company:', err);
    }
  }

  const hostCompanyName = activeCompany?.company_name || 'SP TECHPIONEER PRIVATE LIMITED';
  const hostCompanyAddress = activeCompany?.company_address || 'Plot No. 97, Sector 7, PCNTDA,\nBhosari, Pune - 411026, Maharashtra, India';
  const hostCompanyAddressHtml = hostCompanyAddress ? hostCompanyAddress.replace(/\n/g, '<br/>') : 'Plot No. 97, Sector 7, PCNTDA,<br/>Bhosari, Pune - 411026, Maharashtra, India';
  const hostGSTIN = activeCompany?.gstin || '27AAPCS1193L1ZQ';
  const hostCIN = activeCompany?.cin || 'U29309PN2021PTC201234';
  const hostPAN = activeCompany?.pan || 'N/A';

  const fs = require('fs');
  const path = require('path');
  let logoBase64 = null;
  let signatureBase64 = null;

  if (activeCompany && activeCompany.company_logo) {
    const logoPath = path.join(__dirname, '../../', activeCompany.company_logo);
    if (fs.existsSync(logoPath)) {
      logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
    }
  }
  if (activeCompany && activeCompany.authorized_signature) {
    const signaturePath = path.join(__dirname, '../../', activeCompany.authorized_signature);
    if (fs.existsSync(signaturePath)) {
      signatureBase64 = `data:image/png;base64,${fs.readFileSync(signaturePath).toString('base64')}`;
    }
  }

  const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>{{poTitle}} - {{hostCompanyName}}</title>
<style>
  @page {
    size: A4 landscape;
    margin: 8mm;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: Arial, Helvetica, sans-serif;
  }

  body {
    background: #fff;
    -webkit-print-color-adjust: exact;
  }

  .po-container {
    width: 100%;
    border: 1.5px solid #000;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
  }

  .header-table {
    width: 100%;
    border-collapse: collapse;
    border-bottom: 1.5px solid #000;
  }
  
  .header-table td {
    vertical-align: top;
    padding: 6px;
  }

  .logo-box {
    width: 60px;
    height: 70px;
    border: 1px solid #000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f4dca3;
    font-weight: bold;
    flex-direction: column;
    overflow: hidden;
    margin-right: 12px;
  }

  .company-title {
    font-size: 11px;
    font-weight: bold;
    margin-bottom: 4px;
    color: #000;
    text-transform: uppercase;
  }

  .company-address {
    font-size: 7.5px;
    line-height: 1.3;
    color: #333;
    margin-bottom: 4px;
  }

  .company-meta {
    font-size: 7.5px;
    margin-bottom: 1px;
    color: #000;
  }

  .created-by-table {
    width: 100%;
    font-size: 7.5px;
    border-collapse: collapse;
  }

  .created-by-table td {
    padding: 1px 0;
    vertical-align: top;
  }

  .po-title-block {
    text-align: center;
    font-weight: bold;
    font-size: 11px;
    padding: 4px;
    border-bottom: 1.5px solid #000;
    letter-spacing: 0.5px;
    background: #fff;
  }

  .po-details-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 7.5px;
  }

  .po-details-table td {
    border-bottom: 0.5px solid #000;
    border-right: 0.5px solid #000;
    padding: 2.5px 4px;
    vertical-align: middle;
  }

  .po-details-table tr:last-child td {
    border-bottom: none;
  }

  .po-details-table td:last-child {
    border-right: none;
  }

  .middle-table {
    width: 100%;
    border-collapse: collapse;
    border-bottom: 1.5px solid #000;
  }

  .middle-table td {
    vertical-align: top;
    padding: 6px;
  }

  .section-title {
    font-size: 8px;
    font-weight: bold;
    color: #000;
    margin-bottom: 5px;
    border-bottom: 0.5px solid #000;
    padding-bottom: 2px;
    text-transform: uppercase;
  }

  .vendor-name {
    font-size: 8px;
    font-weight: bold;
    margin-bottom: 4px;
    color: #000;
  }

  .address-text {
    font-size: 7.5px;
    line-height: 1.3;
    color: #333;
  }

  .details-subtable {
    width: 100%;
    border-collapse: collapse;
    font-size: 7.5px;
  }

  .details-subtable td {
    padding: 1.5px 0 !important;
    border: none !important;
    vertical-align: top;
  }

  .items-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: -0.5px;
  }

  .items-table th {
    border: 0.5px solid #000;
    padding: 3.5px 4px;
    font-size: 7.5px;
    vertical-align: middle;
    background: #f2f2f2;
    font-weight: bold;
    text-align: center;
    text-transform: uppercase;
  }

  .items-table td {
    border: none;
    border-bottom: 0.5px solid #000;
    padding: 3.5px 4px;
    font-size: 7.5px;
    vertical-align: top;
  }

  .items-table tr.sub-assembly-row td {
    border-bottom: none;
  }

  .items-table tr.parent-with-subs td {
    border-bottom: none;
  }

  .items-table tr.last-sub-assembly td {
    border-bottom: 0.5px solid #000;
  }

  .summary-table {
    width: 100%;
    border-collapse: collapse;
    border-top: 1.5px solid #000;
    border-bottom: 1.5px solid #000;
    margin-top: -0.5px;
  }

  .summary-table td {
    vertical-align: top;
    padding: 6px;
  }

  .totals-subtable {
    width: 100%;
    border-collapse: collapse;
    font-size: 7.5px;
  }

  .totals-subtable td {
    padding: 2.5px 4px;
    border: none;
  }

  .totals-subtable tr.grand-total-row td {
    border-top: 1px solid #000;
    font-size: 9px;
    font-weight: bold;
  }

  .bottom-table {
    width: 100%;
    border-collapse: collapse;
  }

  .bottom-table td {
    vertical-align: top;
    padding: 6px;
  }

  .declaration-text {
    font-size: 7.5px;
    line-height: 1.3;
    color: #333;
    margin-bottom: 8px;
  }

  .signature-section {
    text-align: right;
    font-size: 7.5px;
  }

  .signature-box {
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  .signature-img {
    max-height: 40px;
    max-width: 100px;
    object-fit: contain;
  }

  .footer-row {
    border-top: 1.5px solid #000;
    text-align: center;
    padding: 5px;
    font-size: 7.5px;
    font-weight: bold;
    letter-spacing: 0.5px;
    background: #fff;
  }

  .page-number-row {
    text-align: center;
    padding: 1px 0 3px 0;
    font-size: 7.5px;
    color: #555;
  }

  @media print {
    body {
      background: #fff !important;
      -webkit-print-color-adjust: exact !important;
    }
  }
</style>
</head>
<body>

<div class="po-container">

  <!-- HEADER -->
  <table class="header-table">
    <tr>
      <td style="width: 70%; padding: 6px;">
        <div style="display: flex; align-items: flex-start; justify-content: space-between;">
          <div style="display: flex; align-items: flex-start;">
            <div class="logo-box">
              {{#logoBase64}}
              <img src="{{logoBase64}}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
              {{/logoBase64}}
              {{^logoBase64}}
              <div style="font-size: 9px;">S P</div>
              <div style="font-size: 12px; margin: 1px 0;">⚙</div>
              <div style="font-size: 9px;">T P</div>
              {{/logoBase64}}
            </div>
            <div>
              <div class="company-title">{{hostCompanyName}}</div>
              <div class="company-address">{{{hostCompanyAddressHtml}}}</div>
              <div class="company-meta"><strong>GSTIN NO.</strong> : {{hostGSTIN}}</div>
              {{#hostCIN}}
              <div class="company-meta"><strong>CIN NO.</strong> : {{hostCIN}}</div>
              {{/hostCIN}}
            </div>
          </div>
          
          <div style="width: 220px; margin-left: 10px;">
            <table class="created-by-table">
              <tr>
                <td style="width: 38%; font-weight: bold;">Created By</td>
                <td style="width: 5%;">:</td>
                <td>{{created_by_name}}</td>
              </tr>
              <tr>
                <td style="font-weight: bold;">Mobile</td>
                <td>:</td>
                <td>{{created_by_mobile}}</td>
              </tr>
              <tr>
                <td style="font-weight: bold;">Telephone</td>
                <td>:</td>
                <td>{{created_by_phone}}</td>
              </tr>
              <tr>
                <td style="font-weight: bold;">Email</td>
                <td>:</td>
                <td style="word-break: break-all;">{{created_by_email}}</td>
              </tr>
            </table>
          </div>
        </div>
      </td>
      
      <td style="width: 30%; border-left: 1.5px solid #000; padding: 0;">
        <div class="po-title-block">{{poTitle}}</div>
        <table class="po-details-table">
          <tr>
            <td style="width: 45%; font-weight: bold;">Purchase Order No.</td>
            <td style="width: 5%;">:</td>
            <td>{{po_number}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">PO Date</td>
            <td>:</td>
            <td>{{po_date}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Customer Code</td>
            <td>:</td>
            <td>{{customer_code}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Plant</td>
            <td>:</td>
            <td>{{plant}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Version No.</td>
            <td>:</td>
            <td>{{version_no}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Version Date</td>
            <td>:</td>
            <td>{{po_date}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Your Reference No.</td>
            <td>:</td>
            <td style="word-break: break-all;">{{project_ref}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Order Type</td>
            <td>:</td>
            <td>{{order_type}}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- MIDDLE SECTION -->
  <table class="middle-table">
    <tr>
      <td style="width: 35%; border-right: 1.5px solid #000;">
        <div class="section-title">CUSTOMER DETAILS</div>
        <div class="vendor-name">{{vendor_name}}</div>
        <div class="address-text">{{{vendor_address_html}}}</div>
        <table class="details-subtable" style="margin-top: 6px;">
          <tr>
            <td style="width: 32%; font-weight: bold;">Telephone</td>
            <td style="width: 5%;">:</td>
            <td>{{phone}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">GSTIN NO.</td>
            <td>:</td>
            <td>{{vendor_gstin}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Contact Person</td>
            <td>:</td>
            <td>{{contact_person}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Email</td>
            <td>:</td>
            <td style="word-break: break-all;">{{vendor_email}}</td>
          </tr>
        </table>
      </td>
      
      <td style="width: 35%; border-right: 1.5px solid #000;">
        <div class="section-title">DISPATCH / SHIP TO ADDRESS</div>
        <div class="vendor-name">{{vendor_name}}</div>
        <div class="address-text">{{{shipping_address_html}}}</div>
        <table class="details-subtable" style="margin-top: 6px;">
          <tr>
            <td style="width: 32%; font-weight: bold;">GSTIN NO.</td>
            <td style="width: 5%;">:</td>
            <td>{{vendor_gstin}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">State</td>
            <td>:</td>
            <td>{{shipping_state}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Contact Person</td>
            <td>:</td>
            <td>{{shipping_contact_person}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Telephone</td>
            <td>:</td>
            <td>{{shipping_phone}}</td>
          </tr>
        </table>
      </td>
      
      <td style="width: 30%;">
        <div class="section-title">TERMS & CONDITIONS</div>
        <table class="details-subtable">
          <tr>
            <td style="width: 40%; font-weight: bold;">Payment Terms</td>
            <td style="width: 5%;">:</td>
            <td>{{payment_terms}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Freight</td>
            <td>:</td>
            <td>{{freight}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">P & F</td>
            <td>:</td>
            <td>{{p_and_f}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Insurance</td>
            <td>:</td>
            <td>{{insurance}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Purchase Term</td>
            <td>:</td>
            <td>{{purchase_term}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Delivery Terms</td>
            <td>:</td>
            <td>{{delivery_terms}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Delivery Date</td>
            <td>:</td>
            <td>{{expected_delivery_date}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Your Ref No.</td>
            <td>:</td>
            <td style="word-break: break-all;">{{project_ref}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Our Ref No.</td>
            <td>:</td>
            <td>{{our_ref_no}}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- ITEMS TABLE -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 3%;">SL No.</th>
        {{#includeDispatchStatus}}
        <th style="width: 15%; text-align: left; vertical-align: top; line-height: 1.3;">Item No.<br/>Item Description</th>
        {{/includeDispatchStatus}}
        {{^includeDispatchStatus}}
        <th style="width: 25%; text-align: left; vertical-align: top; line-height: 1.3;">Item No.<br/>Item Description</th>
        {{/includeDispatchStatus}}
        <th style="width: 5%;">HSN Code</th>
        <th style="width: 7%;">Item Dlv. Dt.</th>
        <th style="width: 7%;">Pur. Req. No.</th>
        <th style="width: 6%; text-align: right;">Rate</th>
        <th style="width: 6%; text-align: right;">Qty</th>
        <th style="width: 4%;">Unit</th>
        <th style="width: 6%; text-align: right;">Amount</th>
        <th style="width: 5%; text-align: right;">Discount</th>
        <th style="width: 6%; text-align: right;">Transaction Amount</th>
        <th style="width: 3%; text-align: right; line-height: 1.2;">CGST<br/>%</th>
        <th style="width: 6%; text-align: right;">CGST Amt</th>
        <th style="width: 3%; text-align: right; line-height: 1.2;">SGST<br/>%</th>
        <th style="width: 6%; text-align: right;">SGST Amt</th>
        {{#includeDispatchStatus}}
        <th style="width: 10%; text-align: center; vertical-align: top;">Dispatch Status</th>
        {{/includeDispatchStatus}}
      </tr>
    </thead>
    <tbody>
      {{#items}}
      <tr {{#has_sub_assemblies}}class="parent-with-subs"{{/has_sub_assemblies}}>
        <td style="text-align: center;">{{sl_no}}</td>
        <td style="text-align: left; line-height: 1.35; padding-left: 5px;">
          {{item_no}}<br/>
          <div style="padding-left: 10px;">
            <strong>{{material_name}}</strong><br/>
            {{#description}}
            <span style="font-size: 7px; color: #555;">{{description}}</span>
            {{/description}}
          </div>
        </td>
        <td style="text-align: center;">{{hsn_code}}</td>
        <td style="text-align: center;">{{expected_delivery_date}}</td>
        <td style="text-align: center;">{{pur_req_no}}</td>
        <td style="text-align: right;">{{unit_rate}}</td>
        <td style="text-align: right;">{{quantity}}</td>
        <td style="text-align: center;">{{unit}}</td>
        <td style="text-align: right;">{{amount}}</td>
        <td style="text-align: right;">{{discount}}</td>
        <td style="text-align: right;">{{transaction_amount}}</td>
        <td style="text-align: right;">{{cgst_rate}}%</td>
        <td style="text-align: right;">{{cgst_amount}}</td>
        <td style="text-align: right;">{{sgst_rate}}%</td>
        <td style="text-align: right;">{{sgst_amount}}</td>
        {{#includeDispatchStatus}}
        <td style="text-align: center; font-weight: bold; font-size: 7px; vertical-align: middle;">{{dispatch_status_str}}</td>
        {{/includeDispatchStatus}}
      </tr>
      {{#sub_assemblies}}
      <tr class="sub-assembly-row {{#is_last}}last-sub-assembly{{/is_last}}" style="background: #fafafa; font-size: 6.5px;">
        <td></td>
        <td style="text-align: left; padding-left: 15px;">{{description}} ({{drawingNo}})</td>
        <td style="text-align: center;">{{hsn_code}}</td>
        <td style="text-align: center;">{{formatted_delivery_date}}</td>
        <td></td>
        <td style="text-align: right;">{{displayRate}}</td>
        <td style="text-align: right;">{{displayQuantity}}</td>
        <td style="text-align: center;">{{unit}}</td>
        <td style="text-align: right; font-weight: bold;">{{displayTotal}}</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        {{#includeDispatchStatus}}
        <td></td>
        {{/includeDispatchStatus}}
      </tr>
      {{/sub_assemblies}}
      {{/items}}
      {{#empty_rows}}
      <tr style="height: 22px;">
        <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
        {{#includeDispatchStatus}}
        <td></td>
        {{/includeDispatchStatus}}
      </tr>
      {{/empty_rows}}
    </tbody>
  </table>

  <!-- SUMMARY -->
  <table class="summary-table">
    <tr>
      <td style="width: 60%; padding: 8px; border-right: 1.5px solid #000;">
        <div style="font-size: 7.5px; font-weight: bold; margin-bottom: 4px;">Amount Chargeable (in words)</div>
        <div style="font-size: 8.5px; font-weight: bold; text-transform: uppercase; line-height: 1.35; color: #000;">
          INR {{total_amount_words}} ONLY
        </div>
      </td>
      <td style="width: 40%; padding: 0;">
        <table class="totals-subtable">
          <tr>
            <td style="width: 55%; padding: 3px 5px; font-weight: bold;">Sub Total</td>
            <td style="width: 5%; text-align: center; padding: 3px 0;">:</td>
            <td style="text-align: right; padding: 3px 5px;">{{subtotal}}</td>
          </tr>
          {{#cgst_total}}
          <tr>
            <td style="padding: 3px 5px; font-weight: bold;">CGST @ {{cgst_rate_summary}}%</td>
            <td style="text-align: center; padding: 3px 0;">:</td>
            <td style="text-align: right; padding: 3px 5px;">{{cgst_total}}</td>
          </tr>
          {{/cgst_total}}
          {{#sgst_total}}
          <tr>
            <td style="padding: 3px 5px; font-weight: bold;">SGST @ {{sgst_rate_summary}}%</td>
            <td style="text-align: center; padding: 3px 0;">:</td>
            <td style="text-align: right; padding: 3px 5px;">{{sgst_total}}</td>
          </tr>
          {{/sgst_total}}
          <tr class="grand-total-row">
            <td style="padding: 5px; font-size: 9px; font-weight: bold;">Grand Total</td>
            <td style="text-align: center; padding: 5px 0; font-size: 9px; font-weight: bold;">:</td>
            <td style="text-align: right; padding: 5px; font-size: 10px; font-weight: bold;">
              ₹ {{total_amount}}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- BOTTOM SECTION -->
  <table class="bottom-table">
    <tr>
      <td style="width: 35%; border-right: 1.5px solid #000;">
        <div class="section-title">BANK DETAILS (For Remittance)</div>
        <table class="details-subtable">
          <tr>
            <td style="width: 35%; font-weight: bold;">Bank Name</td>
            <td style="width: 5%;">:</td>
            <td>{{hostBankName}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Account Name</td>
            <td>:</td>
            <td>{{hostAccountName}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Account Number</td>
            <td>:</td>
            <td>{{hostAccountNumber}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">IFSC Code</td>
            <td>:</td>
            <td>{{hostIFSCCode}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Branch</td>
            <td>:</td>
            <td>{{hostBranchName}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Beneficiary GSTIN</td>
            <td>:</td>
            <td>{{hostGSTIN}}</td>
          </tr>
        </table>
      </td>
      
      <td style="width: 35%; border-right: 1.5px solid #000;">
        <div class="section-title">IMPORTANT NOTES</div>
        <ol style="margin: 0; padding-left: 12px; font-size: 7.5px; line-height: 1.35; color: #333;">
          <li>Please ensure all supplied material meet the requirements specified in PO.</li>
          <li>All the necessary test certificates, data sheets to be provided along with the material.</li>
          <li>Please mention our PO No. & Item Code in your Challan and Invoice.</li>
          <li>General Terms and Conditions as enclosed.</li>
          <li>Subject to Pune jurisdiction only.</li>
          <li>Goods once sold will not be taken back.</li>
        </ol>
      </td>
      
      <td style="width: 30%;">
        <div class="section-title">DECLARATION</div>
        <div class="declaration-text">
          We declare that this Purchase Order is issued for the goods / services as per the terms and conditions mentioned herein.
        </div>
        
        <div class="signature-section">
          <div style="font-weight: bold; margin-bottom: 20px;">For {{hostCompanyName}}</div>
          <div class="signature-box">
            {{#signatureBase64}}
            <img src="{{signatureBase64}}" class="signature-img" />
            {{/signatureBase64}}
            {{^signatureBase64}}
            <div style="font-family: 'Courier New', Courier, monospace; font-style: italic; font-size: 11px; font-weight: bold; border-bottom: 1px dashed #000; display: inline-block; padding: 2px 10px; margin-bottom: 5px;">
              {{hostCompanyName}}
            </div>
            {{/signatureBase64}}
          </div>
          <div style="font-weight: bold; margin-top: 5px;">Authorized Signatory</div>
        </div>
      </td>
    </tr>
  </table>

  <!-- FOOTER -->
  <div class="footer-row">
    THIS IS ELECTRONICALLY GENERATED PURCHASE ORDER AND DOES NOT REQUIRE SIGNATURE.
  </div>

  <div class="page-number-row">
    Page 1 of 1
  </div>

</div>

</body>
</html>
`;

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : '—';
  const formatCurrency = (val) => Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const subtotal = displayedItems.reduce((sum, item) => sum + (parseFloat(item.basic_amount) || 0) - (parseFloat(item.discount) || 0), 0);
  const cgst_total = displayedItems.reduce((sum, item) => sum + (parseFloat(item.cgst_amount) || 0), 0);
  const sgst_total = displayedItems.reduce((sum, item) => sum + (parseFloat(item.sgst_amount) || 0), 0);
  const grand_total = (balanceReport || sentReport) ? (subtotal + cgst_total + sgst_total) : parseFloat(po.net_total || (subtotal + cgst_total + sgst_total));

  const firstItem = displayedItems[0] || {};
  const cgst_rate_summary = parseFloat(firstItem.cgst_percent || 0).toFixed(0);
  const sgst_rate_summary = parseFloat(firstItem.sgst_percent || 0).toFixed(0);

  const numberToWords = (num) => {
    const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const inWords = (num) => {
      if ((num = num.toString()).length > 9) return 'overflow';
      let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
      if (!n) return; let str = '';
      str += (Number(n[1]) != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : '';
      str += (Number(n[2]) != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : '';
      str += (Number(n[3]) != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : '';
      str += (Number(n[4]) != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : '';
      str += (Number(n[5]) != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
      return str.toUpperCase();
    };
    return inWords(Math.floor(num));
  };

  const viewData = {
    ...po,
    includeDispatchStatus,
    poTitle: sentReport ? 'SENT CUSTOMER PO' : (balanceReport ? 'BALANCE DISPATCH REPORT' : 'PURCHASE ORDER'),
    po_date: formatDate(po.po_date),
    expected_delivery_date: formatDate(po.expected_delivery_date),
    vendor_name: po.company_name || 'N/A',
    vendor_email: po.company_email || 'N/A',
    vendor_address_html: po.billing_address ? po.billing_address.split(', ').join('<br/>') : 'N/A',
    phone: po.billing_contact_phone || 'N/A',
    vendor_gstin: po.gstin || 'N/A',
    contact_person: po.billing_contact_name || 'N/A',
    shipping_address_html: po.shipping_address ? po.shipping_address.split(', ').join('<br/>') : 'N/A',
    shipping_state: po.shipping_state || 'N/A',
    shipping_contact_person: po.shipping_contact_name || 'N/A',
    shipping_phone: po.shipping_contact_phone || 'N/A',
    project_name: po.project_name || 'General Procurement',
    project_ref: po.po_number ? (po.po_number.startsWith('PO-') ? po.po_number : `PO-${po.po_number}`) : 'Direct Procurement',
    subtotal: subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    cgst_total: cgst_total > 0 ? cgst_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null,
    sgst_total: sgst_total > 0 ? sgst_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null,
    cgst_rate_summary,
    sgst_rate_summary,
    total_amount: grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    total_amount_words: numberToWords(grand_total),
    hostCompanyName,
    hostCompanyAddressHtml,
    hostGSTIN,
    hostCIN,
    hostPAN,
    logoBase64,
    signatureBase64,
    created_by_name: creator ? `${creator.first_name} ${creator.last_name}` : 'Admin User',
    created_by_mobile: creator?.phone || activeCompany?.phone || '9822012345',
    created_by_phone: activeCompany?.telephone || '-',
    created_by_email: creator?.email || activeCompany?.email || 'rohit.kuchekar.external@sptech.com',
    customer_code: po.company_code || po.customer_code || ('CUST-' + String(po.company_id).padStart(6, '0')),
    plant: po.plant || activeCompany?.plant_code || 'STPTPL-01',
    version_no: po.po_version || '1.0',
    order_type: po.order_type || 'Standard Purchase Order',
    payment_terms: po.payment_terms || '45 days from invoice date',
    freight: po.freight_terms || 'Included',
    p_and_f: po.packing_forwarding || 'Included',
    insurance: po.insurance_terms || 'Included',
    purchase_term: po.order_type || 'Standard Purchase Order',
    delivery_terms: po.delivery_terms || 'As Per Item Wise Delivery Date',
    our_ref_no: po.our_ref_no || '—',
    hostBankName: activeCompany?.bank_name || 'HDFC BANK LTD.',
    hostAccountName: activeCompany?.company_name || 'SP TECHPIONEER PRIVATE LIMITED',
    hostAccountNumber: activeCompany?.account_number || '123456789999',
    hostIFSCCode: activeCompany?.ifsc_code ? activeCompany.ifsc_code.toUpperCase() : 'HDFC0001234',
    hostBranchName: activeCompany?.branch_name || 'Bhosari, Pune - 411026, Maharashtra',
    hostState: activeCompany?.state || 'Maharashtra',
    items: displayedItems.map((i, idx) => {
      const has_sub_assemblies = i.sub_assemblies && i.sub_assemblies.length > 0;

      const ordered = parseFloat(i.original_quantity || i.quantity) || 0;
      const dispatched = parseFloat(i.dispatched_qty) || 0;
      const dispFormatted = dispatched % 1 === 0 ? parseInt(dispatched) : dispatched;
      const ordFormatted = ordered % 1 === 0 ? parseInt(ordered) : ordered;
      let dispatch_status_str = 'Pending';
      if (dispatched >= ordered && ordered > 0) {
        dispatch_status_str = 'Completed';
      } else if (dispatched > 0) {
        dispatch_status_str = `${dispFormatted}/${ordFormatted} Partial`;
      }

      return {
        ...i,
        sl_no: idx + 1,
        item_code: i.item_code || '—',
        item_no: i.item_code || '—',
        drawing_no: i.drawing_no || i.item_code || '—',
        material_name: i.description || '—',
        description: i.drawing_no ? `DRW: ${i.drawing_no}` : '—',
        hsn_code: i.hsn_code || '73089090',
        expected_delivery_date: i.delivery_date ? formatDate(i.delivery_date) : '—',
        pur_req_no: po.po_number || '—',
        quantity: Number(i.quantity).toFixed(3),
        unit: (i.unit || 'NOS').toUpperCase(),
        unit_rate: parseFloat(i.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        amount: parseFloat(i.basic_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        discount: parseFloat(i.discount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        transaction_amount: (parseFloat(i.basic_amount || 0) - parseFloat(i.discount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        cgst_rate: parseFloat(i.cgst_percent || 0).toFixed(2),
        cgst_amount: parseFloat(i.cgst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        sgst_rate: parseFloat(i.sgst_percent || 0).toFixed(2),
        sgst_amount: parseFloat(i.sgst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        has_sub_assemblies,
        dispatch_status_str,
        sub_assemblies: (i.sub_assemblies || []).map((sa, saIdx) => {
          const saQty = (parseFloat(sa.quantity || 0) * (parseFloat(i.quantity) || 0));
          const saRate = parseFloat(sa.rate || 0);
          return {
            ...sa,
            displayQuantity: saQty.toFixed(3),
            displayRate: parseFloat(saRate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            displayTotal: parseFloat(saQty * saRate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            unit: sa.unit || 'NOS',
            hsn_code: sa.hsn_code || i.hsn_code || '—',
            formatted_delivery_date: sa.delivery_date ? formatDate(sa.delivery_date) : (i.delivery_date ? formatDate(i.delivery_date) : '—'),
            is_last: saIdx === i.sub_assemblies.length - 1
          };
        })
      };
    }),
    empty_rows: Array.from({ length: Math.max(0, 4 - displayedItems.length) }).map(() => ({ includeDispatchStatus }))
  };

  const selectedTemplate = (balanceReport || sentReport) ? customerPoSummaryTemplate : htmlTemplate;
  const html = mustache.render(selectedTemplate, viewData);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });

  const pdfOptions = {
    format: 'A4',
    printBackground: true
  };

  if (balanceReport || sentReport) {
    pdfOptions.landscape = false;
    pdfOptions.margin = { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' };
  } else {
    pdfOptions.landscape = true;
    pdfOptions.margin = { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' };
  }

  const pdf = await page.pdf(pdfOptions);
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

const getPendingDrawings = async (filters = {}) => {
  const {
    customer,
    po_no,
    drawing_no,
    drawing_name,
    project,
    status,
    from,
    to,
    ready_dispatch,
    page = 1,
    limit = 25,
    export_all = false
  } = filters;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  let sql = `
    SELECT * FROM (
      SELECT 
        cpi.id,
        cpi.customer_po_id,
        cp.po_number,
        c.company_name,
        cp.project_name,
        cpi.drawing_no,
        cpi.description as drawing_name,
        cpi.quantity as ordered_qty,
        cpi.delivery_date,
        cp.status as po_status,
        (SELECT MAX(id) FROM sales_orders WHERE customer_po_id = cp.id) as sales_order_id,
        COALESCE(
          (SELECT SUM(COALESCE(jc.produced_qty, jc.accepted_qty, 0))
           FROM job_cards jc
           JOIN work_orders wo ON jc.work_order_id = wo.id
           JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
           JOIN sales_orders so2 ON soi.sales_order_id = so2.id
           WHERE so2.customer_po_id = cpi.customer_po_id 
             AND (TRIM(UPPER(soi.drawing_no)) = TRIM(UPPER(cpi.drawing_no)) OR TRIM(UPPER(soi.item_code)) = TRIM(UPPER(cpi.item_code)))
             AND wo.source_type = 'FG' 
             AND jc.operation_name != 'shipment' 
             AND jc.operation_name != 'dispatch'
          ), 0
        ) as produced,
        COALESCE(
          (SELECT SUM(COALESCE(qci.accepted_qty, 0))
           FROM qc_inspection_items qci
           JOIN qc_inspections qc ON qci.qc_inspection_id = qc.id
           WHERE qci.item_code = cpi.drawing_no OR qci.item_code = cpi.item_code
          ), 0
        ) as qc,
        COALESCE(
          (SELECT SUM(COALESCE(sb.current_balance, 0))
           FROM stock_balance sb
           WHERE (sb.item_code = cpi.drawing_no OR sb.item_code = cpi.item_code) AND sb.material_type = 'FG'
          ), 0
        ) as fg_stock,
        COALESCE(
          (SELECT SUM(COALESCE(jc2.dispatch_qty, jc2.accepted_qty, 0))
           FROM job_cards jc2
           JOIN work_orders wo2 ON jc2.work_order_id = wo2.id
           JOIN sales_orders so2 ON wo2.sales_order_id = so2.id
           LEFT JOIN sales_order_items soi2 ON wo2.sales_order_item_id = soi2.id
           LEFT JOIN order_items oi2 ON wo2.sales_order_item_id = oi2.id
           WHERE (jc2.operation_name = 'shipment' OR jc2.operation_name = 'dispatch')
             AND wo2.source_type = 'FG'
             AND so2.customer_po_id = cpi.customer_po_id
             AND (
               (TRIM(UPPER(COALESCE(soi2.drawing_no, oi2.drawing_no, wo2.bom_no))) = TRIM(UPPER(cpi.drawing_no)) AND cpi.drawing_no IS NOT NULL AND cpi.drawing_no != '')
               OR
               (TRIM(UPPER(COALESCE(soi2.item_code, oi2.item_code, wo2.item_code))) = TRIM(UPPER(cpi.item_code)) AND cpi.item_code IS NOT NULL AND cpi.item_code != '')
             )
          ), 0
        ) as dispatched
      FROM customer_po_items cpi
      JOIN customer_pos cp ON cpi.customer_po_id = cp.id
      JOIN companies c ON cp.company_id = c.id
      WHERE cp.status != 'REJECTED'
      GROUP BY 
        cpi.id,
        cpi.customer_po_id,
        cp.po_number,
        c.company_name,
        cp.project_name,
        cpi.drawing_no,
        cpi.description,
        cpi.quantity,
        cpi.delivery_date,
        cp.status
    ) t
    WHERE 1=1
  `;

  const queryParams = [];

  if (customer && customer !== 'ALL') {
    sql += ` AND TRIM(company_name) = TRIM(?)`;
    queryParams.push(customer);
  }
  if (po_no) {
    sql += ` AND po_number LIKE ?`;
    queryParams.push(`%${po_no}%`);
  }
  if (drawing_no) {
    sql += ` AND drawing_no LIKE ?`;
    queryParams.push(`%${drawing_no}%`);
  }
  if (drawing_name) {
    sql += ` AND drawing_name LIKE ?`;
    queryParams.push(`%${drawing_name}%`);
  }
  if (project && project !== 'ALL') {
    sql += ` AND project_name LIKE ?`;
    queryParams.push(`%${project}%`);
  }
  if (from) {
    sql += ` AND delivery_date >= ?`;
    queryParams.push(from);
  }
  if (to) {
    sql += ` AND delivery_date <= ?`;
    queryParams.push(to);
  }

  if (status && status !== 'ALL') {
    if (status === 'Ready') {
      sql += ` AND (ordered_qty - dispatched) > 0 AND fg_stock >= (ordered_qty - dispatched)`;
    } else if (status === 'Production') {
      sql += ` AND (ordered_qty - dispatched) > 0 AND fg_stock < (ordered_qty - dispatched)`;
    } else if (status === 'Partial') {
      sql += ` AND (ordered_qty - dispatched) > 0 AND dispatched > 0`;
    } else if (status === 'Dispatched') {
      sql += ` AND (ordered_qty - dispatched) = 0 AND dispatched > 0`;
    }
  } else if (!status) {
    sql += ` AND (ordered_qty - dispatched) > 0`;
  }

  if (ready_dispatch === 'true' || ready_dispatch === true) {
    sql += ` AND (ordered_qty - dispatched) > 0 AND fg_stock >= (ordered_qty - dispatched)`;
  }

  const countSql = `SELECT COUNT(*) as total FROM (${sql}) c`;
  const [countResult] = await pool.query(countSql, queryParams);
  const total = countResult[0]?.total || 0;

  const metricsSql = `
    SELECT 
      COUNT(*) as totalPendingDrawings,
      SUM(CASE WHEN fg_stock >= (ordered_qty - dispatched) AND (ordered_qty - dispatched) > 0 THEN 1 ELSE 0 END) as readyForDispatch,
      SUM(CASE WHEN fg_stock < (ordered_qty - dispatched) AND (ordered_qty - dispatched) > 0 THEN 1 ELSE 0 END) as productionPending,
      SUM(CASE WHEN produced > qc THEN 1 ELSE 0 END) as qcPending,
      SUM(CASE WHEN dispatched > 0 THEN 1 ELSE 0 END) as partialDispatch,
      SUM(CASE WHEN (ordered_qty - dispatched) = 0 THEN 1 ELSE 0 END) as fullyDispatched
    FROM (${sql}) m
  `;
  const [metricsResult] = await pool.query(metricsSql, queryParams);
  const summary = metricsResult[0] || {
    totalPendingDrawings: 0,
    readyForDispatch: 0,
    productionPending: 0,
    qcPending: 0,
    partialDispatch: 0,
    fullyDispatched: 0
  };

  if (!export_all) {
    sql += ` LIMIT ? OFFSET ?`;
    queryParams.push(parseInt(limit), parseInt(offset));
  }

  const [drawings] = await pool.query(sql, queryParams);

  const formattedDrawings = drawings.map(r => {
    const pending = Math.max(0, r.ordered_qty - r.dispatched);
    let calculatedStatus = 'Production';
    if (pending === 0) {
      calculatedStatus = 'Dispatched';
    } else if (r.fg_stock >= pending && pending > 0) {
      calculatedStatus = 'Ready';
    } else if (r.dispatched > 0 && pending > 0) {
      calculatedStatus = 'Partial';
    }
    return {
      ...r,
      pending,
      status: calculatedStatus
    };
  });

  return { drawings: formattedDrawings, total, summary };
};

const getDispatchedDrawings = async (filters = {}) => {
  const {
    search,
    page = 1,
    limit = 25,
    export_all = false
  } = filters;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  let sql = `
    SELECT * FROM (
      SELECT 
        cpi.id,
        cpi.customer_po_id,
        cp.po_number,
        c.company_name,
        cp.project_name,
        cpi.drawing_no,
        cpi.description as drawing_name,
        cpi.quantity as ordered_qty,
        cpi.delivery_date,
        cp.status as po_status,
        (SELECT MAX(id) FROM sales_orders WHERE customer_po_id = cp.id) as sales_order_id,
        COALESCE(
          (SELECT SUM(COALESCE(jc.produced_qty, jc.accepted_qty, 0))
           FROM job_cards jc
           JOIN work_orders wo ON jc.work_order_id = wo.id
           JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
           JOIN sales_orders so2 ON soi.sales_order_id = so2.id
           WHERE so2.customer_po_id = cpi.customer_po_id 
             AND (TRIM(UPPER(soi.drawing_no)) = TRIM(UPPER(cpi.drawing_no)) OR TRIM(UPPER(soi.item_code)) = TRIM(UPPER(cpi.item_code)))
             AND wo.source_type = 'FG' 
             AND jc.operation_name != 'shipment' 
             AND jc.operation_name != 'dispatch'
          ), 0
        ) as produced,
        COALESCE(
          (SELECT SUM(COALESCE(qci.accepted_qty, 0))
           FROM qc_inspection_items qci
           JOIN qc_inspections qc ON qci.qc_inspection_id = qc.id
           WHERE qci.item_code = cpi.drawing_no OR qci.item_code = cpi.item_code
          ), 0
        ) as qc,
        COALESCE(
          (SELECT SUM(COALESCE(sb.current_balance, 0))
           FROM stock_balance sb
           WHERE (sb.item_code = cpi.drawing_no OR sb.item_code = cpi.item_code) AND sb.material_type = 'FG'
          ), 0
        ) as fg_stock,
        COALESCE(
          (SELECT SUM(COALESCE(jc2.dispatch_qty, jc2.accepted_qty, 0))
           FROM job_cards jc2
           JOIN work_orders wo2 ON jc2.work_order_id = wo2.id
           JOIN sales_orders so2 ON wo2.sales_order_id = so2.id
           LEFT JOIN sales_order_items soi2 ON wo2.sales_order_item_id = soi2.id
           LEFT JOIN order_items oi2 ON wo2.sales_order_item_id = oi2.id
           WHERE (jc2.operation_name = 'shipment' OR jc2.operation_name = 'dispatch')
             AND wo2.source_type = 'FG'
             AND so2.customer_po_id = cpi.customer_po_id
             AND (
               (TRIM(UPPER(COALESCE(soi2.drawing_no, oi2.drawing_no, wo2.bom_no))) = TRIM(UPPER(cpi.drawing_no)) AND cpi.drawing_no IS NOT NULL AND cpi.drawing_no != '')
               OR
               (TRIM(UPPER(COALESCE(soi2.item_code, oi2.item_code, wo2.item_code))) = TRIM(UPPER(cpi.item_code)) AND cpi.item_code IS NOT NULL AND cpi.item_code != '')
             )
          ), 0
        ) as dispatched
      FROM customer_po_items cpi
      JOIN customer_pos cp ON cpi.customer_po_id = cp.id
      JOIN companies c ON cp.company_id = c.id
      WHERE cp.status != 'REJECTED'
      GROUP BY 
        cpi.id,
        cpi.customer_po_id,
        cp.po_number,
        c.company_name,
        cp.project_name,
        cpi.drawing_no,
        cpi.description,
        cpi.quantity,
        cpi.delivery_date,
        cp.status
    ) t
    WHERE dispatched > 0
  `;

  const queryParams = [];

  if (search) {
    sql += ` AND (po_number LIKE ? OR company_name LIKE ? OR drawing_no LIKE ? OR drawing_name LIKE ?)`;
    queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  const countSql = `SELECT COUNT(*) as total FROM (${sql}) c`;
  const [countResult] = await pool.query(countSql, queryParams);
  const total = countResult[0]?.total || 0;

  if (!export_all) {
    sql += ` LIMIT ? OFFSET ?`;
    queryParams.push(parseInt(limit), parseInt(offset));
  }

  const [drawings] = await pool.query(sql, queryParams);

  const formattedDrawings = drawings.map(r => {
    const pending = Math.max(0, r.ordered_qty - r.dispatched);
    return {
      ...r,
      pending,
      status: pending === 0 ? 'Dispatched' : 'Partial'
    };
  });

  return { drawings: formattedDrawings, total };
};

const getPendingFilterOptions = async () => {
  const [rows] = await pool.query(`
    SELECT DISTINCT
      cp.po_number,
      cpi.drawing_no,
      cpi.description AS drawing_name,
      cp.project_name
    FROM customer_po_items cpi
    JOIN customer_pos cp ON cpi.customer_po_id = cp.id
    WHERE cp.status != 'REJECTED'
    ORDER BY cp.po_number, cpi.drawing_no
  `);

  const poNumbers    = [...new Set(rows.map(r => r.po_number).filter(Boolean))].sort();
  const drawingNos   = [...new Set(rows.map(r => r.drawing_no).filter(Boolean))].sort();
  const drawingNames = [...new Set(rows.map(r => r.drawing_name).filter(Boolean))].sort();
  const projects     = [...new Set(rows.map(r => r.project_name).filter(Boolean))].sort();

  return { poNumbers, drawingNos, drawingNames, projects };
};

module.exports = {
  createCustomerPo,
  listCustomerPos,
  getCustomerPoById,
  updateCustomerPo,
  deleteCustomerPo,
  generateCustomerPoPDF,
  uploadCustomerPoPdf,
  getPendingDrawings,
  getPendingFilterOptions,
  getDispatchedDrawings
};

