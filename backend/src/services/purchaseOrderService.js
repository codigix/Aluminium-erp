const pool = require('../config/db');
const emailService = require('./emailService');
const puppeteer = require('puppeteer');
const mustache = require('mustache');
const stockService = require('./stockService');

/**
 * Helper to find the correct item_code from stock_balance by matching material name/type
 * if the provided item_code is missing or inconsistent.
 */
const getCorrectItemCode = async (item, connection) => {
  let itemCode = item.item_code || item.drawing_no;
  
  // 0. If we already have a specific item code that exists in stock_balance and matches the name, use it!
  if (itemCode && itemCode !== 'auto-generated') {
    const [existing] = await connection.query(
      `SELECT item_code, material_type FROM stock_balance 
       WHERE (item_code = ? OR drawing_no = ?) 
       AND LOWER(TRIM(material_name)) = LOWER(TRIM(?)) 
       LIMIT 1`,
      [itemCode, itemCode, item.material_name]
    );
    if (existing.length > 0) {
      // Update item type to match the existing one if needed
      if (existing[0].material_type) {
        item.material_type = existing[0].material_type;
      }
      return existing[0].item_code;
    }
  }

  if (item.material_name) {
    // 1. Try matching by name and material type
    const [sb] = await connection.query(
      `SELECT item_code FROM stock_balance 
       WHERE LOWER(TRIM(material_name)) = LOWER(TRIM(?)) 
       AND (material_type = ? OR UPPER(REPLACE(material_type, ' ', '_')) = UPPER(REPLACE(?, ' ', '_')))
       LIMIT 1`,
      [item.material_name, item.material_type, item.material_type]
    );
    
    if (sb.length > 0) {
      return sb[0].item_code;
    }
    
    // 2. If not found, try matching by name only (more flexible)
    const [sbNameOnly] = await connection.query(
      `SELECT item_code FROM stock_balance 
       WHERE LOWER(TRIM(material_name)) = LOWER(TRIM(?)) 
       LIMIT 1`,
      [item.material_name]
    );
    
    if (sbNameOnly.length > 0) {
      return sbNameOnly[0].item_code;
    }
  }

  // If we have an item code, return it as is if no match found in stock_balance
  if (itemCode && itemCode !== 'auto-generated') return itemCode;

  // 3. Fallback: Generate a standard item code using stockService logic if we have name/type
  if (item.material_name) {
    return await stockService.generateItemCode(item.material_name, item.material_type);
  }

  return null;
};

const generatePONumber = async () => {
  const currentYear = new Date().getFullYear();
  const [result] = await pool.query(
    `SELECT COUNT(*) as count FROM purchase_orders 
     WHERE YEAR(created_at) = ?`,
    [currentYear]
  );
  
  const count = (result[0]?.count || 0) + 1;
  const paddedCount = String(count).padStart(4, '0');
  return `PO-${currentYear}-${paddedCount}`;
};

const previewPurchaseOrder = async (quotationId) => {
  const [quotation] = await pool.query(
    'SELECT q.*, so.project_name FROM quotations q LEFT JOIN sales_orders so ON so.id = q.sales_order_id WHERE q.id = ?',
    [quotationId]
  );

  if (!quotation.length) {
    throw new Error('Quotation not found');
  }

  const quote = quotation[0];
  let poNumber = await generatePONumber();

  if (quote.sales_order_id) {
    const [salesOrder] = await pool.query(
      'SELECT customer_po_id FROM sales_orders WHERE id = ?',
      [quote.sales_order_id]
    );

    if (salesOrder.length && salesOrder[0].customer_po_id) {
      const [customerPO] = await pool.query(
        'SELECT po_number FROM customer_pos WHERE id = ?',
        [salesOrder[0].customer_po_id]
      );

      if (customerPO.length && customerPO[0].po_number) {
        poNumber = customerPO[0].po_number;
      }
    }
  }

  return {
    poNumber,
    projectName: quote.project_name || 'Direct Procurement',
    totalAmount: quote.total_amount,
    vendorName: quote.vendor_name,
    notes: quote.notes,
    expectedDeliveryDate: quote.valid_until ? new Date(quote.valid_until).toISOString().split('T')[0] : ''
  };
};

const createPurchaseOrder = async (data, existingConnection = null) => {
  const { quotationId, mrId: providedMrId, expectedDeliveryDate, notes, poNumber: manualPoNumber, items: manualItems, vendorId, vendor_id } = data;
  
  const connection = existingConnection || await pool.getConnection();
  const shouldManageConnection = !existingConnection;

  try {
    if (shouldManageConnection) {
      await connection.beginTransaction();
    }

    let finalVendorId = vendorId || vendor_id;
    let sales_order_id = null;
    let actualMrId = providedMrId;
    let total_amount = 0;
    let items = [];

    let actualExpectedDeliveryDate = expectedDeliveryDate;

    if (quotationId) {
      const [quotation] = await connection.query(
        'SELECT * FROM quotations WHERE id = ?',
        [quotationId]
      );

      if (!quotation.length) {
        throw new Error('Quotation not found');
      }

      const quote = quotation[0];
      finalVendorId = quote.vendor_id;
      sales_order_id = quote.sales_order_id;
      actualMrId = providedMrId || quote.mr_id;
      total_amount = parseFloat(quote.grand_total) || parseFloat(quote.total_amount) || 0;
      
      if (!actualExpectedDeliveryDate && quote.valid_until) {
        actualExpectedDeliveryDate = new Date(quote.valid_until).toISOString().split('T')[0];
      }

      const [quoteItems] = await connection.query(
        `SELECT qi.*, soi.status as sales_order_item_status 
         FROM quotation_items qi
         LEFT JOIN sales_order_items soi ON (qi.drawing_no = soi.drawing_no OR qi.item_code = soi.item_code) AND soi.sales_order_id = ?
         WHERE qi.quotation_id = ?`,
        [quote.sales_order_id, quotationId]
      );
      items = quoteItems.map(item => {
        const qty = parseFloat(item.quantity) || 0;
        const designQty = parseFloat(item.design_qty) || qty;
        return {
          ...item,
          quantity: qty,
          design_qty: designQty,
          unit_rate: parseFloat(item.unit_rate) || 0,
          amount: parseFloat(item.amount) || (qty * parseFloat(item.unit_rate || 0)),
          cgst_percent: parseFloat(item.cgst_percent) || 9,
          cgst_amount: parseFloat(item.cgst_amount) || 0,
          sgst_percent: parseFloat(item.sgst_percent) || 9,
          sgst_amount: parseFloat(item.sgst_amount) || 0,
          total_amount: parseFloat(item.total_amount) || 0
        };
      });
    } else if (actualMrId) {
      // Create PO from Material Request
      const [mr] = await connection.query('SELECT * FROM material_requests WHERE id = ?', [actualMrId]);
      if (!mr.length) throw new Error('Material Request not found');
      
      const mrData = mr[0];
      let planId = null;
      if (mrData.notes && mrData.notes.includes('Generated from Production Plan')) {
        const match = mrData.notes.match(/Generated from Production Plan (PP-[^ ]+)/);
        if (match) {
          const planCode = match[1];
          const [plans] = await connection.query('SELECT id FROM production_plans WHERE plan_code = ?', [planCode]);
          if (plans.length > 0) planId = plans[0].id;
        }
      }

      const [mrItems] = await connection.query(`
        SELECT mri.*, sb.valuation_rate,
               COALESCE(
                 (SELECT MAX(bom_cost) FROM sales_order_items soi WHERE (soi.item_code = mri.item_code OR soi.drawing_no = mri.item_code) AND soi.bom_cost > 0),
                 (SELECT MAX(rate) FROM production_plan_materials ppm WHERE ppm.plan_id = ? AND ppm.item_code = mri.item_code AND ppm.rate > 0),
                 (SELECT MAX(rate) FROM production_plan_sub_assemblies psa WHERE psa.plan_id = ? AND psa.item_code = mri.item_code AND psa.rate > 0),
                 (SELECT MAX(rate) FROM production_plan_items ppi WHERE ppi.plan_id = ? AND ppi.item_code = mri.item_code AND ppi.rate > 0),
                 (SELECT MAX(rate) FROM sales_order_item_materials som WHERE (som.item_code = mri.item_code OR som.drawing_no = mri.item_code) AND som.rate > 0),
                 (SELECT MAX(rate) FROM sales_order_item_components soc WHERE (soc.component_code = mri.item_code OR soc.drawing_no = mri.item_code) AND soc.rate > 0),
                 mri.unit_rate
               ) as bom_rate
        FROM material_request_items mri
        LEFT JOIN (SELECT item_code, MAX(valuation_rate) as valuation_rate FROM stock_balance GROUP BY item_code) sb ON mri.item_code = sb.item_code
        WHERE mri.mr_id = ?
      `, [planId, planId, planId, actualMrId]);
      
      items = mrItems.map(item => {
        const qty = parseFloat(item.quantity) || 0;
        const designQty = parseFloat(item.design_qty) || qty;
        const rate = parseFloat(item.bom_rate || item.unit_rate || item.valuation_rate) || 0;
        const amount = qty * rate;
        const cgstPercent = 9;
        const sgstPercent = 9;
        const cgstAmount = (amount * cgstPercent) / 100;
        const sgstAmount = (amount * sgstPercent) / 100;
        const totalItemAmount = amount + cgstAmount + sgstAmount;

        return {
          ...item,
          design_qty: designQty,
          quantity: qty,
          description: item.item_name || item.description,
          material_name: item.item_name || item.material_name,
          material_type: item.item_type || item.material_type,
          drawing_no: item.drawing_no || null,
          drawing_id: item.drawing_id || null,
          unit: item.uom || item.unit || 'NOS',
          unit_rate: rate,
          amount: amount,
          cgst_percent: cgstPercent,
          cgst_amount: cgstAmount,
          sgst_percent: sgstPercent,
          sgst_amount: sgstAmount,
          total_amount: totalItemAmount
        };
      });
      
      total_amount = items.reduce((sum, item) => Number(sum) + (Number(item.total_amount) || 0), 0);
      // Removed: if (!finalVendorId) throw new Error('Vendor is required for PO from Material Request');
    } else {
      // Manual PO
      if (!finalVendorId) throw new Error('Vendor is required for manual PO');
      if (!manualItems || manualItems.length === 0) throw new Error('Items are required for manual PO');
      
      items = manualItems.map(item => {
        const qty = parseFloat(item.quantity) || 0;
        const designQty = parseFloat(item.design_qty) || qty;
        const rate = parseFloat(item.rate || item.unit_rate) || 0;
        const amount = qty * rate;
        const cgstPercent = item.cgst_percent || 9;
        const sgstPercent = item.sgst_percent || 9;
        const cgstAmount = (amount * cgstPercent) / 100;
        const sgstAmount = (amount * sgstPercent) / 100;
        const totalItemAmount = amount + cgstAmount + sgstAmount;
        return {
          ...item,
          quantity: qty,
          design_qty: designQty,
          unit_rate: rate,
          amount: amount,
          cgst_percent: cgstPercent,
          cgst_amount: cgstAmount,
          sgst_percent: sgstPercent,
          sgst_amount: sgstAmount,
          total_amount: totalItemAmount
        };
      });
      total_amount = items.reduce((sum, item) => Number(sum) + (Number(item.total_amount) || 0), 0);
    }

    let poNumber = manualPoNumber;
    
    if (!poNumber) {
      poNumber = await generatePONumber();
    }

    const poStatus = (actualMrId && !finalVendorId) ? 'PO_REQUEST' : 'DRAFT';

    const [result] = await connection.execute(
      `INSERT INTO purchase_orders (po_number, quotation_id, mr_id, vendor_id, sales_order_id, status, total_amount, expected_delivery_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        poNumber,
        quotationId || null,
        actualMrId || null,
        finalVendorId || null,
        sales_order_id || null,
        poStatus,
        total_amount || 0,
        actualExpectedDeliveryDate || null,
        notes || null
      ]
    );

    const poId = result.insertId;
    
    if (actualMrId) {
      await connection.execute(
        'UPDATE material_requests SET linked_po_id = ?, linked_po_number = ?, status = ? WHERE id = ?',
        [poId, poNumber, 'PROCESSING', actualMrId]
      );
    }
    
    let actualTotalAmount = 0;

    if (items.length > 0) {
      for (const item of items) {
        if (item.sales_order_item_status === 'Rejected') continue;

        const qty = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.unit_rate || item.rate) || 0;
        const amount = qty * rate;
        const cgstPercent = parseFloat(item.cgst_percent) || 0;
        const sgstPercent = parseFloat(item.sgst_percent) || 0;
        const cgstAmount = parseFloat(item.cgst_amount) || (amount * cgstPercent) / 100;
        const sgstAmount = parseFloat(item.sgst_amount) || (amount * sgstPercent) / 100;
        
        // Force numeric calculation to avoid string concatenation
        const totalItemAmount = Number((amount + cgstAmount + sgstAmount).toFixed(2));
        
        actualTotalAmount = Number((actualTotalAmount + totalItemAmount).toFixed(2));

        const correctedItemCode = await getCorrectItemCode(item, connection);

        await connection.execute(
          `INSERT INTO purchase_order_items (
            purchase_order_id, item_code, description, design_qty, quantity, unit, unit_rate, amount,
            cgst_percent, cgst_amount, sgst_percent, sgst_amount, total_amount,
            material_name, material_type, drawing_no, drawing_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            poId,
            correctedItemCode,
            item.description || null,
            (parseFloat(item.design_qty) || qty),
            qty,
            item.unit || item.uom || 'NOS',
            rate,
            amount,
            cgstPercent,
            cgstAmount,
            sgstPercent,
            sgstAmount,
            totalItemAmount,
            item.material_name || null,
            item.material_type || null,
            item.drawing_no || correctedItemCode,
            item.drawing_id || null
          ]
        );
      }
    }

    if (actualTotalAmount !== total_amount) {
      await connection.execute(
        'UPDATE purchase_orders SET total_amount = ? WHERE id = ?',
        [actualTotalAmount, poId]
      );
    }

    if (sales_order_id) {
      await connection.execute(
        'UPDATE sales_orders SET status = ? WHERE id = ?',
        ['MATERIAL_PURCHASE_IN_PROGRESS', sales_order_id]
      );
    }

    if (shouldManageConnection) {
      await connection.commit();
    }
    return { id: poId, po_number: poNumber };
  } catch (error) {
    if (shouldManageConnection) {
      await connection.rollback();
    }
    throw error;
  } finally {
    if (shouldManageConnection) {
      connection.release();
    }
  }
};

const getPurchaseOrders = async (filters = {}) => {
  let query = `
    SELECT 
      po.*,
      v.vendor_name,
      mr.mr_number,
      COUNT(poi.id) as items_count,
      IFNULL(SUM(poi.quantity), 0) as total_quantity,
      IFNULL(SUM(poi.accepted_quantity), 0) as accepted_quantity
    FROM purchase_orders po
    LEFT JOIN vendors v ON v.id = po.vendor_id
    LEFT JOIN material_requests mr ON mr.id = po.mr_id
    LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.status) {
    query += ' AND po.status = ?';
    params.push(filters.status);
  }

  if (filters.vendorId) {
    query += ' AND po.vendor_id = ?';
    params.push(filters.vendorId);
  }

  if (filters.storeAcceptanceStatus) {
    query += ' AND po.store_acceptance_status = ?';
    params.push(filters.storeAcceptanceStatus);
  }

  query += ' GROUP BY po.id ORDER BY po.created_at DESC';

  const [pos] = await pool.query(query, params);

  if (pos.length > 0) {
    const poIds = pos.map(p => p.id);
    const [items] = await pool.query(
      `SELECT 
        poi.*,
        COALESCE(
          (SELECT MAX(bom_cost) FROM sales_order_items soi WHERE (soi.item_code = poi.item_code OR soi.drawing_no = poi.item_code) AND soi.bom_cost > 0),
          (SELECT MAX(rate) FROM sales_order_item_materials som WHERE (som.item_code = poi.item_code OR som.drawing_no = poi.item_code) AND som.rate > 0),
          (SELECT MAX(rate) FROM sales_order_item_components soc WHERE (soc.component_code = poi.item_code OR soc.drawing_no = poi.item_code) AND soc.rate > 0),
          poi.unit_rate
        ) as unit_rate,
        (SELECT status FROM sales_order_items soi 
         WHERE (poi.drawing_no = soi.drawing_no OR poi.item_code = soi.item_code) 
         AND soi.sales_order_id = po.sales_order_id 
         LIMIT 1) as sales_order_item_status 
       FROM purchase_order_items poi
       LEFT JOIN purchase_orders po ON po.id = poi.purchase_order_id
       WHERE poi.purchase_order_id IN (?)`,
      [poIds]
    );

    // Group items by purchase_order_id and filter them
    pos.forEach(po => {
      po.items = items
        .filter(item => item.purchase_order_id === po.id)
        .filter(item => {
          const type = (item.material_type || '').toUpperCase();
          return type !== 'FG' && type !== 'FINISHED GOOD' && type !== 'SUB_ASSEMBLY' && type !== 'SUB ASSEMBLY';
        });
    });
  }

  return pos;
};

const getPurchaseOrderById = async (poId) => {
  const [rows] = await pool.query(
    `SELECT po.*, v.vendor_name, mr.mr_number
     FROM purchase_orders po
     LEFT JOIN vendors v ON v.id = po.vendor_id
     LEFT JOIN material_requests mr ON mr.id = po.mr_id
     WHERE po.id = ?`,
    [poId]
  );

  if (!rows.length) {
    const error = new Error('Purchase Order not found');
    error.statusCode = 404;
    throw error;
  }

  const po = rows[0];
  
  const [items] = await pool.query(
    `SELECT 
      poi.id,
      poi.item_code,
      COALESCE(poi.description, sb.material_name, poi.item_code) as description,
      poi.design_qty,
      poi.quantity,
      poi.unit,
      COALESCE(
        (SELECT MAX(bom_cost) FROM sales_order_items soi WHERE (soi.item_code = poi.item_code OR soi.drawing_no = poi.item_code) AND soi.bom_cost > 0),
        (SELECT MAX(rate) FROM sales_order_item_materials som WHERE (som.item_code = poi.item_code OR som.drawing_no = poi.item_code) AND som.rate > 0),
        (SELECT MAX(rate) FROM sales_order_item_components soc WHERE (soc.component_code = poi.item_code OR soc.drawing_no = poi.item_code) AND soc.rate > 0),
        poi.unit_rate
      ) as unit_rate,
      poi.amount,
      poi.cgst_percent,
      poi.cgst_amount,
      poi.sgst_percent,
      poi.sgst_amount,
      poi.total_amount,
      COALESCE(poi.material_name, sb.material_name, poi.item_code) as material_name,
      poi.material_type,
      poi.drawing_no,
      poi.accepted_quantity,
      (SELECT status FROM sales_order_items soi 
       WHERE (poi.drawing_no = soi.drawing_no OR poi.item_code = soi.item_code) 
       AND soi.sales_order_id = ? 
       LIMIT 1) as sales_order_item_status
     FROM purchase_order_items poi
     LEFT JOIN (SELECT item_code, MAX(material_name) as material_name FROM stock_balance GROUP BY item_code) sb ON poi.item_code = sb.item_code
     WHERE poi.purchase_order_id = ?`,
    [po.sales_order_id, poId]
  );

  // Filter out FG and Sub Assembly items
  const filteredItems = items.filter(item => {
    const type = (item.material_type || '').toUpperCase();
    return type !== 'FG' && type !== 'FINISHED GOOD' && type !== 'SUB_ASSEMBLY' && type !== 'SUB ASSEMBLY';
  });

  // Use the total_amount stored in po if available, otherwise calculate from filtered items
  if (!po.total_amount || po.total_amount === 0) {
    po.total_amount = filteredItems.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);
  }

  return { ...po, items: filteredItems };
};

const updatePurchaseOrder = async (poId, payload) => {
  const { status, poNumber, expectedDeliveryDate, notes, items, vendorId } = payload;
  
  const validStatuses = ['PO_REQUEST', 'DRAFT', 'ORDERED', 'SENT', 'ACKNOWLEDGED', 'RECEIVED', 'PARTIALLY_RECEIVED', 'APPROVED', 'PENDING_PAYMENT', 'PAID', 'COMPLETED', 'CLOSED', 'FULFILLED'];
  if (status && !validStatuses.includes(status)) {
    const error = new Error('Invalid status');
    error.statusCode = 400;
    throw error;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existing] = await connection.query('SELECT * FROM purchase_orders WHERE id = ?', [poId]);
    if (!existing.length) {
      throw new Error('Purchase Order not found');
    }

    const updates = [];
    const params = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);

      if (status === 'FULFILLED') {
        // Automatically mark all items as accepted when fulfilled
        await connection.execute(
          'UPDATE purchase_order_items SET accepted_quantity = quantity WHERE purchase_order_id = ?',
          [poId]
        );
      }
    }
    if (poNumber) {
      updates.push('po_number = ?');
      params.push(poNumber);
    }
    if (expectedDeliveryDate !== undefined) {
      updates.push('expected_delivery_date = ?');
      params.push(expectedDeliveryDate);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    if (vendorId !== undefined) {
      updates.push('vendor_id = ?');
      params.push(vendorId);
    }

    if (updates.length > 0) {
      params.push(poId);
      await connection.execute(
        `UPDATE purchase_orders SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    if (items && Array.isArray(items)) {
      let totalAmount = 0;
      for (const item of items) {
        const qty = parseFloat(item.quantity) || 0;
        const designQty = parseFloat(item.design_qty) || qty;
        const rate = parseFloat(item.unit_rate) || parseFloat(item.rate) || 0;
        const amount = Number((qty * rate).toFixed(2));
        
        // Default to 18% GST (9% CGST + 9% SGST)
        const cgstPercent = item.cgst_percent || 9;
        const sgstPercent = item.sgst_percent || 9;
        const cgstAmount = Number(((amount * cgstPercent) / 100).toFixed(2));
        const sgstAmount = Number(((amount * sgstPercent) / 100).toFixed(2));
        const totalItemAmount = Number((amount + cgstAmount + sgstAmount).toFixed(2));
        
        totalAmount = Number((totalAmount + totalItemAmount).toFixed(2));

        if (item.id) {
          await connection.execute(
            `UPDATE purchase_order_items 
             SET unit_rate = ?, amount = ?, cgst_percent = ?, cgst_amount = ?, sgst_percent = ?, sgst_amount = ?, total_amount = ?, quantity = ?, design_qty = ?, description = ?, item_code = ?, unit = ?
             WHERE id = ? AND purchase_order_id = ?`,
            [rate, amount, cgstPercent, cgstAmount, sgstPercent, sgstAmount, totalItemAmount, qty, designQty, item.description, item.item_code, item.unit, item.id, poId]
          );
        } else {
          await connection.execute(
            `INSERT INTO purchase_order_items 
             (purchase_order_id, item_code, description, quantity, design_qty, unit, unit_rate, amount, cgst_percent, cgst_amount, sgst_percent, sgst_amount, total_amount)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [poId, item.item_code, item.description, qty, designQty, item.unit || 'NOS', rate, amount, cgstPercent, cgstAmount, sgstPercent, sgstAmount, totalItemAmount]
          );
        }
      }

      await connection.execute(
        'UPDATE purchase_orders SET total_amount = ? WHERE id = ?',
        [totalAmount, poId]
      );
    }

    await connection.commit();
    return { id: poId, status };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const deletePurchaseOrder = async (poId) => {
  await getPurchaseOrderById(poId);
  await pool.execute('DELETE FROM purchase_orders WHERE id = ?', [poId]);
};

const getPurchaseOrderStats = async () => {
  const [stats] = await pool.query(`
    SELECT 
      COUNT(*) as total_pos,
      SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END) as draft_pos,
      SUM(CASE WHEN status = 'ORDERED' THEN 1 ELSE 0 END) as submitted_pos,
      SUM(CASE WHEN status IN ('ORDERED', 'SENT', 'ACKNOWLEDGED') THEN 1 ELSE 0 END) as to_receive_pos,
      SUM(CASE WHEN status = 'PARTIALLY_RECEIVED' THEN 1 ELSE 0 END) as partial_pos,
      SUM(CASE WHEN status IN ('RECEIVED', 'COMPLETED', 'FULFILLED') THEN 1 ELSE 0 END) as fulfilled_pos,
      SUM(total_amount) as total_value
    FROM purchase_orders
  `);

  return stats[0] || {
    total_pos: 0,
    draft_pos: 0,
    submitted_pos: 0,
    to_receive_pos: 0,
    partial_pos: 0,
    fulfilled_pos: 0,
    total_value: 0
  };
};

const getPOMaterialRequests = async (filters = {}) => {
  let query = `
    SELECT 
      po.id as po_id,
      po.po_number,
      po.created_at as po_date,
      v.vendor_name,
      poi.item_code,
      poi.material_name,
      poi.material_type,
      poi.drawing_no,
      poi.description,
      poi.quantity as po_qty,
      poi.unit,
      poi.accepted_quantity,
      (poi.quantity - IFNULL((
        SELECT SUM(pri.received_quantity)
        FROM po_receipt_items pri
        JOIN po_receipts pr ON pr.id = pri.receipt_id
        WHERE pri.po_item_id = poi.id AND pr.status != 'REJECTED'
      ), 0)) as pending_grn_qty,
      po.expected_delivery_date,
      po.store_acceptance_status,
      po.store_acceptance_date,
      po.store_acceptance_notes,
      poi.id as po_item_id
    FROM purchase_orders po
    JOIN vendors v ON v.id = po.vendor_id
    JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
    WHERE 1=1
    AND UPPER(poi.material_type) NOT IN ('FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY')
  `;
  const params = [];

  if (filters.status) {
    query += ' AND po.store_acceptance_status = ?';
    params.push(filters.status);
  }

  query += ' ORDER BY po.created_at DESC';

  const [rows] = await pool.query(query, params);
  return rows;
};

const approvePurchaseOrder = async (poId, userId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [po] = await connection.query('SELECT mr_id, vendor_id FROM purchase_orders WHERE id = ?', [poId]);
    if (!po.length) throw new Error('Purchase Order not found');
    
    if (!po[0].vendor_id) {
      throw new Error('Cannot approve PO without a vendor. Please edit the PO to assign a vendor first.');
    }

    await connection.execute(
      `UPDATE purchase_orders 
       SET status = 'ORDERED',
           approved_by = ?,
           approved_at = NOW()
       WHERE id = ?`,
      [userId, poId]
    );

    if (po[0].mr_id) {
      await connection.execute(
        "UPDATE material_requests SET status = 'PO_CREATED' WHERE id = ?",
        [po[0].mr_id]
      );
    }

    await connection.commit();
    return { success: true, poId, status: 'ORDERED' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const handleStoreAcceptance = async (poId, payload) => {
  const { status, notes, items } = payload;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Update PO status
    await connection.execute(
      `UPDATE purchase_orders 
       SET store_acceptance_status = ?, 
           store_acceptance_date = CURRENT_TIMESTAMP,
           store_acceptance_notes = ?
       WHERE id = ?`,
      [status, notes || null, poId]
    );

    // If accepted, we might want to update item-level accepted quantities if provided
    if (status === 'ACCEPTED' && items && Array.isArray(items)) {
      for (const item of items) {
        await connection.execute(
          `UPDATE purchase_order_items 
           SET accepted_quantity = ? 
           WHERE id = ? AND purchase_order_id = ?`,
          [item.accepted_quantity, item.po_item_id, poId]
        );
      }
    } else if (status === 'ACCEPTED') {
      // Default to full quantity if not specified
      await connection.execute(
        `UPDATE purchase_order_items 
         SET accepted_quantity = quantity 
         WHERE purchase_order_id = ?`,
        [poId]
      );
    }

    await connection.commit();
    return { success: true, poId, status };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const generatePurchaseOrderPDF = async (poId) => {
  const po = await getPurchaseOrderById(poId);
  const [vendorRows] = await pool.query('SELECT * FROM vendors WHERE id = ?', [po.vendor_id]);
  const vendor = vendorRows[0];

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Helvetica', 'Arial', sans-serif; color: #333; line-height: 1.6; margin: 40px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
        .company-info h1 { color: #2563eb; margin: 0; font-size: 24px; }
        .quote-title { text-align: right; }
        .quote-title h2 { margin: 0; color: #64748b; font-size: 18px; }
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
        .section-label { font-weight: bold; color: #64748b; font-size: 12px; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background: #f8fafc; color: #64748b; text-align: left; padding: 12px 8px; font-size: 11px; border-bottom: 1px solid #e2e8f0; }
        td { padding: 12px 8px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
        .notes-section { background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #cbd5e1; }
        .footer { margin-top: 50px; text-align: center; color: #94a3b8; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
        .total-row { font-weight: bold; background: #eff6ff; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-info">
          <h1>SPTECHPIONEER PVT LTD</h1>
          <p>Industrial Area, Sector 5<br>Pune, Maharashtra - 411026</p>
        </div>
        <div class="quote-title">
          <h2>Purchase Order</h2>
          <p><strong>PO No:</strong> {{po_number}}<br>
          <strong>Date:</strong> {{created_at}}<br>
          <strong>Expected Date:</strong> {{expected_delivery_date}}</p>
        </div>
      </div>

      <div class="details-grid">
        <div>
          <div class="section-label">Vendor Information</div>
          <p><strong>{{vendor_name}}</strong><br>
          {{location}}<br>
          Email: {{vendor_email}}<br>
          Phone: {{phone}}</p>
        </div>
        <div style="text-align: right;">
          <div class="section-label">Reference</div>
          <p>{{project_ref}}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 20%">Drawing No</th>
            <th style="width: 25%">Material Name</th>
            <th style="width: 15%">Type</th>
            <th style="width: 10%">Qty</th>
            <th style="width: 15%">Rate (₹)</th>
            <th style="width: 15%">Amount</th>
          </tr>
        </thead>
        <tbody>
          {{#items}}
          <tr>
            <td>{{drawing_no}}</td>
            <td>{{material_name}}</td>
            <td>{{material_type}}</td>
            <td>{{quantity}} {{unit}}</td>
            <td>{{unit_rate}}</td>
            <td>{{amount}}</td>
          </tr>
          {{/items}}
        </tbody>
        <tfoot style="background: #f8fafc; font-weight: bold;">
          <tr>
            <td colspan="5" style="text-align: right; padding: 8px 8px;">Subtotal:</td>
            <td style="padding: 8px 8px;">₹{{subtotal}}</td>
          </tr>
          <tr style="color: #64748b; font-size: 11px;">
            <td colspan="5" style="text-align: right; padding: 4px 8px;">CGST (9%):</td>
            <td style="padding: 4px 8px;">₹{{cgst_total}}</td>
          </tr>
          <tr style="color: #64748b; font-size: 11px;">
            <td colspan="5" style="text-align: right; padding: 4px 8px;">SGST (9%):</td>
            <td style="padding: 4px 8px;">₹{{sgst_total}}</td>
          </tr>
          <tr class="total-row">
            <td colspan="5" style="text-align: right; padding: 12px 8px; font-size: 14px;">Grand Total:</td>
            <td style="padding: 12px 8px; font-size: 14px; color: #2563eb;">₹{{total_amount}}</td>
          </tr>
        </tfoot>
      </table>

      {{#notes}}
      <div class="notes-section">
        <div class="section-label">Special Instructions & Notes</div>
        <p>{{notes}}</p>
      </div>
      {{/notes}}

      <div class="footer">
        <p>This is a computer-generated document. No signature is required.<br>
        SPTECHPIONEER PVT LTD | Confidential | Page 1 of 1</p>
      </div>
    </body>
    </html>
  `;

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const subtotal = po.items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const cgst_total = po.items.reduce((sum, item) => sum + (parseFloat(item.cgst_amount) || 0), 0);
  const sgst_total = po.items.reduce((sum, item) => sum + (parseFloat(item.sgst_amount) || 0), 0);

  const viewData = {
    ...po,
    created_at: formatDate(po.created_at),
    expected_delivery_date: formatDate(po.expected_delivery_date),
    vendor_name: vendor?.vendor_name || 'N/A',
    vendor_email: vendor?.email || 'N/A',
    location: vendor?.location || 'N/A',
    phone: vendor?.phone || 'N/A',
    project_ref: po.mr_number ? `MR: ${po.mr_number}` : 'Direct Procurement',
    subtotal: subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    cgst_total: cgst_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    sgst_total: sgst_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    total_amount: parseFloat(po.total_amount || (subtotal + cgst_total + sgst_total)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    items: (po.items || []).map(i => {
      const dQty = parseFloat(i.design_qty);
      const qty = parseFloat(i.quantity);
      const displayQty = (dQty && dQty !== 0) ? dQty : (qty || 0);
      
      return {
        ...i,
        drawing_no: i.drawing_no || i.item_code || '—',
        material_name: i.material_name || i.description || '—',
        material_type: i.material_type || '—',
        quantity: displayQty.toFixed(3),
        unit: i.unit || 'NOS',
        unit_rate: parseFloat(i.unit_rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        amount: parseFloat(i.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      };
    })
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
    margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
  });
  await browser.close();

  return pdf;
};

const sendPurchaseOrderEmail = async (poId, emailData) => {
  const { to, subject, message, attachPDF } = emailData;

  const po = await getPurchaseOrderById(poId);

  if (!to || !subject || !message) {
    throw new Error('Email recipient, subject, and message are required');
  }

  try {
    let attachments = [];
    if (attachPDF) {
      const pdfBuffer = await generatePurchaseOrderPDF(poId);
      attachments.push({
        filename: `PurchaseOrder_${po.po_number}.pdf`,
        content: pdfBuffer
      });
    }

    const emailResult = await emailService.sendEmail(to, subject, message, attachments);
    
    await pool.execute(
      'UPDATE purchase_orders SET status = ? WHERE id = ?',
      ['SENT', poId]
    );

    return {
      id: poId,
      sent_to: to,
      sent_at: new Date(),
      message: emailResult.message,
      messageId: emailResult.messageId
    };
  } catch (error) {
    console.error(`[sendPurchaseOrderEmail] Error: ${error.message}`);
    throw error;
  }
};

const updatePurchaseOrderInvoice = async (poId, invoiceUrl) => {
  const [result] = await pool.execute(
    'UPDATE purchase_orders SET invoice_url = ? WHERE id = ?',
    [invoiceUrl, poId]
  );
  if (result.affectedRows === 0) throw new Error('Purchase Order not found');
  return { id: poId, invoice_url: invoiceUrl };
};

module.exports = {
  createPurchaseOrder,
  previewPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  deletePurchaseOrder,
  getPurchaseOrderStats,
  getPOMaterialRequests,
  approvePurchaseOrder,
  handleStoreAcceptance,
  generatePurchaseOrderPDF,
  sendPurchaseOrderEmail,
  updatePurchaseOrderInvoice
};
