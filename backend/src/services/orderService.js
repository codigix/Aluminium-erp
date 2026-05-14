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

const generateOrderNo = async () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  
  const [rows] = await pool.query(
    'SELECT order_no FROM orders WHERE order_no LIKE ? ORDER BY order_no DESC LIMIT 1',
    [`ORD-${dateStr}-%`]
  );

  let sequence = 1;
  if (rows.length > 0) {
    const lastNo = rows[0].order_no;
    const lastSeq = parseInt(lastNo.split('-')[2]);
    if (!isNaN(lastSeq)) {
      sequence = lastSeq + 1;
    }
  }

  return `ORD-${dateStr}-${String(sequence).padStart(3, '0')}`;
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
  return rows;
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
    items
  } = orderData;

  const orderNo = await generateOrderNo();
  const publicId = crypto.randomUUID();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.execute(`
      INSERT INTO orders
      (order_no, public_id, quotation_id, client_id, project_name, order_date, delivery_date, 
       status, source_type, warehouse, cgst_rate, sgst_rate, profit_margin,
       subtotal, gst, grand_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Created', ?, ?, ?, ?, ?, ?, ?, ?)
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
      grand_total || 0
    ]);

    const orderId = result.insertId;

    if (items && items.length > 0) {
      for (const item of items) {
        await connection.execute(`
          INSERT INTO order_items
          (order_id, item_code, drawing_no, description, type, quantity, rate, amount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          orderId,
          item.item_code,
          item.drawing_no,
          item.description,
          item.type,
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
           ct.email AS contact_email, ct.phone AS contact_mobile,
           COALESCE(NULLIF(o.project_name, ''), NULLIF(cp.project_name, ''), 'General Project') as project_name
    FROM orders o
    JOIN companies c ON c.id = o.client_id
    LEFT JOIN customer_pos cp ON cp.id = o.quotation_id AND o.source_type = 'DIRECT'
    LEFT JOIN (
       SELECT company_id, email, phone, 
              ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY contact_type = 'PRIMARY' DESC, id ASC) as rn
       FROM contacts
    ) ct ON ct.company_id = c.id AND ct.rn = 1
    WHERE o.id = ? OR o.public_id = ?
  `, [id, id]);
  
  if (rows.length === 0) return null;
  
  const order = rows[0];
  const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
  
  const enrichedItems = await Promise.all(items.map(async (item) => {
    // Try to fetch sub-assemblies if linked to a PO
    if (order.customer_po_id || (order.source_type === 'DIRECT' && order.quotation_id)) {
      const poId = order.customer_po_id || order.quotation_id;
      // Find matching PO item to get its sub-assemblies
      const [poItems] = await pool.query(
        `SELECT id FROM customer_po_items 
         WHERE customer_po_id = ? AND (drawing_no = ? OR item_code = ?)`,
        [poId, item.drawing_no, item.item_code]
      );

      if (poItems.length > 0) {
        const [storedSA] = await pool.query(
          `SELECT drawing_no as drawingNo, description, quantity, unit, rate 
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
    items
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
      id
    ]);

    // Update items: Simple delete and re-insert for updates
    await connection.execute('DELETE FROM order_items WHERE order_id = ?', [id]);
    
    if (items && items.length > 0) {
      for (const item of items) {
        await connection.execute(`
          INSERT INTO order_items
          (order_id, item_code, drawing_no, description, type, quantity, rate, amount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          id,
          item.item_code,
          item.drawing_no,
          item.description,
          item.type,
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
  await pool.execute('DELETE FROM orders WHERE id = ?', [id]);
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
  
  // Format billing address
  const addrParts = [
    order.billing_line1,
    order.billing_line2,
    order.billing_city,
    order.billing_state,
    order.billing_pincode ? `Pincode: ${order.billing_pincode}` : null
  ].filter(Boolean);
  order.billing_address = addrParts.join(', ');

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
          `SELECT drawing_no as drawingNo, description, quantity, unit, rate 
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
      <style>
        @page { size: A4; margin: 10mm; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #000; line-height: 1.3; margin: 0; font-size: 10px; }
        .invoice-container { border: 1px solid #000; min-height: 270mm; position: relative; }
        
        .tax-invoice-label { text-align: center; border-bottom: 1px solid #000; font-weight: bold; font-size: 14px; padding: 5px; }
        
        .header-section { display: flex; border-bottom: 1px solid #000; }
        .header-left { flex: 1.5; padding: 10px; border-right: 1px solid #000; }
        .header-right { flex: 1; padding: 10px; }
        
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
        
        .sa-row td { font-size: 10px; color: #000; font-weight: bold; border-top: none; }
        .sa-drw { font-size: 8px; color: #000; font-weight: normal; margin-top: 2px; }
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
                <td>{{order_no}}</td>
              </tr>
              <tr>
                <td class="meta-label">Dated</td>
                <td>{{order_date}}</td>
              </tr>
              <tr>
                <td class="meta-label">Buyer's Order No.</td>
                <td>{{po_number}}</td>
              </tr>
              <tr>
                <td class="meta-label">PO Date</td>
                <td>{{po_date}}</td>
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
            <div class="address-text">State Name: {{billing_state}}</div>
          </div>
          <div class="info-box">
            <span class="label">Buyer (Bill to)</span>
            <div style="font-weight: bold; font-size: 11px;">{{company_name}}</div>
            <div class="address-text">{{billing_address}}</div>
            <div class="address-text">GSTIN/UIN: {{gstin}}</div>
            <div class="address-text">State Name: {{billing_state}}</div>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 30px;">Sl No.</th>
              <th>Description of Goods</th>
              <th style="width: 70px;">HSN/SAC</th>
              <th style="width: 60px;">Quantity</th>
              <th style="width: 80px;">Rate</th>
              <th style="width: 40px;">per</th>
              <th style="width: 90px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            {{#formattedItems}}
            <tr class="item-row">
              <td style="text-align: center;">{{index}}</td>
              <td>
                <div style="font-weight: bold;">{{description}}</div>
                {{#drawing_no}}<div style="font-size: 8px; color: #444;">DRW: {{drawing_no}}</div>{{/drawing_no}}
              </td>
              <td style="text-align: center;">{{hsn_code}}</td>
              <td style="text-align: center;">{{quantity}} {{unit}}</td>
              <td style="text-align: right;">{{rate}}</td>
              <td style="text-align: center;">{{unit}}</td>
              <td style="text-align: right; font-weight: bold;">{{item_amount}}</td>
            </tr>
            {{#sub_assemblies}}
            <tr class="sa-row">
              <td></td>
              <td style="padding-left: 20px;">
                <div>{{description}}</div>
                {{#drawingNo}}<div class="sa-drw">DRW: {{drawingNo}}</div>{{/drawingNo}}
              </td>
              <td style="text-align: center;">-</td>
              <td style="text-align: center;">{{quantity}} {{unit}}</td>
              <td style="text-align: right;">{{rate}}</td>
              <td style="text-align: center;">{{unit}}</td>
              <td style="text-align: right;">{{amount}}</td>
            </tr>
            {{/sub_assemblies}}
            {{/formattedItems}}
            {{#empty_rows}}
            <tr style="height: 25px;">
              <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
            </tr>
            {{/empty_rows}}
          </tbody>
        </table>

        <div class="total-section">
          <div class="words-section">
            <div style="font-style: italic; margin-bottom: 10px;">Amount Chargeable (in words)</div>
            <div style="font-weight: bold; font-size: 11px;">{{grand_total_words}}</div>
          </div>
          <div class="calc-section">
            <table class="calc-table">
              <tr>
                <td>Total Taxable Value</td>
                <td>{{subtotal}}</td>
              </tr>
              {{#cgst_total}}
              <tr>
                <td>Output CGST @ {{cgst_rate}}%</td>
                <td>{{cgst_total}}</td>
              </tr>
              {{/cgst_total}}
              {{#sgst_total}}
              <tr>
                <td>Output SGST @ {{sgst_rate}}%</td>
                <td>{{sgst_total}}</td>
              </tr>
              {{/sgst_total}}
              <tr>
                <td>Total</td>
                <td>₹ {{grand_total}}</td>
              </tr>
            </table>
          </div>
        </div>

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

  const formattedItems = enrichedItems.map((item, idx) => ({
    ...item,
    index: idx + 1,
    quantity: Number(item.quantity || 0).toFixed(0),
    rate: formatCurrency(item.rate),
    item_amount: formatCurrency(item.amount),
    unit: item.unit || 'Nos',
    sub_assemblies: (item.sub_assemblies || []).map(sa => ({
      ...sa,
      quantity: Number(sa.quantity || 0).toFixed(3),
      rate: formatCurrency(sa.rate),
      amount: formatCurrency(Number(sa.quantity || 0) * Number(sa.rate || 0)),
      unit: sa.unit || 'Nos'
    }))
  }));

  const cgst_total = Number(order.subtotal || 0) * (Number(order.cgst_rate || 0) / 100);
  const sgst_total = Number(order.subtotal || 0) * (Number(order.sgst_rate || 0) / 100);

  const viewData = {
    ...order,
    order_date: formatDate(order.order_date),
    po_date: formatDate(order.po_date),
    subtotal: formatCurrency(order.subtotal),
    cgst_total: cgst_total > 0 ? formatCurrency(cgst_total) : null,
    sgst_total: sgst_total > 0 ? formatCurrency(sgst_total) : null,
    grand_total: formatCurrency(order.grand_total),
    grand_total_words: numberToWords(order.grand_total),
    formattedItems,
    empty_rows: Array.from({ length: Math.max(0, 10 - items.length) }),
    cgst_rate: Number(order.cgst_rate || 0).toFixed(1),
    sgst_rate: Number(order.sgst_rate || 0).toFixed(1)
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
