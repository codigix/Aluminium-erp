const path = require('path');
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
        header.poNumber,
        header.poDate,
        header.poVersion || '1.0',
        header.orderType || 'STANDARD',
        header.plant,
        header.currency || 'INR',
        header.paymentTerms,
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

    const [salesOrderResult] = await connection.execute(
      `INSERT INTO sales_orders
        (customer_po_id, company_id, project_name, drawing_required, production_priority,
         target_dispatch_date, status, current_department, request_accepted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ,
      [
        customerPoId,
        companyId,
        payload.projectName || null,
        payload.drawingRequired ? 1 : 0,
        payload.productionPriority || 'NORMAL',
        payload.targetDispatchDate || null,
        'CREATED',
        'SALES',
        0
      ]
    );

    const salesOrderId = salesOrderResult.insertId;

    for (const item of items) {
      await connection.execute(
        `INSERT INTO sales_order_items
          (sales_order_id, item_code, description, quantity, unit, rate, delivery_date, tax_value)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ,
        [
          salesOrderId,
          item.itemCode || null,
          item.description,
          item.quantity,
          item.unit || 'NOS',
          item.rate,
          item.deliveryDate || null,
          item.cgstAmount + item.sgstAmount + item.igstAmount
        ]
      );
    }

    await connection.commit();

    return { customerPoId, salesOrderId, totals };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const listCustomerPos = async () => {
  const [rows] = await pool.query(
    `SELECT cp.*, c.company_name
     FROM customer_pos cp
     JOIN companies c ON c.id = cp.company_id
     ORDER BY cp.created_at DESC`
  );
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
    `SELECT id, item_code, description, quantity, unit, rate, basic_amount, discount, cgst_percent, sgst_percent, igst_percent, delivery_date
     FROM customer_po_items
     WHERE customer_po_id = ?
     ORDER BY id ASC`,
    [id]
  );
  return { ...rows[0], items };
};

module.exports = {
  createCustomerPo,
  listCustomerPos,
  getCustomerPoById
};
