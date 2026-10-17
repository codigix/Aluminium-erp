const pool = require('../config/db');

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

  const amount = Math.floor(num || 0);
  const paisa = Math.round(((num || 0) - amount) * 100);

  let result = 'INR ' + formatWords(amount) + ' Only';
  if (paisa > 0) {
    result = 'INR ' + formatWords(amount) + ' and ' + formatWords(paisa) + ' Paisa Only';
  }
  return result;
};

const cleanAddress = (raw) => {
  if (!raw) return '';
  const parts = raw.split(/,\s*/);
  const seen = new Set();
  const deduped = [];
  for (const p of parts) {
    const trimmed = p.trim();
    if (trimmed && !seen.has(trimmed.toLowerCase())) {
      seen.add(trimmed.toLowerCase());
      deduped.push(trimmed);
    }
  }
  return deduped.join(', ');
};

const getNextInvoiceNo = async () => {
  const year = new Date().getFullYear();
  const [rows] = await pool.query(
    'SELECT invoice_no FROM sales_invoices ORDER BY id DESC LIMIT 50'
  );

  let maxSeq = 0;
  for (const r of rows) {
    if (r.invoice_no) {
      const match = r.invoice_no.match(/(\d+)$/);
      if (match) {
        const seqVal = parseInt(match[1], 10);
        if (!isNaN(seqVal) && seqVal > maxSeq) {
          maxSeq = seqVal;
        }
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `INV-${year}-${String(nextSeq).padStart(4, '0')}`;
};

const getAvailableSalesOrders = async () => {
  const [orders] = await pool.query(`
    SELECT 
      o.id,
      o.order_no,
      o.client_id,
      c.company_name as client_name,
      c.gstin as company_gstin,
      COALESCE(NULLIF(o.project_name, ''), NULLIF(cp.project_name, ''), 'General Project') as project_name,
      COALESCE(cp.po_number, cp2.po_number, '') as customer_po_no,
      COALESCE(cp.po_date, cp2.po_date) as customer_po_date,
      o.order_date,
      o.grand_total,
      o.status,
      (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count,
      (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) as total_ordered_qty,
      (SELECT COALESCE(SUM(sii.invoice_qty), 0) FROM sales_invoice_items sii JOIN sales_invoices si ON si.id = sii.sales_invoice_id WHERE si.order_id = o.id) as total_invoiced_qty
    FROM orders o
    JOIN companies c ON c.id = o.client_id
    LEFT JOIN customer_pos cp ON cp.id = o.quotation_id AND o.source_type = 'DIRECT'
    LEFT JOIN sales_orders so ON so.so_number = o.order_no
    LEFT JOIN customer_pos cp2 ON cp2.id = so.customer_po_id
    ORDER BY o.created_at DESC
  `);

  return orders.map(ord => {
    const ordered = parseFloat(ord.total_ordered_qty) || 0;
    const invoiced = parseFloat(ord.total_invoiced_qty) || 0;
    const remaining = Math.max(0, ordered - invoiced);
    return {
      ...ord,
      ordered_qty: ordered,
      invoiced_qty: invoiced,
      remaining_invoiceable_qty: remaining,
      is_fully_invoiced: ordered > 0 && remaining <= 0.0001
    };
  });
};

const getOrderDetailsForInvoice = async (orderId, excludeInvoiceId = null) => {
  const [orderRows] = await pool.query(`
    SELECT 
      o.*, 
      c.company_name AS client_name,
      c.gstin AS company_gstin,
      COALESCE(ct.email, cd_client.email, '') AS contact_email,
      COALESCE(ct.phone, cd_client.phone, '') AS contact_mobile,
      COALESCE(NULLIF(o.project_name, ''), NULLIF(cp.project_name, ''), 'General Project') as project_name,
      COALESCE(cp.po_number, '') as customer_po_no,
      COALESCE(ct.name, cd_client.contact_person, '') as contact_person,
      COALESCE(ba.billing_address, cd_client.billing_address, '') as billing_address,
      COALESCE(sa.shipping_address, cd_client.shipping_address, '') as shipping_address
    FROM orders o
    JOIN companies c ON c.id = o.client_id
    LEFT JOIN customer_pos cp ON cp.id = o.quotation_id AND o.source_type = 'DIRECT'
    LEFT JOIN (
       SELECT company_id, email, phone, name,
              ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY contact_type = 'PRIMARY' DESC, id ASC) as rn
       FROM contacts
    ) ct ON ct.company_id = c.id AND ct.rn = 1
    LEFT JOIN (
       SELECT company_id, CONCAT_WS(', ', NULLIF(line1, ''), NULLIF(line2, ''), NULLIF(city, ''), NULLIF(state, ''), NULLIF(pincode, ''), NULLIF(country, '')) as billing_address,
              ROW_NUMBER() OVER(PARTITION BY company_id ORDER BY id DESC) as rn
       FROM company_addresses 
       WHERE address_type = 'BILLING'
    ) ba ON ba.company_id = c.id AND ba.rn = 1
    LEFT JOIN (
       SELECT company_id, CONCAT_WS(', ', NULLIF(line1, ''), NULLIF(line2, ''), NULLIF(city, ''), NULLIF(state, ''), NULLIF(pincode, ''), NULLIF(country, '')) as shipping_address,
              ROW_NUMBER() OVER(PARTITION BY company_id ORDER BY id DESC) as rn
       FROM company_addresses 
       WHERE address_type = 'SHIPPING'
    ) sa ON sa.company_id = c.id AND sa.rn = 1
    LEFT JOIN (
       SELECT client_name, MAX(billing_address) as billing_address, MAX(shipping_address) as shipping_address, MAX(contact_person) as contact_person, MAX(email) as email, MAX(phone) as phone
       FROM customer_drawings 
       GROUP BY client_name
    ) cd_client ON cd_client.client_name = c.company_name
    WHERE o.id = ?
  `, [orderId]);

  if (orderRows.length === 0) {
    throw new Error('Sales Order not found');
  }

  const order = orderRows[0];

  // Enrich with Customer PO address if empty
  if (order.quotation_id && (!order.billing_address || !order.customer_po_no)) {
    try {
      const [pos] = await pool.query('SELECT po_number, billing_address, shipping_address, gstin FROM customer_pos WHERE id = ?', [order.quotation_id]);
      if (pos.length > 0) {
        order.customer_po_no = order.customer_po_no || pos[0].po_number;
        order.billing_address = order.billing_address || pos[0].billing_address;
        order.shipping_address = order.shipping_address || pos[0].shipping_address;
        order.company_gstin = order.company_gstin || pos[0].gstin;
      }
    } catch (e) {
      // Ignore fallback error
    }
  }

  const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);

  // Check already invoiced qty for each item from sales_invoice_items
  const itemIds = items.map(it => it.id);
  let invoicedMap = {};
  if (itemIds.length > 0) {
    let invQuery = `SELECT order_item_id, COALESCE(SUM(invoice_qty), 0) as invoiced_qty 
       FROM sales_invoice_items 
       WHERE order_item_id IN (?)`;
    const invParams = [itemIds];
    if (excludeInvoiceId) {
      invQuery += ' AND sales_invoice_id != ?';
      invParams.push(excludeInvoiceId);
    }
    invQuery += ' GROUP BY order_item_id';
    const [invRows] = await pool.query(invQuery, invParams);
    for (const r of invRows) {
      invoicedMap[r.order_item_id] = parseFloat(r.invoiced_qty) || 0;
    }
  }

  // Check shipment dispatches if available
  let dispatchedMap = {};
  try {
    const [shipRows] = await pool.query(
      `SELECT soi.item_code, COALESCE(SUM(soi.quantity), 0) as dispatched_qty
       FROM shipment_order_items soi
       JOIN shipment_orders so ON so.id = soi.shipment_order_id
       WHERE so.sales_order_id = ?
       GROUP BY soi.item_code`,
      [order.id]
    );
    for (const r of shipRows) {
      if (r.item_code) dispatchedMap[r.item_code] = parseFloat(r.dispatched_qty) || 0;
    }
  } catch (e) {
    // If shipments table has different schema, default safely
  }

  let totalOrdered = 0;
  let totalDispatched = 0;
  let totalAlreadyInvoiced = 0;
  let totalInvoiceable = 0;

  const processedItems = items.map(item => {
    const orderedQty = parseFloat(item.quantity) || 0;
    const previouslyInvoiced = invoicedMap[item.id] || 0;
    
    // Dispatched qty: from shipment records if tracked, otherwise defaults to ordered quantity
    const recordedDispatch = dispatchedMap[item.item_code] || dispatchedMap[item.drawing_no];
    const dispatchedQty = (recordedDispatch !== undefined && recordedDispatch > 0)
      ? recordedDispatch
      : orderedQty;

    const invoiceableQty = Math.max(0, dispatchedQty - previouslyInvoiced);
    const unitRate = parseFloat(item.rate) || 0;
    const currentInvoiceQty = invoiceableQty; // default to remaining invoiceable balance
    const lineAmount = currentInvoiceQty * unitRate;

    totalOrdered += orderedQty;
    totalDispatched += dispatchedQty;
    totalAlreadyInvoiced += previouslyInvoiced;
    totalInvoiceable += invoiceableQty;

    return {
      orderItemId: item.id,
      itemCode: item.item_code || '',
      drawingNo: item.drawing_no || '',
      description: item.description || '',
      hsnCode: item.hsn_code || '84779000',
      uom: 'Nos',
      orderedQty,
      dispatchedQty,
      previouslyInvoicedQty: previouslyInvoiced,
      invoiceableQty,
      invoiceQty: currentInvoiceQty,
      unitRate,
      amount: lineAmount
    };
  });

  const nextInvoiceNo = await getNextInvoiceNo();

  const savedIsInterstate = (order.is_interstate !== null && order.is_interstate !== undefined)
    ? (Number(order.is_interstate) === 1 || parseFloat(order.igst_rate) > 0)
    : null;

  const isInterstate = savedIsInterstate !== null
    ? savedIsInterstate
    : Boolean(order.company_gstin && !order.company_gstin.startsWith('27') && order.company_gstin !== '—');

  const igstRateVal = parseFloat(order.igst_rate) || 0;
  const cgstRateVal = parseFloat(order.cgst_rate) || 0;
  const sgstRateVal = parseFloat(order.sgst_rate) || 0;

  const finalIgstRate = isInterstate ? (igstRateVal > 0 ? igstRateVal : 18) : 0;
  const finalCgstRate = isInterstate ? 0 : (cgstRateVal > 0 ? cgstRateVal : 9);
  const finalSgstRate = isInterstate ? 0 : (sgstRateVal > 0 ? sgstRateVal : 9);

  return {
    orderId: order.id,
    orderNo: order.order_no,
    orderDate: order.order_date,
    clientId: order.client_id,
    clientName: order.client_name,
    hostCompanyId: order.host_company_id || null,
    customerPoNo: order.customer_po_no || '—',
    projectName: order.project_name || '—',
    gstin: order.company_gstin || '—',
    billingAddress: cleanAddress(order.billing_address) || '—',
    shippingAddress: cleanAddress(order.shipping_address || order.billing_address) || '—',
    contactPerson: order.contact_person || '—',
    contactEmail: order.contact_email || '—',
    contactMobile: order.contact_mobile || '—',
    nextInvoiceNo,
    cgstRate: finalCgstRate,
    sgstRate: finalSgstRate,
    igstRate: finalIgstRate,
    isInterstate: isInterstate,
    summary: {
      totalOrderedQty: totalOrdered,
      totalDispatchedQty: totalDispatched,
      totalAlreadyInvoicedQty: totalAlreadyInvoiced,
      totalInvoiceableQty: totalInvoiceable
    },
    items: processedItems
  };
};

const createSalesInvoice = async (invoiceData, userId) => {
  const {
    invoiceNo,
    orderId,
    clientId,
    hostCompanyId,
    host_company_id,
    customerPoNo,
    projectName,
    invoiceDate,
    dueDate,
    billingAddress,
    shippingAddress,
    gstin,
    paymentTerms,
    notes,
    items,
    cgstRate = 9.0,
    sgstRate = 9.0,
    igstRate = 0.0
  } = invoiceData;

  if (!orderId) {
    throw new Error('Sales Order is required');
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('At least one item must be included in the invoice');
  }

  // Filter items where invoiceQty > 0
  const activeItems = items.filter(it => (parseFloat(it.invoiceQty) || 0) > 0);
  if (activeItems.length === 0) {
    throw new Error('At least one item must have invoice quantity greater than 0');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Verify invoiceable quantities from DB
    const itemIds = activeItems.map(it => it.orderItemId).filter(Boolean);
    const [dbItems] = await connection.query(
      'SELECT id, quantity, rate FROM order_items WHERE id IN (?)',
      [itemIds]
    );

    const [invoicedSums] = await connection.query(
      `SELECT order_item_id, COALESCE(SUM(invoice_qty), 0) as total_invoiced 
       FROM sales_invoice_items 
       WHERE order_item_id IN (?)
       GROUP BY order_item_id`,
      [itemIds]
    );

    const invoicedMap = {};
    for (const r of invoicedSums) {
      invoicedMap[r.order_item_id] = parseFloat(r.total_invoiced) || 0;
    }

    const dbItemsMap = {};
    for (const r of dbItems) {
      dbItemsMap[r.id] = r;
    }

    let subtotal = 0;
    for (const it of activeItems) {
      const dbItem = dbItemsMap[it.orderItemId];
      if (dbItem) {
        const ordered = parseFloat(dbItem.quantity) || 0;
        const previouslyInvoiced = invoicedMap[it.orderItemId] || 0;
        const maxAllowed = Math.max(0, ordered - previouslyInvoiced);
        const reqQty = parseFloat(it.invoiceQty) || 0;

        if (reqQty > maxAllowed + 0.001) {
          throw new Error(
            `Invoice quantity ${reqQty} exceeds available invoiceable balance of ${maxAllowed} for item ${it.itemCode || it.drawingNo}`
          );
        }
      }

      const qty = parseFloat(it.invoiceQty) || 0;
      const rate = parseFloat(it.unitRate) || 0;
      subtotal += (qty * rate);
    }

    const cRate = parseFloat(cgstRate) || 0;
    const sRate = parseFloat(sgstRate) || 0;
    const iRate = parseFloat(igstRate) || 0;

    const cgstAmount = (subtotal * cRate) / 100;
    const sgstAmount = (subtotal * sRate) / 100;
    const igstAmount = (subtotal * iRate) / 100;
    const totalAmount = subtotal + cgstAmount + sgstAmount + igstAmount;

    const actualInvoiceNo = invoiceNo || (await getNextInvoiceNo());

    let finalHostCompanyId = hostCompanyId || host_company_id || null;
    if (!finalHostCompanyId && orderId) {
      const [ordRows] = await connection.query('SELECT host_company_id FROM orders WHERE id = ?', [orderId]);
      if (ordRows.length > 0 && ordRows[0].host_company_id) {
        finalHostCompanyId = ordRows[0].host_company_id;
      }
    }

    // 2. Insert into sales_invoices
    const [invResult] = await connection.execute(`
      INSERT INTO sales_invoices (
        invoice_no,
        order_id,
        client_id,
        host_company_id,
        customer_po_no,
        project_name,
        invoice_date,
        due_date,
        billing_address,
        shipping_address,
        gstin,
        status,
        subtotal,
        cgst_rate,
        cgst_amount,
        sgst_rate,
        sgst_amount,
        igst_rate,
        igst_amount,
        total_amount,
        payment_terms,
        notes,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Created', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      actualInvoiceNo,
      orderId,
      clientId,
      finalHostCompanyId,
      customerPoNo || null,
      projectName || null,
      invoiceDate || new Date(),
      dueDate || null,
      billingAddress || null,
      shippingAddress || null,
      gstin || null,
      subtotal,
      cRate,
      cgstAmount,
      sRate,
      sgstAmount,
      iRate,
      igstAmount,
      totalAmount,
      paymentTerms || null,
      notes || null,
      userId || null
    ]);

    const invoiceId = invResult.insertId;

    // 3. Insert items into sales_invoice_items
    for (const it of activeItems) {
      const qty = parseFloat(it.invoiceQty) || 0;
      const rate = parseFloat(it.unitRate) || 0;
      const lineAmt = qty * rate;

      await connection.execute(`
        INSERT INTO sales_invoice_items (
          sales_invoice_id,
          order_item_id,
          item_code,
          drawing_no,
          description,
          hsn_code,
          uom,
          ordered_qty,
          dispatched_qty,
          previously_invoiced_qty,
          invoice_qty,
          unit_rate,
          amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        invoiceId,
        it.orderItemId || null,
        it.itemCode || null,
        it.drawingNo || null,
        it.description || null,
        it.hsnCode || '84779000',
        it.uom || 'Nos',
        parseFloat(it.orderedQty) || 0,
        parseFloat(it.dispatchedQty) || 0,
        parseFloat(it.previouslyInvoicedQty) || 0,
        qty,
        rate,
        lineAmt
      ]);
    }

    await connection.commit();
    return {
      invoiceId,
      invoiceNo: actualInvoiceNo,
      totalAmount
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateSalesInvoice = async (invoiceId, invoiceData, userId) => {
  const {
    hostCompanyId,
    host_company_id,
    customerPoNo,
    projectName,
    invoiceDate,
    dueDate,
    billingAddress,
    shippingAddress,
    gstin,
    paymentTerms,
    notes,
    items,
    cgstRate = 9.0,
    sgstRate = 9.0,
    igstRate = 0.0
  } = invoiceData;

  const [existingRows] = await pool.query('SELECT * FROM sales_invoices WHERE id = ?', [invoiceId]);
  if (existingRows.length === 0) {
    throw new Error('Sales Invoice not found');
  }
  const existingInvoice = existingRows[0];
  if (existingInvoice.status === 'Paid') {
    throw new Error('Paid invoices cannot be edited');
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('At least one item must be included in the invoice');
  }

  const activeItems = items.filter(it => (parseFloat(it.invoiceQty) || 0) > 0);
  if (activeItems.length === 0) {
    throw new Error('At least one item must have invoice quantity greater than 0');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Verify invoiceable quantities from DB excluding the current invoice
    const itemIds = activeItems.map(it => it.orderItemId).filter(Boolean);
    const [dbItems] = await connection.query(
      'SELECT id, quantity, rate FROM order_items WHERE id IN (?)',
      [itemIds]
    );

    const [invoicedSums] = await connection.query(
      `SELECT order_item_id, COALESCE(SUM(invoice_qty), 0) as total_invoiced 
       FROM sales_invoice_items 
       WHERE order_item_id IN (?) AND sales_invoice_id != ?
       GROUP BY order_item_id`,
      [itemIds, invoiceId]
    );

    const invoicedMap = {};
    for (const r of invoicedSums) {
      invoicedMap[r.order_item_id] = parseFloat(r.total_invoiced) || 0;
    }

    const dbItemsMap = {};
    for (const r of dbItems) {
      dbItemsMap[r.id] = r;
    }

    let subtotal = 0;
    for (const it of activeItems) {
      const dbItem = dbItemsMap[it.orderItemId];
      if (dbItem) {
        const ordered = parseFloat(dbItem.quantity) || 0;
        const previouslyInvoiced = invoicedMap[it.orderItemId] || 0;
        const maxAllowed = Math.max(0, ordered - previouslyInvoiced);
        const reqQty = parseFloat(it.invoiceQty) || 0;

        if (reqQty > maxAllowed + 0.001) {
          throw new Error(
            `Invoice quantity ${reqQty} exceeds available invoiceable balance of ${maxAllowed} for item ${it.itemCode || it.drawingNo}`
          );
        }
      }

      const qty = parseFloat(it.invoiceQty) || 0;
      const rate = parseFloat(it.unitRate) || 0;
      subtotal += (qty * rate);
    }

    const cRate = parseFloat(cgstRate) || 0;
    const sRate = parseFloat(sgstRate) || 0;
    const iRate = parseFloat(igstRate) || 0;

    const cgstAmount = (subtotal * cRate) / 100;
    const sgstAmount = (subtotal * sRate) / 100;
    const igstAmount = (subtotal * iRate) / 100;
    const totalAmount = subtotal + cgstAmount + sgstAmount + igstAmount;

    const finalHostCompanyId = hostCompanyId || host_company_id || existingInvoice.host_company_id || null;

    // 2. Update sales_invoices record
    await connection.execute(`
      UPDATE sales_invoices SET
        host_company_id = ?,
        customer_po_no = ?,
        project_name = ?,
        invoice_date = ?,
        due_date = ?,
        billing_address = ?,
        shipping_address = ?,
        gstin = ?,
        subtotal = ?,
        cgst_rate = ?,
        cgst_amount = ?,
        sgst_rate = ?,
        sgst_amount = ?,
        igst_rate = ?,
        igst_amount = ?,
        total_amount = ?,
        payment_terms = ?,
        notes = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [
      finalHostCompanyId,
      customerPoNo || null,
      projectName || null,
      invoiceDate || existingInvoice.invoice_date,
      dueDate || null,
      billingAddress || null,
      shippingAddress || null,
      gstin || null,
      subtotal,
      cRate,
      cgstAmount,
      sRate,
      sgstAmount,
      iRate,
      igstAmount,
      totalAmount,
      paymentTerms || null,
      notes || null,
      invoiceId
    ]);

    // 3. Replace items in sales_invoice_items
    await connection.execute('DELETE FROM sales_invoice_items WHERE sales_invoice_id = ?', [invoiceId]);

    for (const it of activeItems) {
      const qty = parseFloat(it.invoiceQty) || 0;
      const rate = parseFloat(it.unitRate) || 0;
      const lineAmt = qty * rate;

      await connection.execute(`
        INSERT INTO sales_invoice_items (
          sales_invoice_id,
          order_item_id,
          item_code,
          drawing_no,
          description,
          hsn_code,
          uom,
          ordered_qty,
          dispatched_qty,
          previously_invoiced_qty,
          invoice_qty,
          unit_rate,
          amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        invoiceId,
        it.orderItemId || null,
        it.itemCode || null,
        it.drawingNo || null,
        it.description || null,
        it.hsnCode || '84779000',
        it.uom || 'Nos',
        parseFloat(it.orderedQty) || 0,
        parseFloat(it.dispatchedQty) || 0,
        invoicedMap[it.orderItemId] || 0,
        qty,
        rate,
        lineAmt
      ]);
    }

    await connection.commit();

    return {
      invoiceId,
      invoiceNo: existingInvoice.invoice_no,
      totalAmount
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const listSalesInvoices = async (filters = {}) => {
  let query = `
    SELECT 
      si.*,
      o.order_no,
      c.company_name AS client_name,
      cm.company_name AS host_company_name,
      (SELECT COUNT(*) FROM sales_invoice_items WHERE sales_invoice_id = si.id) as item_count,
      (SELECT COALESCE(SUM(invoice_qty), 0) FROM sales_invoice_items WHERE sales_invoice_id = si.id) as total_qty
    FROM sales_invoices si
    JOIN orders o ON o.id = si.order_id
    JOIN companies c ON c.id = si.client_id
    LEFT JOIN company_master cm ON cm.id = COALESCE(si.host_company_id, o.host_company_id)
  `;

  const whereConditions = [];
  const params = [];

  if (filters.search) {
    whereConditions.push('(si.invoice_no LIKE ? OR o.order_no LIKE ? OR c.company_name LIKE ?)');
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  if (filters.status && filters.status !== 'ALL') {
    whereConditions.push('si.status = ?');
    params.push(filters.status);
  }

  if (whereConditions.length > 0) {
    query += ' WHERE ' + whereConditions.join(' AND ');
  }

  query += ' ORDER BY si.id DESC';

  const [rows] = await pool.query(query, params);
  return rows;
};

const getSalesInvoiceById = async (id) => {
  const [rows] = await pool.query(`
    SELECT 
      si.*,
      o.order_no,
      o.order_date,
      c.company_name AS client_name,
      c.gstin as company_gstin,
      cm.company_name AS host_company_name
    FROM sales_invoices si
    JOIN orders o ON o.id = si.order_id
    JOIN companies c ON c.id = si.client_id
    LEFT JOIN company_master cm ON cm.id = COALESCE(si.host_company_id, o.host_company_id)
    WHERE si.id = ? OR si.invoice_no = ?
  `, [id, id]);

  if (rows.length === 0) return null;
  const invoice = rows[0];

  const [items] = await pool.query(`
    SELECT * FROM sales_invoice_items WHERE sales_invoice_id = ? ORDER BY id ASC
  `, [invoice.id]);

  invoice.items = items;
  invoice.amountInWords = numberToWords(parseFloat(invoice.total_amount) || 0);

  return invoice;
};

const deleteSalesInvoice = async (id) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('DELETE FROM sales_invoice_items WHERE sales_invoice_id = ?', [id]);
    const [result] = await connection.execute('DELETE FROM sales_invoices WHERE id = ?', [id]);
    await connection.commit();
    return result.affectedRows > 0;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

const generateSalesInvoicePDF = async (invoiceId, copyType = 'Original for Recipient') => {
  const [invRows] = await pool.query(`
    SELECT 
      si.*,
      o.order_no,
      o.order_date,
      o.source_type,
      o.quotation_id,
      o.host_company_id AS order_host_company_id,
      c.company_name AS client_name,
      c.company_code,
      c.gstin AS company_gstin,
      c.pan AS company_pan,
      cp.po_number,
      cp.po_date
    FROM sales_invoices si
    JOIN orders o ON o.id = si.order_id
    JOIN companies c ON c.id = si.client_id
    LEFT JOIN customer_pos cp ON cp.id = o.quotation_id AND o.source_type = 'DIRECT'
    WHERE si.id = ? OR si.invoice_no = ?
  `, [invoiceId, invoiceId]);

  if (invRows.length === 0) {
    throw new Error('Sales Invoice not found');
  }

  const invoice = invRows[0];

  const [items] = await pool.query(`
    SELECT * FROM sales_invoice_items 
    WHERE sales_invoice_id = ? 
    ORDER BY id ASC
  `, [invoice.id]);

  const adminCompanyMasterService = require('./adminCompanyMasterService');
  let activeCompany = null;
  const targetHostId = invoice.host_company_id || invoice.order_host_company_id;
  if (targetHostId) {
    try {
      activeCompany = await adminCompanyMasterService.getCompanyById(targetHostId);
    } catch (e) {
      console.warn(`Could not fetch company by id ${targetHostId}, falling back to active company`);
    }
  }
  if (!activeCompany) {
    activeCompany = await adminCompanyMasterService.getActiveCompany();
  }

  const hostCompanyName = activeCompany?.company_name || 'SP TECHPIONEER PRIVATE LIMITED';
  const hostCompanyAddress = activeCompany?.company_address || 'Plot No. 97, Sector 7,\nPCNTDA, Bhosari, Pune - 26';
  const rawAddressLines = hostCompanyAddress ? hostCompanyAddress.split('\n').map(l => l.trim().replace(/\r/g, '')).filter(Boolean) : [];
  let hostCompanyAddressLinesFiltered = rawAddressLines.filter(line => 
    !line.toLowerCase().includes('code:') && 
    !line.toLowerCase().includes('code :') &&
    !line.toLowerCase().startsWith('gst') &&
    !line.toLowerCase().startsWith('state')
  );

  if (hostCompanyName.toUpperCase().includes('S.P.') || rawAddressLines.some(l => l.includes('Sector No 7') || l.includes('Plot No 97'))) {
    hostCompanyAddressLinesFiltered = [
      'Sector No 7,Plot No 97 ,PCNTDA , Bhosari',
      'Pune - 411026  ,Maharashtra'
    ];
  }

  const hostGSTIN = (activeCompany?.gstin || '27ANRPP4356J1ZA').toUpperCase();
  const hostStateName = activeCompany?.state || 'Maharashtra';

  const fs = require('fs');
  const path = require('path');
  let signatureBase64 = null;
  if (activeCompany && activeCompany.authorized_signature) {
    const signaturePath = path.join(__dirname, '../../', activeCompany.authorized_signature);
    if (fs.existsSync(signaturePath)) {
      signatureBase64 = `data:image/png;base64,${fs.readFileSync(signaturePath).toString('base64')}`;
    }
  }

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/\s/g, '-') : '';
  const formatCurrency = (val) => Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getStateCode = (stateName, gstin) => {
    if (gstin && gstin.trim().length >= 2) {
      const code = gstin.trim().substring(0, 2);
      if (!isNaN(parseInt(code))) return code;
    }
    const s = String(stateName || '').toLowerCase();
    if (s.includes('maharashtra')) return '27';
    if (s.includes('gujarat')) return '24';
    if (s.includes('karnataka')) return '29';
    if (s.includes('tamil')) return '33';
    if (s.includes('delhi')) return '07';
    if (s.includes('telangana')) return '36';
    if (s.includes('haryana')) return '06';
    if (s.includes('uttar')) return '09';
    if (s.includes('bengal')) return '19';
    if (s.includes('rajasthan')) return '08';
    if (s.includes('madhya')) return '23';
    if (s.includes('punjab')) return '03';
    if (s.includes('andhra')) return '37';
    return '27';
  };

  const hostStateCode = getStateCode(hostStateName, hostGSTIN);
  const buyerStateName = invoice.state || 'Maharashtra';
  const buyerStateCode = getStateCode(buyerStateName, invoice.gstin);
  const consigneeStateName = invoice.state || 'Maharashtra';
  const consigneeStateCode = getStateCode(consigneeStateName, invoice.gstin);

  const cgstRate = parseFloat(invoice.cgst_rate) || 0;
  const sgstRate = parseFloat(invoice.sgst_rate) || 0;
  const igstRate = parseFloat(invoice.igst_rate) || 0;
  const isInterstate = igstRate > 0 || (parseFloat(invoice.igst_amount) > 0) || Boolean(invoice.is_interstate);

  let totalTaxableValue = 0;
  let totalCgst = parseFloat(invoice.cgst_amount) || 0;
  let totalSgst = parseFloat(invoice.sgst_amount) || 0;
  let totalIgst = parseFloat(invoice.igst_amount) || 0;
  let totalQuantityNum = 0;
  let defaultUnit = 'NOS';

  const taxMap = new Map();

  const formattedItems = items.map((item, idx) => {
    const qty = Number(item.invoice_qty || item.quantity || 0);
    const rate = Number(item.unit_rate || item.rate || 0);
    const taxable = Number(item.amount || (qty * rate));
    const uom = item.uom || 'NOS';
    defaultUnit = uom;

    totalTaxableValue += taxable;
    totalQuantityNum += qty;

    const hsn = item.hsn_code || '84779000';
    if (!taxMap.has(hsn)) {
      taxMap.set(hsn, {
        hsn_code: hsn,
        taxable_value: 0,
        central_rate: cgstRate > 0 ? cgstRate.toFixed(1) + '%' : '—',
        central_amount: 0,
        state_rate: sgstRate > 0 ? sgstRate.toFixed(1) + '%' : '—',
        state_amount: 0,
        igst_rate: igstRate > 0 ? igstRate.toFixed(1) + '%' : '—',
        igst_amount: 0,
        total_tax: 0
      });
    }
    const entry = taxMap.get(hsn);
    entry.taxable_value += taxable;
    if (isInterstate) {
      const lineIgst = taxable * (igstRate / 100);
      entry.igst_amount += lineIgst;
      entry.total_tax += lineIgst;
    } else {
      const lineCgst = taxable * (cgstRate / 100);
      const lineSgst = taxable * (sgstRate / 100);
      entry.central_amount += lineCgst;
      entry.state_amount += lineSgst;
      entry.total_tax += (lineCgst + lineSgst);
    }

    return {
      index: idx + 1,
      drawing_no: item.item_code || item.drawing_no || '',
      description: item.item_name || item.description || '',
      hsn_code: hsn,
      quantity: qty.toFixed(3),
      unit: uom,
      rate: formatCurrency(rate),
      discount_percent: '',
      item_amount: formatCurrency(taxable)
    };
  });

  const taxSummary = Array.from(taxMap.values()).map(t => ({
    ...t,
    taxable_value: formatCurrency(t.taxable_value),
    central_amount: formatCurrency(t.central_amount),
    state_amount: formatCurrency(t.state_amount),
    igst_amount: formatCurrency(t.igst_amount),
    total_tax: formatCurrency(t.total_tax)
  }));

  const rawNetTotal = totalTaxableValue + totalCgst + totalSgst + totalIgst;
  const netTotalRounded = Math.round(parseFloat(invoice.total_amount) || rawNetTotal);
  const roundOffNum = Number((netTotalRounded - rawNetTotal).toFixed(2));
  const totalTaxAmt = totalCgst + totalSgst + totalIgst;

  const ITEMS_PER_PAGE = 10;
  const pageChunks = [];
  for (let i = 0; i < formattedItems.length; i += ITEMS_PER_PAGE) {
    pageChunks.push(formattedItems.slice(i, i + ITEMS_PER_PAGE));
  }
  if (pageChunks.length === 0) {
    pageChunks.push([]);
  }
  const totalPages = pageChunks.length;

  const pages = pageChunks.map((chunk, idx) => {
    const pageNum = idx + 1;
    const isFirstPage = pageNum === 1;
    const isLastPage = pageNum === totalPages;
    const isSinglePage = totalPages === 1;

    const pageTotalQty = chunk.reduce((sum, it) => sum + (parseFloat(it.quantity) || 0), 0);
    const pageTotalAmt = chunk.reduce((sum, it) => sum + (parseFloat(String(it.item_amount).replace(/,/g, '')) || 0), 0);

    return {
      page_number: pageNum,
      next_page: pageNum + 1,
      total_pages: totalPages,
      is_first_page: isFirstPage,
      is_last_page: isLastPage,
      is_single_page: isSinglePage,
      show_page_number: totalPages > 1,
      items: chunk,
      page_total_qty: `${pageTotalQty.toFixed(3)} ${defaultUnit}`,
      page_total_amt: formatCurrency(pageTotalAmt),
      has_spacer_row: isLastPage && chunk.length < 8
    };
  });

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page { size: A4 portrait; margin: 4mm 6mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        html, body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; font-size: 7.2pt; line-height: 1.2; color: #000; background: #fff; }
        
        .invoice-page {
          width: 100%;
          height: 287mm;
          border: 1px solid #000;
          display: flex;
          flex-direction: column;
          page-break-after: always;
          box-sizing: border-box;
        }
        .invoice-page:last-child {
          page-break-after: avoid;
        }

        .title-header { position: relative; text-align: center; padding: 3px 8px; border-bottom: 1px solid #000; min-height: 20px; }
        .title-main { font-size: 10pt; font-weight: bold; line-height: 18px; }
        .header-right-badges { position: absolute; right: 8px; top: 2.5px; display: flex; gap: 6px; align-items: center; }
        .copy-type-title { font-size: 8pt; font-weight: bold; text-transform: uppercase; color: #000; background-color: #fffa65; padding: 1px 7px; border-radius: 2px; letter-spacing: 0.3px; }
        .page-badge { font-size: 7.5pt; font-weight: bold; color: #333; background-color: #f0f0f0; border: 1px solid #bbb; padding: 1px 6px; border-radius: 2px; }
        
        .row-flex { display: flex; width: 100%; }
        .border-b { border-bottom: 1px solid #000; }
        .border-r { border-right: 1px solid #000; }

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
        .item-code { font-weight: bold; font-size: 7.2pt; }
        .item-desc { font-size: 7.2pt; font-weight: bold; margin-top: 0px; text-transform: uppercase; }
        
        .item-table tr.tax-row td { height: 16px; padding: 1.5px 4px; vertical-align: middle; }
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
          <span class="title-main">Tax Invoice</span>
          <div class="header-right-badges">
            <span class="copy-type-title">({{copy_type}})</span>
            {{#show_page_number}}
            <span class="page-badge">Page {{page_number}} of {{total_pages}}</span>
            {{/show_page_number}}
          </div>
        </div>

        <!-- Top Section: 58% Left Stacked Blocks, 42% Right Metadata Table -->
        <div class="row-flex border-b">
          <div class="seller-box">
            <!-- Seller Box -->
            <div style="padding: 4px 6px; border-bottom: 1px solid #000; flex: 1;">
              <div class="seller-name">{{hostCompanyName}}</div>
              {{#hostCompanyAddressLines}}
              <div class="seller-line">{{.}}</div>
              {{/hostCompanyAddressLines}}
              <div class="seller-line"><strong>GST No:</strong> {{hostGSTIN}}</div>
              <div class="seller-line"><strong>State Name :</strong> {{hostStateName}}</div>
            </div>
            <!-- Consignee Box -->
            <div style="padding: 4px 6px; border-bottom: 1px solid #000; flex: 1;">
              <div class="party-title">Consignee (Ship to)</div>
              <div class="party-name">{{consignee_name}}</div>
              <div class="seller-line">{{consignee_address}}</div>
              <div class="seller-line"><strong>GSTIN/UIN :</strong> {{consignee_gstin}}</div>
            </div>
            <!-- Buyer Box -->
            <div style="padding: 4px 6px; flex: 1;">
              <div class="party-title">Buyer (Bill to)</div>
              <div class="party-name">{{buyer_name}}</div>
              <div class="seller-line">{{buyer_address}}</div>
              <div class="seller-line"><strong>GSTIN/UIN :</strong> {{buyer_gstin}}</div>
            </div>
          </div>

          <!-- Right section (Invoice Details 7-row Metadata Table) -->
          <div class="meta-box">
            <table class="meta-table">
              <tr>
                <td style="width: 50%;">
                  <span class="meta-lbl">Invoice No.</span>
                  <span class="meta-val">{{invoice_no}}</span>
                </td>
                <td style="width: 50%;">
                  <span class="meta-lbl">Dated</span>
                  <span class="meta-val">{{invoice_date}}</span>
                </td>
              </tr>
              <tr>
                <td>
                  <span class="meta-lbl">Delivery Note</span>
                  <span class="meta-val">{{delivery_note}}</span>
                </td>
                <td>
                  <span class="meta-lbl">Mode/Terms of Payment</span>
                  <span class="meta-val">{{payment_terms}}</span>
                </td>
              </tr>
              <tr>
                <td>
                  <span class="meta-lbl">Reference No. & Date</span>
                  <span class="meta-val">{{reference_no_date}}</span>
                </td>
                <td>
                  <span class="meta-lbl">Other References</span>
                  <span class="meta-val">{{other_references}}</span>
                </td>
              </tr>
              <tr>
                <td>
                  <span class="meta-lbl">Buyer's Order No.</span>
                  <span class="meta-val">{{po_number}}</span>
                </td>
                <td>
                  <span class="meta-lbl">Dated</span>
                  <span class="meta-val">{{po_date}}</span>
                </td>
              </tr>
              <tr>
                <td>
                  <span class="meta-lbl">Dispatch Doc No.</span>
                  <span class="meta-val">{{dispatch_doc_no}}</span>
                </td>
                <td>
                  <span class="meta-lbl">Delivery Note Date</span>
                  <span class="meta-val">{{delivery_note_date}}</span>
                </td>
              </tr>
              <tr>
                <td>
                  <span class="meta-lbl">Dispatched through</span>
                  <span class="meta-val">{{dispatched_through}}</span>
                </td>
                <td>
                  <span class="meta-lbl">Destination</span>
                  <span class="meta-val">{{destination}}</span>
                </td>
              </tr>
              <tr>
                <td colspan="2">
                  <span class="meta-lbl">Terms of Delivery</span>
                  <span class="meta-val">{{terms_of_delivery}}</span>
                </td>
              </tr>
            </table>
          </div>
        </div>

        <!-- Main Items Table -->
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
                <th style="width: 7%; white-space: nowrap;">Disc %</th>
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
                <td style="text-align: right; font-weight: bold; white-space: nowrap;">{{quantity}} {{unit}}</td>
                <td style="text-align: right; white-space: nowrap;">{{rate}}</td>
                <td style="text-align: center;">{{unit}}</td>
                <td style="text-align: center;">{{discount_percent}}</td>
                <td style="text-align: right; font-weight: bold; white-space: nowrap;">{{item_amount}}</td>
              </tr>
              {{/items}}

              {{#is_last_page}}
                {{#has_cgst}}
                <tr class="tax-row" style="white-space: nowrap;">
                  <td></td>
                  <td style="text-align: right; font-style: italic; font-size: 7.2pt; font-weight: bold; white-space: nowrap;">
                    Output CGST @ {{cgst_rate_str}}
                  </td>
                  <td></td><td></td><td></td><td></td>
                  <td style="text-align: center; font-size: 7.2pt; font-style: italic; font-weight: bold; white-space: nowrap; vertical-align: middle;">{{cgst_rate_str}}</td>
                  <td style="text-align: right; font-size: 7.2pt; font-weight: bold; white-space: nowrap; vertical-align: middle;">{{cgst_total}}</td>
                </tr>
                {{/has_cgst}}

                {{#has_sgst}}
                <tr class="tax-row" style="white-space: nowrap;">
                  <td></td>
                  <td style="text-align: right; font-style: italic; font-size: 7.2pt; font-weight: bold; white-space: nowrap;">
                    Output SGST @ {{sgst_rate_str}}
                  </td>
                  <td></td><td></td><td></td><td></td>
                  <td style="text-align: center; font-size: 7.2pt; font-style: italic; font-weight: bold; white-space: nowrap; vertical-align: middle;">{{sgst_rate_str}}</td>
                  <td style="text-align: right; font-size: 7.2pt; font-weight: bold; white-space: nowrap; vertical-align: middle;">{{sgst_total}}</td>
                </tr>
                {{/has_sgst}}

                {{#has_igst}}
                <tr class="tax-row" style="white-space: nowrap;">
                  <td></td>
                  <td style="text-align: right; font-style: italic; font-size: 7.2pt; font-weight: bold; white-space: nowrap;">
                    Output IGST @ {{igst_rate_str}}
                  </td>
                  <td></td><td></td><td></td><td></td>
                  <td style="text-align: center; font-size: 7.2pt; font-style: italic; font-weight: bold; white-space: nowrap; vertical-align: middle;">{{igst_rate_str}}</td>
                  <td style="text-align: right; font-size: 7.2pt; font-weight: bold; white-space: nowrap; vertical-align: middle;">{{igst_total}}</td>
                </tr>
                {{/has_igst}}

                {{#round_off_val}}
                <tr class="tax-row" style="white-space: nowrap;">
                  <td></td>
                  <td style="text-align: right; font-style: italic; font-size: 7.2pt; font-weight: bold; white-space: nowrap;">
                    Rounding Off.
                  </td>
                  <td></td><td></td><td></td><td></td><td></td>
                  <td style="text-align: right; font-size: 7.2pt; font-weight: bold; white-space: nowrap; vertical-align: middle;">{{round_off_val}}</td>
                </tr>
                {{/round_off_val}}

                {{#has_spacer_row}}
                <tr class="spacer-row">
                  <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                </tr>
                {{/has_spacer_row}}

                <!-- Grand Total Row -->
                <tr class="total-row">
                  <td></td>
                  <td style="text-align: right;">Total</td>
                  <td></td>
                  <td style="text-align: right; white-space: nowrap;">{{total_quantity}}</td>
                  <td></td><td></td><td></td>
                  <td style="text-align: right; white-space: nowrap;">₹ {{net_total}}</td>
                </tr>
              {{/is_last_page}}

              {{^is_last_page}}
                <!-- Intermediate Page Carried Over Row -->
                <tr class="total-row">
                  <td></td>
                  <td style="text-align: right; font-style: italic;">Carried Over to Page {{next_page}}</td>
                  <td></td>
                  <td style="text-align: right; white-space: nowrap;">{{page_total_qty}}</td>
                  <td></td><td></td><td></td>
                  <td style="text-align: right; white-space: nowrap;">₹ {{page_total_amt}}</td>
                </tr>
              {{/is_last_page}}
            </tbody>
          </table>
        </div>

        {{#is_last_page}}
        <!-- Amount Chargeable (in words) -->
        <div class="charge-box">
          <div>
            <div class="charge-lbl">Amount Chargeable (in words)</div>
            <div class="charge-words">{{net_total_words}}</div>
          </div>
          <div style="font-weight: bold; font-size: 8pt;">E. & O.E</div>
        </div>

        <!-- GST Summary Table -->
        <table class="gst-table">
          <thead>
            <tr>
              <th rowspan="2" style="width: 14%;">HSN/SAC</th>
              <th rowspan="2" style="width: 16%;">Taxable Value</th>
              {{#has_igst}}
              <th colspan="2">Integrated Tax</th>
              {{/has_igst}}
              {{^has_igst}}
              <th colspan="2">Central Tax</th>
              <th colspan="2">State Tax</th>
              {{/has_igst}}
              <th rowspan="2" style="width: 16%;">Total Tax Amount</th>
            </tr>
            <tr>
              {{#has_igst}}
              <th style="width: 10%;">Rate</th>
              <th style="width: 15%;">Amount</th>
              {{/has_igst}}
              {{^has_igst}}
              <th style="width: 9%;">Rate</th>
              <th style="width: 14%;">Amount</th>
              <th style="width: 9%;">Rate</th>
              <th style="width: 14%;">Amount</th>
              {{/has_igst}}
            </tr>
          </thead>
          <tbody>
            {{#tax_summary}}
            <tr>
              <td style="text-align: center;">{{hsn_code}}</td>
              <td class="num">{{taxable_value}}</td>
              {{#has_igst}}
              <td style="text-align: center;">{{igst_rate}}</td>
              <td class="num">{{igst_amount}}</td>
              {{/has_igst}}
              {{^has_igst}}
              <td style="text-align: center;">{{central_rate}}</td>
              <td class="num">{{central_amount}}</td>
              <td style="text-align: center;">{{state_rate}}</td>
              <td class="num">{{state_amount}}</td>
              {{/has_igst}}
              <td class="num" style="font-weight: bold;">{{total_tax}}</td>
            </tr>
            {{/tax_summary}}
            <tr style="font-weight: bold;">
              <td style="text-align: right;">Total</td>
              <td class="num">{{subtotal}}</td>
              {{#has_igst}}
              <td></td>
              <td class="num">{{igst_total}}</td>
              {{/has_igst}}
              {{^has_igst}}
              <td></td>
              <td class="num">{{cgst_total}}</td>
              <td></td>
              <td class="num">{{sgst_total}}</td>
              {{/has_igst}}
              <td class="num">{{tax_total_summary}}</td>
            </tr>
          </tbody>
        </table>

        <!-- Tax Amount in Words -->
        <div class="tax-words-box">
          <strong>Tax Amount (in words) : </strong> <span>{{tax_total_words}}</span>
        </div>

        <!-- Declaration & Signatures -->
        <div class="footer-flex">
          <div class="decl-box">
            <strong>Declaration:</strong><br/>
            We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
          </div>
          <div class="sig-box-right">
            <div><strong>for {{hostCompanyName}}</strong></div>
            {{#signatureBase64}}
            <div style="margin-top: 2px; margin-bottom: 2px;"><img src="{{signatureBase64}}" style="max-height: 28px;" /></div>
            {{/signatureBase64}}
            {{^signatureBase64}}
            <div style="margin-top: 20px;"></div>
            {{/signatureBase64}}
            <div style="font-size: 7.2pt; font-weight: bold;">Authorised Signatory</div>
          </div>
        </div>
        {{/is_last_page}}

        {{^is_last_page}}
        <!-- Intermediate Page Footer -->
        <div class="footer-flex" style="min-height: 48px;">
          <div class="decl-box">
            <strong>Declaration:</strong><br/>
            We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.<br/>
            <em>(Continued on Page {{next_page}}...)</em>
          </div>
          <div class="sig-box-right">
            <div><strong>for {{hostCompanyName}}</strong></div>
            {{#signatureBase64}}
            <div style="margin-top: 2px; margin-bottom: 2px;"><img src="{{signatureBase64}}" style="max-height: 28px;" /></div>
            {{/signatureBase64}}
            {{^signatureBase64}}
            <div style="margin-top: 20px;"></div>
            {{/signatureBase64}}
            <div style="font-size: 7.2pt; font-weight: bold;">Authorised Signatory</div>
          </div>
        </div>
        {{/is_last_page}}

        <div class="computer-msg">This is a Computer Generated Invoice{{#show_page_number}} — Page {{page_number}} of {{total_pages}}{{/show_page_number}}</div>
      </div>
      {{/pages}}
    </body>
    </html>
  `;

  const viewData = {
    pages,
    copy_type: copyType || 'Original for Recipient',
    invoice_no: invoice.invoice_no,
    invoice_date: formatDate(invoice.invoice_date || invoice.created_at),
    delivery_note: invoice.delivery_note || '',
    payment_terms: invoice.payment_terms || '60 Days',
    reference_no_date: `${invoice.order_no || invoice.order_id} dt. ${formatDate(invoice.order_date || invoice.created_at)}`,
    other_references: invoice.other_references || '',
    po_number: invoice.customer_po_no || invoice.po_number || '',
    po_date: formatDate(invoice.po_date || invoice.order_date),
    dispatch_doc_no: invoice.dispatch_doc_no || '',
    delivery_note_date: formatDate(invoice.delivery_note_date),
    dispatched_through: invoice.dispatched_through || '',
    destination: invoice.destination || 'PLANT:1811',
    terms_of_delivery: invoice.terms_of_delivery || '',

    hostCompanyName,
    hostCompanyAddressLines: hostCompanyAddressLinesFiltered,
    hostGSTIN,
    hostStateName,
    hostStateCode,

    consignee_name: invoice.client_name,
    consignee_address: invoice.shipping_address || invoice.billing_address,
    consignee_gstin: invoice.gstin || invoice.company_gstin || 'N/A',
    consignee_state: consigneeStateName,
    consignee_state_code: consigneeStateCode,

    buyer_name: invoice.client_name,
    buyer_address: invoice.billing_address,
    buyer_gstin: invoice.gstin || invoice.company_gstin || 'N/A',
    buyer_state: buyerStateName,
    buyer_state_code: buyerStateCode,

    has_cgst: !isInterstate && totalCgst > 0,
    cgst_rate_str: (cgstRate % 1 === 0 ? cgstRate : cgstRate.toFixed(1)) + '%',
    cgst_total: formatCurrency(totalCgst),
    has_sgst: !isInterstate && totalSgst > 0,
    sgst_rate_str: (sgstRate % 1 === 0 ? sgstRate : sgstRate.toFixed(1)) + '%',
    sgst_total: formatCurrency(totalSgst),
    has_igst: isInterstate && totalIgst > 0,
    igst_rate_str: (igstRate % 1 === 0 ? igstRate : igstRate.toFixed(1)) + '%',
    igst_total: formatCurrency(totalIgst),
    round_off_val: roundOffNum !== 0 ? (roundOffNum > 0 ? `+${roundOffNum.toFixed(2)}` : roundOffNum.toFixed(2)) : null,
    total_quantity: `${totalQuantityNum.toFixed(3)} ${defaultUnit}`,
    net_total: formatCurrency(netTotalRounded),
    net_total_words: numberToWords(netTotalRounded),

    subtotal: formatCurrency(totalTaxableValue),
    tax_summary: taxSummary,
    tax_total_summary: formatCurrency(totalTaxAmt),
    tax_total_words: numberToWords(totalTaxAmt),

    signatureBase64
  };

  const mustache = require('mustache');
  const puppeteer = require('puppeteer');
  const html = mustache.render(htmlTemplate, viewData);

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();
    return pdf;
  } catch (error) {
    console.error('[Sales Invoice PDF Generation] Puppeteer error:', error.message);
    throw new Error('PDF generation unavailable: ' + error.message);
  }
};

const sendInvoiceToAccounts = async (invoiceId, userId = null) => {
  const [rows] = await pool.query('SELECT * FROM sales_invoices WHERE id = ?', [invoiceId]);
  if (rows.length === 0) {
    throw new Error('Sales Invoice not found');
  }

  const invoice = rows[0];
  if (invoice.sent_to_accounts) {
    return {
      success: true,
      alreadySent: true,
      message: `Invoice ${invoice.invoice_no} was already sent to Accounts`,
      data: invoice
    };
  }

  await pool.query(
    `UPDATE sales_invoices 
     SET sent_to_accounts = 1,
         sent_to_accounts_at = NOW(),
         status = 'Sent to Accounts',
         updated_at = NOW()
     WHERE id = ?`,
    [invoiceId]
  );

  const [updatedRows] = await pool.query(`
    SELECT si.*, o.order_no, c.company_name AS client_name
    FROM sales_invoices si
    JOIN orders o ON o.id = si.order_id
    JOIN companies c ON c.id = si.client_id
    WHERE si.id = ?
  `, [invoiceId]);

  return {
    success: true,
    message: `Invoice ${invoice.invoice_no} has been transferred to Accounts Customer Receivables`,
    data: updatedRows[0]
  };
};

module.exports = {
  getNextInvoiceNo,
  getAvailableSalesOrders,
  getOrderDetailsForInvoice,
  createSalesInvoice,
  updateSalesInvoice,
  listSalesInvoices,
  getSalesInvoiceById,
  deleteSalesInvoice,
  generateSalesInvoicePDF,
  sendInvoiceToAccounts
};
