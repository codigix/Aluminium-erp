const pool = require('../config/db');
const crypto = require('crypto');
const bomService = require('./bomService');

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

const generateOrderNo = async (connection) => {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  const dateStr = `${day}-${month}-${year}`; // DD-MM-YYYY
  const prefix = `ORD${dateStr}-`;

  const db = connection || pool;
  const [rows] = await db.execute(
    'SELECT order_no FROM orders WHERE order_no LIKE ? FOR UPDATE',
    [`${prefix}%`]
  );

  let maxSeq = 0;
  for (const r of rows) {
    if (r.order_no) {
      const parts = r.order_no.split('-');
      const seqVal = parseInt(parts[parts.length - 1]);
      if (!isNaN(seqVal) && seqVal > maxSeq) {
        maxSeq = seqVal;
      }
    }
  }
  const sequence = maxSeq + 1;

  return `${prefix}${String(sequence).padStart(3, '0')}`;
};

const listOrders = async () => {
  const [rows] = await pool.query(`
    SELECT o.*, c.company_name AS client,
           COALESCE(NULLIF(o.project_name, ''), NULLIF(cp.project_name, ''), 'General Project') as project_name
    FROM orders o
    JOIN companies c ON c.id = o.client_id
    LEFT JOIN customer_pos cp ON cp.id = o.quotation_id AND o.source_type = 'DIRECT'
    ORDER BY o.created_at DESC
  `);
  
  if (rows.length === 0) return [];
  
  const orderIds = rows.map(r => r.id);
  const [items] = await pool.query(
    'SELECT order_id, drawing_no, description FROM order_items WHERE order_id IN (?)',
    [orderIds]
  );
  
  const itemsMap = {};
  for (const item of items) {
    if (!itemsMap[item.order_id]) {
      itemsMap[item.order_id] = [];
    }
    itemsMap[item.order_id].push(item);
  }
  
  return rows.map(r => ({
    ...r,
    items: itemsMap[r.id] || []
  }));
};

const createOrder = async (orderData) => {
  const {
    quotation_id,
    client_id,
    project_name,
    order_date,
    delivery_date,
    source_type,
    warehouse,
    cgst_rate,
    sgst_rate,
    profit_margin,
    subtotal,
    gst,
    grand_total,
    items,
    host_company_id
  } = orderData;

  // Duplicate Drawing / Customer PO check disabled to allow multiple Sales Orders for the same combination

  const publicId = crypto.randomUUID();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const orderNo = await generateOrderNo(connection);

    const [result] = await connection.execute(`
      INSERT INTO orders
      (order_no, public_id, quotation_id, client_id, project_name, order_date, delivery_date, 
       status, source_type, warehouse, cgst_rate, sgst_rate, profit_margin,
       subtotal, gst, grand_total, host_company_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Created', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      orderNo,
      publicId,
      quotation_id || null,
      client_id,
      project_name || null,
      order_date || new Date(),
      delivery_date || null,
      source_type || 'DIRECT',
      warehouse || null,
      cgst_rate || 0,
      sgst_rate || 0,
      profit_margin || 0,
      subtotal || 0,
      gst || 0,
      grand_total || 0,
      host_company_id || null
    ]);

    const orderId = result.insertId;

    if (items && items.length > 0) {
      for (const item of items) {
        await connection.execute(`
          INSERT INTO order_items
          (order_id, item_code, drawing_no, description, type, hsn_code, delivery_date, quantity, rate, amount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          orderId,
          item.item_code,
          item.drawing_no,
          item.description,
          item.type,
          item.hsn_code || null,
          item.delivery_date || null,
          item.quantity || 0,
          item.rate || 0,
          item.amount || 0
        ]);
      }
    }

    await connection.commit();
    return orderId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getOrderById = async (id) => {
  const [rows] = await pool.query(`
    SELECT o.*, c.company_name AS client, 
           COALESCE(ct.email, cd_client.email, "") AS contact_email, 
           COALESCE(ct.phone, cd_client.phone, "") AS contact_mobile,
           COALESCE(NULLIF(o.project_name, ''), NULLIF(cp.project_name, ''), 'General Project') as project_name,
           COALESCE(ct.name, cd_client.contact_person, "") as contact_person,
           COALESCE(so.billing_address, ba.billing_address, cd_client.billing_address, "") as billing_address,
           COALESCE(so.shipping_address, sa.shipping_address, cd_client.shipping_address, "") as shipping_address
    FROM orders o
    JOIN companies c ON c.id = o.client_id
    LEFT JOIN customer_pos cp ON cp.id = o.quotation_id AND o.source_type = 'DIRECT'
    LEFT JOIN sales_orders so ON so.id = o.quotation_id AND o.source_type = 'DRAWING'
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
    WHERE o.id = ? OR o.public_id = ?
  `, [id, id]);

  if (rows.length === 0) return null;

  const order = rows[0];

  // Enrich order with Customer PO contact details if it's direct
  if (order.source_type === 'DIRECT' && order.quotation_id) {
    try {
      const customerPoService = require('./customerPoService');
      const poData = await customerPoService.getCustomerPoById(order.quotation_id);
      if (poData) {
        order.contact_email = (poData.email && poData.email !== '—') ? poData.email : (order.contact_email || poData.company_email || '');
        order.contact_mobile = (poData.phone && poData.phone !== '—') ? poData.phone : (order.contact_mobile || poData.billing_contact_phone || poData.shipping_contact_phone || '');
        order.contact_person = (poData.contact_person && poData.contact_person !== '—') ? poData.contact_person : (order.contact_person || poData.billing_contact_name || poData.shipping_contact_name || '');
        if (poData.billing_address && poData.billing_address !== '—') {
          order.billing_address = poData.billing_address;
        }
        if (poData.shipping_address && poData.shipping_address !== '—') {
          order.shipping_address = poData.shipping_address;
        }
      }
    } catch (err) {
      console.error('Error enriching order details from Customer PO:', err);
    }
  }

  const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);

  let allPoItems = [];
  let allSubAssemblies = [];
  const poId = order.customer_po_id || (order.source_type === 'DIRECT' ? order.quotation_id : null);

  if (poId && items.length > 0) {
    const drawingNos = items.map(item => item.drawing_no).filter(Boolean);
    const itemCodes = items.map(item => item.item_code).filter(Boolean);
    
    if (drawingNos.length > 0 || itemCodes.length > 0) {
      // 1. Fetch matching PO items in a single query
      const [poItemRows] = await pool.query(
        `SELECT id, customer_po_id, drawing_no, item_code FROM customer_po_items 
         WHERE customer_po_id = ? AND (drawing_no IN (?) OR item_code IN (?))`,
        [poId, drawingNos.length > 0 ? drawingNos : [''], itemCodes.length > 0 ? itemCodes : ['']]
      );
      allPoItems = poItemRows;

      // 2. Fetch all sub-assemblies in a single query
      const poItemIds = allPoItems.map(p => p.id);
      if (poItemIds.length > 0) {
        const [saRows] = await pool.query(
          `SELECT po_item_id, drawing_no as drawingNo, description, quantity, unit, rate, hsn_code, delivery_date 
           FROM customer_po_item_subassemblies 
           WHERE po_item_id IN (?)`,
          [poItemIds]
        );
        allSubAssemblies = saRows;
      }
    }
  }

  const enrichedItems = await Promise.all(items.map(async (item) => {
    // Check if we have pre-loaded PO sub-assemblies
    if (poId) {
      const matchedPoItem = allPoItems.find(p => 
        (item.drawing_no && String(p.drawing_no).trim().toUpperCase() === String(item.drawing_no).trim().toUpperCase()) ||
        (item.item_code && String(p.item_code).trim().toUpperCase() === String(item.item_code).trim().toUpperCase())
      );
      if (matchedPoItem) {
        const matchedSAs = allSubAssemblies.filter(sa => sa.po_item_id === matchedPoItem.id);
        if (matchedSAs.length > 0) {
          return { ...item, sub_assemblies: matchedSAs };
        }
      }
    }

    // Fallback to dynamic BOM fetching
    const isFG = (item.item_code || '').startsWith('FG-') ||
      (item.drawing_no && item.drawing_no !== '—');

    if (isFG) {
      try {
        const sub_assemblies = await bomService.getItemComponents(null, item.item_code, item.drawing_no);
        if (sub_assemblies && sub_assemblies.length > 0) {
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
      } catch (err) {
        console.error(`Error fetching BOM for order item ${item.id}:`, err.message);
      }
    }
    return item;
  }));

  order.items = enrichedItems;
  return order;
};

const updateOrder = async (id, orderData) => {
  const {
    quotation_id,
    client_id,
    project_name,
    order_date,
    delivery_date,
    status,
    source_type,
    warehouse,
    cgst_rate,
    sgst_rate,
    profit_margin,
    subtotal,
    gst,
    grand_total,
    items,
    host_company_id
  } = orderData;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(`
      UPDATE orders SET
        quotation_id = ?,
        client_id = ?,
        project_name = ?,
        order_date = ?,
        delivery_date = ?,
        status = ?,
        source_type = ?,
        warehouse = ?,
        cgst_rate = ?,
        sgst_rate = ?,
        profit_margin = ?,
        subtotal = ?,
        gst = ?,
        grand_total = ?,
        host_company_id = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [
      quotation_id || null,
      client_id,
      project_name || null,
      order_date,
      delivery_date || null,
      status,
      source_type || 'DIRECT',
      warehouse || null,
      cgst_rate || 0,
      sgst_rate || 0,
      profit_margin || 0,
      subtotal || 0,
      gst || 0,
      grand_total || 0,
      host_company_id || null,
      id
    ]);

    // Update items: Simple delete and re-insert for updates
    await connection.execute('DELETE FROM order_items WHERE order_id = ?', [id]);

    if (items && items.length > 0) {
      for (const item of items) {
        await connection.execute(`
          INSERT INTO order_items
          (order_id, item_code, drawing_no, description, type, hsn_code, delivery_date, quantity, rate, amount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          id,
          item.item_code,
          item.drawing_no,
          item.description,
          item.type,
          item.hsn_code || null,
          item.delivery_date || null,
          item.quantity || 0,
          item.rate || 0,
          item.amount || 0
        ]);
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const deleteOrder = async (id) => {
  const [payments] = await pool.query(
    "SELECT id FROM customer_payments WHERE sales_order_id = ? AND sales_order_source = 'DIRECT_ORDER'",
    [id]
  );
  if (payments.length > 0) {
    throw new Error("Sales Order cannot be deleted because payment transactions exist against the generated customer invoice.");
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('DELETE FROM order_items WHERE order_id = ?', [id]);
    await connection.execute('DELETE FROM orders WHERE id = ?', [id]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getApprovedDrawings = async (companyId = null) => {
  let query = `SELECT so.*, c.company_name, c.company_code, c.id as company_id_check,
     IFNULL(ct.email, '') as email,
     IFNULL(ct.phone, '') as phone,
     IFNULL(ct.name, '') as contact_person,
     cp.po_number, cp.po_date, cp.currency AS po_currency, cp.net_total AS po_net_total,
     (SELECT reason FROM design_rejections WHERE sales_order_id = so.id ORDER BY created_at DESC LIMIT 1) as rejection_reason
     FROM sales_orders so
     LEFT JOIN companies c ON c.id = so.company_id
     LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
     LEFT JOIN (
       SELECT company_id, email, phone, name, 
              ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY contact_type = 'PRIMARY' DESC, id ASC) as rn
       FROM contacts
     ) ct ON ct.company_id = c.id AND ct.rn = 1
     WHERE (TRIM(so.status) = 'BOM_Approved' 
        OR so.status IN ('PROCUREMENT_IN_PROGRESS', 'MATERIAL_PURCHASE_IN_PROGRESS', 'MATERIAL_READY', 'IN_PRODUCTION', 'PRODUCTION_COMPLETED', 'QC_IN_PROGRESS', 'QC_APPROVED', 'QC_REJECTED', 'READY_FOR_SHIPMENT'))
        AND so.quotation_id IS NULL AND so.is_sales_order = 0`;

  const params = [];
  if (companyId) {
    query += ` AND so.company_id = ?`;
    params.push(companyId);
  }

  query += ` ORDER BY so.created_at DESC`;

  const [rows] = await pool.query(query, params);

  for (const order of rows) {
    const [items] = await pool.query(
      `SELECT soi.*, 
              COALESCE(NULLIF(soi.item_group, ''), NULLIF(soi.item_type, ''), 'FG') as item_group,
              COALESCE(
                poi.quantity, 
                (SELECT MAX(quantity) FROM sales_order_items WHERE sales_order_id = soi.sales_order_id AND TRIM(drawing_no) = TRIM(soi.drawing_no)),
                soi.quantity
              ) as design_qty 
       FROM sales_order_items soi
       LEFT JOIN sales_orders so ON soi.sales_order_id = so.id
       LEFT JOIN customer_po_items poi ON so.customer_po_id = poi.customer_po_id AND TRIM(poi.drawing_no) = TRIM(soi.drawing_no)
       WHERE soi.sales_order_id = ?
       AND (soi.item_group = 'FG' OR soi.item_type = 'FG' OR soi.item_group IS NULL OR soi.item_group = '')`,
      [order.id]
    );
    order.items = items;
  }

  return rows;
};

const getStats = async () => {
  const [rows] = await pool.query(`
    SELECT 
      COUNT(*) as total_orders,
      SUM(CASE WHEN status = 'Draft' THEN 1 ELSE 0 END) as draft_orders,
      SUM(CASE WHEN status = 'Created' THEN 1 ELSE 0 END) as open_orders,
      SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END) as delivered_orders,
      SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
      SUM(grand_total) as total_amount
    FROM orders
  `);

  return {
    total: rows[0].total_orders || 0,
    draft: rows[0].draft_orders || 0,
    open: rows[0].open_orders || 0,
    delivered: rows[0].delivered_orders || 0,
    cancelled: rows[0].cancelled_orders || 0,
    totalAmount: rows[0].total_amount || 0
  };
};

const generateOrderPDF = async (orderId) => {
  const [orderRows] = await pool.query(
    `SELECT o.*, c.company_name, c.company_code, c.gstin, c.pan, c.cin,
            ba.line1 as billing_line1, ba.line2 as billing_line2, ba.city as billing_city, 
            ba.state as billing_state, ba.pincode as billing_pincode,
            cp.po_number, cp.po_date, cp.currency AS po_currency, cp.project_name as cp_project_name
     FROM orders o
     LEFT JOIN companies c ON c.id = o.client_id
     LEFT JOIN company_addresses ba ON ba.company_id = c.id AND ba.address_type = 'BILLING'
     LEFT JOIN customer_pos cp ON cp.id = o.quotation_id AND o.source_type = 'DIRECT'
     WHERE o.id = ? OR o.public_id = ?`,
    [orderId, orderId]
  );

  if (!orderRows.length) throw new Error('Order not found');
  const order = orderRows[0];

  // Enrich order with Customer PO contact details if it's direct
  if (order.source_type === 'DIRECT' && order.quotation_id) {
    try {
      const customerPoService = require('./customerPoService');
      const poData = await customerPoService.getCustomerPoById(order.quotation_id);
      if (poData) {
        order.contact_email = (poData.email && poData.email !== '—') ? poData.email : (order.contact_email || poData.company_email || '');
        order.contact_mobile = (poData.phone && poData.phone !== '—') ? poData.phone : (order.contact_mobile || poData.billing_contact_phone || poData.shipping_contact_phone || '');
        order.contact_person = (poData.contact_person && poData.contact_person !== '—') ? poData.contact_person : (order.contact_person || poData.billing_contact_name || poData.shipping_contact_name || '');
        if (poData.billing_address && poData.billing_address !== '—') {
          order.billing_address = poData.billing_address;
        }
        if (poData.shipping_address && poData.shipping_address !== '—') {
          order.shipping_address = poData.shipping_address;
        }
      }
    } catch (err) {
      console.error('Error enriching order PDF from Customer PO:', err);
    }
  }

  const adminCompanyMasterService = require('./adminCompanyMasterService');
  let activeCompany = null;
  if (order.host_company_id) {
    try {
      activeCompany = await adminCompanyMasterService.getCompanyById(order.host_company_id);
    } catch (err) {
      console.error('Error fetching host company by id:', err);
    }
  }
  if (!activeCompany) {
    activeCompany = await adminCompanyMasterService.getActiveCompany();
  }

  const hostCompanyName = activeCompany?.company_name || 'SP TECHPIONEER PVT LTD';
  const hostCompanyAddress = activeCompany?.company_address || 'PLOT NO.97, SECTOR NO 07, PCNDTA\nBHOSARI, PUNE-411026';
  const hostCompanyAddressLines = hostCompanyAddress ? hostCompanyAddress.split('\n') : ['PLOT NO.97, SECTOR NO 07, PCNDTA', 'BHOSARI, PUNE-411026'];
  const hostGSTIN = activeCompany?.gstin || '27AAPCS1193L1ZQ';
  const hostPAN = activeCompany?.pan || 'N/A';
  const invoiceFooterNotes = activeCompany?.invoice_footer_notes || '';

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

  const companyService = require('./companyService');
  let companyDetails = null;
  try {
    const companyId = order.client_id || order.company_id;
    if (companyId) {
      companyDetails = await companyService.getCompanyById(companyId);
    }
  } catch (err) {
    console.error('Error fetching company details for PDF:', err);
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
  if (!order.billing_address || order.billing_address === '') {
    const addrParts = [
      billing.line1 || order.billing_line1,
      billing.line2 || order.billing_line2,
      billing.city || order.billing_city,
      billing.state || order.billing_state,
      (billing.pincode || order.billing_pincode) ? `Pincode: ${billing.pincode || order.billing_pincode}` : null
    ].filter(Boolean);
    order.billing_address = addrParts.join(', ');
  }
  order.billing_state = billing.state || order.billing_state || '';

  // Format shipping address
  if (!order.shipping_address || order.shipping_address === '') {
    const shippingAddrParts = [
      shipping.line1,
      shipping.line2,
      shipping.city,
      shipping.state,
      shipping.pincode ? `Pincode: ${shipping.pincode}` : null
    ].filter(Boolean);
    order.shipping_address = shippingAddrParts.length > 0 ? shippingAddrParts.join(', ') : order.billing_address;
  }
  order.shipping_state = shipping.state || order.billing_state || '';

  // Format contacts
  order.billing_contact_name = order.contact_person || billingContact.name || '';
  order.billing_contact_phone = order.contact_mobile || billingContact.phone || '';
  order.shipping_contact_name = order.contact_person || shippingContact.name || '';
  order.shipping_contact_phone = order.contact_mobile || shippingContact.phone || '';

  // GSTIN
  order.gstin = companyDetails?.gstin || order.gstin || '';

  const [items] = await pool.query(
    `SELECT oi.*
     FROM order_items oi
     WHERE oi.order_id = ?`,
    [order.id]
  );

  // Enrich items with sub-assemblies
  const enrichedItems = await Promise.all(items.map(async (item) => {
    // Try to fetch sub-assemblies if linked to a PO
    if (order.customer_po_id || (order.source_type === 'DIRECT' && order.quotation_id)) {
      const poId = order.customer_po_id || order.quotation_id;
      const [poItems] = await pool.query(
        `SELECT id FROM customer_po_items 
         WHERE customer_po_id = ? AND (drawing_no = ? OR item_code = ?)`,
        [poId, item.drawing_no, item.item_code]
      );

      if (poItems.length > 0) {
        const [storedSA] = await pool.query(
          `SELECT drawing_no as drawingNo, description, quantity, unit, rate, hsn_code, delivery_date 
           FROM customer_po_item_subassemblies 
           WHERE po_item_id = ?`,
          [poItems[0].id]
        );
        if (storedSA.length > 0) {
          return { ...item, sub_assemblies: storedSA };
        }
      }
    }

    // Fallback to dynamic BOM fetching
    const isFG = (item.item_code || '').startsWith('FG-') ||
      (item.drawing_no && item.drawing_no !== '—');

    if (isFG) {
      try {
        const sub_assemblies = await bomService.getItemComponents(null, item.item_code, item.drawing_no);
        if (sub_assemblies && sub_assemblies.length > 0) {
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
      } catch (err) {
        console.error(`Error fetching BOM for order item ${item.id}:`, err.message);
      }
    }
    return item;
  }));

  const puppeteer = require('puppeteer');
  const mustache = require('mustache');

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page { size: A4 portrait; margin: 6mm 8mm; }
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 8pt; line-height: 1.3; color: #000; margin: 0; padding: 0; background: #fff; }
        .invoice-card { width: 100%; border: 1px solid #000; }
        .title-header { text-align: center; font-weight: bold; font-size: 10.5pt; padding: 4px 0; border-bottom: 1px solid #000; text-transform: capitalize; }
        
        .row-flex { display: flex; width: 100%; }
        .border-b { border-bottom: 1px solid #000; }
        .border-r { border-right: 1px solid #000; }

        .seller-box { width: 48%; padding: 6px 10px; min-height: 90px; border-right: 1px solid #000; }
        .seller-name { font-weight: bold; font-size: 9.5pt; margin-bottom: 3px; text-transform: uppercase; }
        .seller-line { font-size: 8pt; margin-bottom: 2px; line-height: 1.3; }

        .meta-box { width: 52%; }
        .meta-table { width: 100%; border-collapse: collapse; }
        .meta-table td { border-bottom: 1px solid #000; border-right: 1px solid #000; padding: 3px 6px; height: 22px; vertical-align: top; font-size: 8pt; }
        .meta-table tr td:last-child { border-right: none; }
        .meta-table tr:last-child td { border-bottom: none; }
        .meta-lbl { font-size: 6.8pt; color: #333; display: block; margin-bottom: 1px; }
        .meta-val { font-weight: bold; font-size: 8pt; }

        .party-col { width: 50%; padding: 6px 10px; min-height: 65px; }
        .party-title { font-size: 7.5pt; color: #333; font-weight: normal; margin-bottom: 3px; }
        .party-name { font-weight: bold; font-size: 9pt; margin-bottom: 3px; text-transform: uppercase; }

        .item-table { width: 100%; border-collapse: collapse; border-bottom: 1px solid #000; }
        .item-table th { border: 1px solid #000; padding: 4px 3px; font-size: 7.5pt; font-weight: bold; text-align: center; background-color: #ffffff; }
        .item-table td { border-left: 1px solid #000; border-right: 1px solid #000; padding: 5px 6px; vertical-align: top; font-size: 8pt; }
        .item-code { font-weight: bold; font-size: 8.5pt; }
        .item-desc { font-size: 9pt; font-weight: bold; margin-top: 1px; text-transform: uppercase; }
        
        .item-table tr.total-row td { border-top: 1px solid #000; border-bottom: 2px solid #000; font-weight: bold; font-size: 8.5pt; padding: 5px 6px; }

        .charge-box { padding: 8px 10px; border-bottom: 1px solid #000; display: flex; justify-content: space-between; align-items: flex-end; }
        .charge-lbl { font-size: 7.5pt; color: #333; }
        .charge-words { font-weight: bold; font-size: 8.5pt; margin-top: 2px; }

        .gst-table { width: 100%; border-collapse: collapse; border-bottom: 1px solid #000; }
        .gst-table th, .gst-table td { border: 1px solid #000; padding: 3px 4px; font-size: 7.5pt; text-align: center; height: 18px; }
        .gst-table th { font-weight: bold; }
        .gst-table td.num { text-align: right; }

        .tax-words-box { padding: 6px 10px; border-bottom: 1px solid #000; font-size: 8pt; }

        .footer-flex { display: flex; border-bottom: 1px solid #000; min-height: 75px; }
        .decl-box { width: 50%; padding: 6px 10px; font-size: 7.5pt; border-right: 1px solid #000; }
        .sig-box-right { width: 50%; padding: 6px 10px; display: flex; flex-direction: column; justify-content: space-between; text-align: right; font-size: 8pt; }
        .computer-msg { text-align: center; font-size: 7.5pt; padding: 3px 0; }
      </style>
    </head>
    <body>
      <div class="invoice-card">
        <div class="title-header">Tax Invoice</div>

        <!-- Top Section: 58% Left Stacked Blocks, 42% Right Metadata Table -->
        <div class="row-flex border-b">
          <!-- Left section (Company, Consignee & Buyer stacked) -->
          <div style="width: 58%; border-right: 1px solid #000; display: flex; flex-direction: column;">
            <!-- Seller Box -->
            <div style="padding: 4px 6px; border-bottom: 1px solid #000; flex: 1;">
              <div class="seller-name">{{hostCompanyName}}</div>
              {{#hostCompanyAddressLines}}
              <div class="seller-line">{{.}}</div>
              {{/hostCompanyAddressLines}}
              <div class="seller-line"><strong>GSTIN/UIN:</strong> {{hostGSTIN}}</div>
              <div class="seller-line"><strong>State Name :</strong> {{hostStateName}}</div>
            </div>
            <!-- Consignee Box -->
            <div style="padding: 4px 6px; border-bottom: 1px solid #000; flex: 1;">
              <div class="party-title">Consignee (Ship to)</div>
              <div class="party-name">{{consignee_name}}</div>
              <div class="seller-line">{{consignee_address}}</div>
              <div class="seller-line"><strong>GSTIN/UIN :</strong> {{consignee_gstin}}</div>
              <div class="seller-line"><strong>State Name :</strong> {{consignee_state}}</div>
            </div>
            <!-- Buyer Box -->
            <div style="padding: 4px 6px; flex: 1;">
              <div class="party-title">Buyer (Bill to)</div>
              <div class="party-name">{{buyer_name}}</div>
              <div class="seller-line">{{buyer_address}}</div>
              <div class="seller-line"><strong>GSTIN/UIN :</strong> {{buyer_gstin}}</div>
              <div class="seller-line"><strong>State Name :</strong> {{buyer_state}}</div>
            </div>
          </div>

          <!-- Right section (Invoice Details 7-row Metadata Table) -->
          <div style="width: 42%;">
            <table class="meta-table" style="width: 100%; height: 100%; border-collapse: collapse;">
              <tr>
                <td style="width: 50%; border-bottom: 1px solid #000; border-right: 1px solid #000; padding: 2px 4px; vertical-align: top;">
                  <span class="meta-lbl">Invoice No.</span>
                  <span class="meta-val">{{invoice_no}}</span>
                </td>
                <td style="width: 50%; border-bottom: 1px solid #000; padding: 2px 4px; vertical-align: top;">
                  <span class="meta-lbl">Dated</span>
                  <span class="meta-val">{{invoice_date}}</span>
                </td>
              </tr>
              <tr>
                <td style="border-bottom: 1px solid #000; border-right: 1px solid #000; padding: 2px 4px; vertical-align: top;">
                  <span class="meta-lbl">Delivery Note</span>
                  <span class="meta-val">{{delivery_note}}</span>
                </td>
                <td style="border-bottom: 1px solid #000; padding: 2px 4px; vertical-align: top;">
                  <span class="meta-lbl">Mode/Terms of Payment</span>
                  <span class="meta-val">{{payment_terms}}</span>
                </td>
              </tr>
              <tr>
                <td style="border-bottom: 1px solid #000; border-right: 1px solid #000; padding: 2px 4px; vertical-align: top;">
                  <span class="meta-lbl">Reference No. & Date</span>
                  <span class="meta-val">{{reference_no_date}}</span>
                </td>
                <td style="border-bottom: 1px solid #000; padding: 2px 4px; vertical-align: top;">
                  <span class="meta-lbl">Other References</span>
                  <span class="meta-val">{{other_references}}</span>
                </td>
              </tr>
              <tr>
                <td style="border-bottom: 1px solid #000; border-right: 1px solid #000; padding: 2px 4px; vertical-align: top;">
                  <span class="meta-lbl">Buyer's Order No.</span>
                  <span class="meta-val">{{po_number}}</span>
                </td>
                <td style="border-bottom: 1px solid #000; padding: 2px 4px; vertical-align: top;">
                  <span class="meta-lbl">Dated</span>
                  <span class="meta-val">{{po_date}}</span>
                </td>
              </tr>
              <tr>
                <td style="border-bottom: 1px solid #000; border-right: 1px solid #000; padding: 2px 4px; vertical-align: top;">
                  <span class="meta-lbl">Dispatch Doc No.</span>
                  <span class="meta-val">{{dispatch_doc_no}}</span>
                </td>
                <td style="border-bottom: 1px solid #000; padding: 2px 4px; vertical-align: top;">
                  <span class="meta-lbl">Delivery Note Date</span>
                  <span class="meta-val">{{delivery_note_date}}</span>
                </td>
              </tr>
              <tr>
                <td style="border-bottom: 1px solid #000; border-right: 1px solid #000; padding: 2px 4px; vertical-align: top;">
                  <span class="meta-lbl">Dispatched through</span>
                  <span class="meta-val">{{dispatched_through}}</span>
                </td>
                <td style="border-bottom: 1px solid #000; padding: 2px 4px; vertical-align: top;">
                  <span class="meta-lbl">Destination</span>
                  <span class="meta-val">{{destination}}</span>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding: 2px 4px; vertical-align: top;">
                  <span class="meta-lbl">Terms of Delivery</span>
                  <span class="meta-val">{{terms_of_delivery}}</span>
                </td>
              </tr>
            </table>
          </div>
        </div>

        <!-- Main Items Table -->
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
            <tr>
              <td style="text-align: center;">{{index}}</td>
              <td>
                {{#drawing_no}}<div class="item-code">{{drawing_no}}</div>{{/drawing_no}}
                <div class="item-desc">{{description}}</div>
                {{#sub_assemblies}}
                <div style="padding-left: 15px; font-size: 7.5pt; color: #333; margin-top: 2px; font-weight: normal;">
                  • {{drawingNo}} {{description}}
                </div>
                {{/sub_assemblies}}
              </td>
              <td style="text-align: center;">{{hsn_code}}</td>
              <td style="text-align: right; font-weight: bold; white-space: nowrap;">{{quantity}} {{unit}}</td>
              <td style="text-align: right; white-space: nowrap;">{{rate}}</td>
              <td style="text-align: center;">{{unit}}</td>
              <td style="text-align: center;">{{discount_percent}}</td>
              <td style="text-align: right; font-weight: bold; white-space: nowrap;">{{item_amount}}</td>
            </tr>
            {{/items}}

            <!-- Tax breakdown rows matching client sample placement -->
            {{#has_cgst}}
            <tr style="white-space: nowrap;">
              <td></td>
              <td style="text-align: right; font-style: italic; font-size: 8.5pt; font-weight: bold; white-space: nowrap;">
                Output CGST @ {{cgst_rate_str}}
              </td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td style="text-align: center; font-size: 8.5pt; font-style: italic; font-weight: bold; white-space: nowrap; vertical-align: middle;">{{cgst_rate_str}}</td>
              <td style="text-align: right; font-size: 8.5pt; font-weight: bold; white-space: nowrap; vertical-align: middle;">{{cgst_total}}</td>
            </tr>
            {{/has_cgst}}

            {{#has_sgst}}
            <tr style="white-space: nowrap;">
              <td></td>
              <td style="text-align: right; font-style: italic; font-size: 8.5pt; font-weight: bold; white-space: nowrap;">
                Output SGST @ {{sgst_rate_str}}
              </td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td style="text-align: center; font-size: 8.5pt; font-style: italic; font-weight: bold; white-space: nowrap; vertical-align: middle;">{{sgst_rate_str}}</td>
              <td style="text-align: right; font-size: 8.5pt; font-weight: bold; white-space: nowrap; vertical-align: middle;">{{sgst_total}}</td>
            </tr>
            {{/has_sgst}}

            {{#has_igst}}
            <tr style="white-space: nowrap;">
              <td></td>
              <td style="text-align: right; font-style: italic; font-size: 8.5pt; font-weight: bold; white-space: nowrap;">
                Output IGST @ {{igst_rate_str}}
              </td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td style="text-align: center; font-size: 8.5pt; font-style: italic; font-weight: bold; white-space: nowrap; vertical-align: middle;">{{igst_rate_str}}</td>
              <td style="text-align: right; font-size: 8.5pt; font-weight: bold; white-space: nowrap; vertical-align: middle;">{{igst_total}}</td>
            </tr>
            {{/has_igst}}

            {{#round_off_val}}
            <tr style="white-space: nowrap;">
              <td></td>
              <td style="text-align: right; font-style: italic; font-size: 8.5pt; font-weight: bold; white-space: nowrap;">
                Rounding Off.
              </td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td style="text-align: right; font-size: 8.5pt; font-weight: bold; white-space: nowrap; vertical-align: middle;">{{round_off_val}}</td>
            </tr>
            {{/round_off_val}}

            {{#empty_rows}}
            <tr style="height: 18px;">
              <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
            </tr>
            {{/empty_rows}}

            <!-- Total Row -->
            <tr class="total-row">
              <td></td>
              <td style="text-align: right;">Total</td>
              <td></td>
              <td style="text-align: right; white-space: nowrap;">{{total_quantity}}</td>
              <td></td>
              <td></td>
              <td></td>
              <td style="text-align: right; white-space: nowrap;">₹ {{net_total}}</td>
            </tr>
          </tbody>
        </table>

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
              <th colspan="2">Central Tax</th>
              <th colspan="2">State Tax</th>
              <th rowspan="2" style="width: 16%;">Total Tax Amount</th>
            </tr>
            <tr>
              <th style="width: 9%;">Rate</th>
              <th style="width: 14%;">Amount</th>
              <th style="width: 9%;">Rate</th>
              <th style="width: 14%;">Amount</th>
            </tr>
          </thead>
          <tbody>
            {{#tax_summary}}
            <tr>
              <td style="text-align: center;">{{hsn_code}}</td>
              <td class="num">{{taxable_value}}</td>
              <td style="text-align: center;">{{central_rate}}</td>
              <td class="num">{{central_amount}}</td>
              <td style="text-align: center;">{{state_rate}}</td>
              <td class="num">{{state_amount}}</td>
              <td class="num" style="font-weight: bold;">{{total_tax}}</td>
            </tr>
            {{/tax_summary}}
            <tr style="font-weight: bold;">
              <td style="text-align: right;">Total</td>
              <td class="num">{{subtotal}}</td>
              <td></td>
              <td class="num">{{cgst_total}}</td>
              <td></td>
              <td class="num">{{sgst_total}}</td>
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
            <div style="margin-top: 4px; margin-bottom: 4px;"><img src="{{signatureBase64}}" style="max-height: 40px;" /></div>
            {{/signatureBase64}}
            {{^signatureBase64}}
            <div style="margin-top: 35px;"></div>
            {{/signatureBase64}}
            <div style="font-size: 8pt; font-weight: bold;">Authorised Signatory</div>
          </div>
        </div>

        <div class="computer-msg">This is a Computer Generated Invoice</div>
      </div>
    </body>
    </html>
  `;

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/\s/g, '-') : '';
  const formatCurrency = (val) => Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const hostCompanyAddressLinesFiltered = (hostCompanyAddressLines || []).filter(line => !line.toLowerCase().includes('code:') && !line.toLowerCase().includes('code :'));

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

  const hostStateName = activeCompany?.state || 'Maharashtra';
  const hostStateCode = getStateCode(hostStateName, hostGSTIN);

  const buyerStateName = order.billing_state || 'Maharashtra';
  const buyerStateCode = getStateCode(buyerStateName, order.gstin);

  const consigneeStateName = order.shipping_state || order.billing_state || 'Maharashtra';
  const consigneeStateCode = getStateCode(consigneeStateName, order.gstin);

  let totalTaxableValue = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalQuantityNum = 0;
  let defaultUnit = 'NOS';

  // Group items by HSN for tax summary
  const taxMap = new Map();
  const formattedItems = enrichedItems.map((item, idx) => {
    const qty = Number(item.quantity || 0);
    const rate = Number(item.rate || 0);
    const taxable = qty * rate;
    const cgst = taxable * (Number(order.cgst_rate || 0) / 100);
    const sgst = taxable * (Number(order.sgst_rate || 0) / 100);

    totalTaxableValue += taxable;
    totalCgst += cgst;
    totalSgst += sgst;

    totalQuantityNum += qty;
    if (item.unit) defaultUnit = item.unit;

    const hsn = item.hsn_code || '84779000';
    if (!taxMap.has(hsn)) {
      taxMap.set(hsn, {
        hsn_code: hsn,
        taxable_value: 0,
        central_rate: Number(order.cgst_rate || 0).toFixed(1) + '%',
        central_amount: 0,
        state_rate: Number(order.sgst_rate || 0).toFixed(1) + '%',
        state_amount: 0,
        total_tax: 0
      });
    }
    const entry = taxMap.get(hsn);
    entry.taxable_value += taxable;
    entry.central_amount += cgst;
    entry.state_amount += sgst;
    entry.total_tax += (cgst + sgst);

    return {
      ...item,
      index: idx + 1,
      quantity: qty.toFixed(3),
      unit: item.unit || 'NOS',
      rate: formatCurrency(rate),
      discount_percent: item.discount_percent ? item.discount_percent + '%' : '',
      item_amount: formatCurrency(taxable)
    };
  });

  const taxSummary = Array.from(taxMap.values()).map(t => ({
    ...t,
    taxable_value: formatCurrency(t.taxable_value),
    central_amount: formatCurrency(t.central_amount),
    state_amount: formatCurrency(t.state_amount),
    total_tax: formatCurrency(t.total_tax)
  }));

  const rawNetTotal = totalTaxableValue + totalCgst + totalSgst;
  const netTotalRounded = Math.round(rawNetTotal);
  const roundOffNum = Number((netTotalRounded - rawNetTotal).toFixed(2));
  const totalTaxAmt = totalCgst + totalSgst;

  const viewData = {
    ...order,
    invoice_no: order.order_no || order.invoice_no || `2026-27/${String(order.id).padStart(3, '0')}`,
    invoice_date: formatDate(order.order_date || order.created_at),
    delivery_note: order.delivery_note || '',
    payment_terms: order.payment_terms || '60 Days',
    reference_no_date: order.reference_no_date || `${order.order_no || order.id} dt. ${formatDate(order.created_at)}`,
    other_references: order.other_references || '',
    po_number: order.po_number || '',
    po_date: formatDate(order.po_date),
    dispatch_doc_no: order.dispatch_doc_no || '',
    delivery_note_date: formatDate(order.delivery_note_date),
    dispatched_through: order.dispatched_through || '',
    destination: order.destination || 'PLANT:1811',
    terms_of_delivery: order.terms_of_delivery || '',

    hostCompanyName,
    hostCompanyAddressLines: hostCompanyAddressLinesFiltered,
    hostGSTIN,
    hostStateName,
    hostStateCode,

    consignee_name: order.company_name,
    consignee_address: order.shipping_address || order.billing_address,
    consignee_gstin: order.gstin || '',
    consignee_state: consigneeStateName,
    consignee_state_code: consigneeStateCode,

    buyer_name: order.company_name,
    buyer_address: order.billing_address,
    buyer_gstin: order.gstin || '',
    buyer_state: buyerStateName,
    buyer_state_code: buyerStateCode,

    items: formattedItems,
    has_cgst: totalCgst > 0,
    cgst_rate: Number(order.cgst_rate || 9).toFixed(1),
    cgst_rate_str: (Number(order.cgst_rate || 9) % 1 === 0 ? Number(order.cgst_rate || 9) : Number(order.cgst_rate || 9).toFixed(1)) + '%',
    cgst_total: formatCurrency(totalCgst),
    has_sgst: totalSgst > 0,
    sgst_rate: Number(order.sgst_rate || 9).toFixed(1),
    sgst_rate_str: (Number(order.sgst_rate || 9) % 1 === 0 ? Number(order.sgst_rate || 9) : Number(order.sgst_rate || 9).toFixed(1)) + '%',
    sgst_total: formatCurrency(totalSgst),
    has_igst: false,
    round_off_val: roundOffNum !== 0 ? (roundOffNum > 0 ? `+${roundOffNum.toFixed(2)}` : roundOffNum.toFixed(2)) : null,
    total_quantity: `${totalQuantityNum.toFixed(3)} ${defaultUnit}`,
    net_total: formatCurrency(netTotalRounded),
    net_total_words: numberToWords(netTotalRounded),

    subtotal: formatCurrency(totalTaxableValue),
    tax_summary: taxSummary,
    tax_total_summary: formatCurrency(totalTaxAmt),
    tax_total_words: numberToWords(totalTaxAmt),

    empty_rows: Array.from({ length: Math.max(0, 4 - items.length) }),
    signatureBase64
  };

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
    console.error('[PDF Generation] Puppeteer error:', error.message);
    throw new Error('PDF generation unavailable.');
  }
};

module.exports = {
  listOrders,
  createOrder,
  getOrderById,
  updateOrder,
  deleteOrder,
  getApprovedDrawings,
  getStats,
  generateOrderPDF
};
