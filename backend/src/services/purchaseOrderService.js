const pool = require('../config/db');
const crypto = require('crypto');
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
  const prefix = `PO-${currentYear}-`;

  const [result] = await pool.query(
    `SELECT po_number FROM purchase_orders 
     WHERE po_number LIKE ? 
     ORDER BY po_number DESC LIMIT 1`,
    [`${prefix}%`]
  );

  let nextNumber = 1;
  if (result.length > 0) {
    const lastNumberStr = result[0].po_number.split('-').pop();
    const lastNumber = parseInt(lastNumberStr, 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  const paddedCount = String(nextNumber).padStart(4, '0');
  return `${prefix}${paddedCount}`;
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
          planned_qty: parseFloat(item.planned_qty) || designQty || 0,
          unit_rate: parseFloat(item.unit_rate) || 0,
          amount: parseFloat(item.amount) || (qty * parseFloat(item.unit_rate || 0)),
          cgst_percent: parseFloat(item.cgst_percent) || 9,
          cgst_amount: parseFloat(item.cgst_amount) || 0,
          sgst_percent: parseFloat(item.sgst_percent) || 9,
          sgst_amount: parseFloat(item.sgst_amount) || 0,
          total_amount: parseFloat(item.total_amount) || 0,
          length: item.length || 0,
          width: item.width || 0,
          thickness: item.thickness || 0,
          diameter: item.diameter || 0,
          outer_diameter: item.outer_diameter || 0,
          density: item.density || 0,
          weight_per_unit: item.weight_per_unit || 0
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
               sb.length, sb.width, sb.thickness, sb.diameter, sb.outer_diameter, sb.density, sb.weight_per_unit,
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
          planned_qty: parseFloat(item.planned_qty) || designQty || 0,
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
          total_amount: totalItemAmount,
          length: item.length || 0,
          width: item.width || 0,
          thickness: item.thickness || 0,
          diameter: item.diameter || 0,
          outer_diameter: item.outer_diameter || 0,
          density: item.density || 0,
          weight_per_unit: item.weight_per_unit || 0
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
          planned_qty: parseFloat(item.planned_qty) || designQty || 0,
          unit_rate: rate,
          amount: amount,
          cgst_percent: cgstPercent,
          cgst_amount: cgstAmount,
          sgst_percent: sgstPercent,
          sgst_amount: sgstAmount,
          total_amount: totalItemAmount,
          length: item.length || 0,
          width: item.width || 0,
          thickness: item.thickness || 0,
          diameter: item.diameter || 0,
          outer_diameter: item.outer_diameter || 0,
          density: item.density || 0,
          weight_per_unit: item.weight_per_unit || 0
        };
      });
      total_amount = items.reduce((sum, item) => Number(sum) + (Number(item.total_amount) || 0), 0);
    }

    let poNumber = manualPoNumber;

    if (!poNumber) {
      poNumber = await generatePONumber();
    }

    const poStatus = (actualMrId && !finalVendorId) ? 'PO_REQUEST' : 'DRAFT';
    const publicId = crypto.randomUUID();

    const [result] = await connection.execute(
      `INSERT INTO purchase_orders (po_number, public_id, quotation_id, mr_id, vendor_id, sales_order_id, status, total_amount, expected_delivery_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        poNumber,
        publicId,
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
            purchase_order_id, item_code, description, design_qty, quantity, planned_qty, unit, unit_rate, amount,
            cgst_percent, cgst_amount, sgst_percent, sgst_amount, total_amount,
            material_name, material_type, drawing_no, drawing_id,
            length, width, thickness, diameter, outer_diameter, density, weight_per_unit
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            poId,
            correctedItemCode,
            item.description || null,
            (parseFloat(item.design_qty) || qty),
            qty,
            parseFloat(item.planned_qty) || parseFloat(item.design_qty) || qty,
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
            item.drawing_no || null,
            item.drawing_id || null,
            item.length || 0,
            item.width || 0,
            item.thickness || 0,
            item.diameter || 0,
            item.outer_diameter || 0,
            item.density || 0,
            item.weight_per_unit || 0
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
      v.email as vendor_email,
      mr.mr_number,
      COALESCE(
        (
          SELECT so.project_name 
          FROM sales_orders so
          WHERE so.id = po.sales_order_id AND so.is_sales_order = 1
        ),
        (
          SELECT o.project_name 
          FROM orders o
          WHERE o.id = po.sales_order_id AND o.source_type = 'DIRECT'
        ),
        (
          SELECT so.project_name 
          FROM material_requests mr_inner
          JOIN production_plans pp ON mr_inner.plan_id = pp.id
          LEFT JOIN (
            SELECT plan_id, sales_order_item_id FROM production_plan_items
            WHERE id IN (SELECT MIN(id) FROM production_plan_items GROUP BY plan_id)
          ) ppi ON pp.id = ppi.plan_id
          LEFT JOIN sales_order_items soi ON ppi.sales_order_item_id = soi.id
          LEFT JOIN sales_orders so ON (
            (soi.id IS NOT NULL AND soi.sales_order_id = so.id) OR
            (soi.id IS NULL AND pp.sales_order_id = so.id)
          )
          WHERE mr_inner.id = po.mr_id LIMIT 1
        ),
        (
          SELECT o.project_name 
          FROM material_requests mr_inner
          JOIN production_plans pp ON mr_inner.plan_id = pp.id
          JOIN orders o ON pp.sales_order_id = o.id AND o.source_type = 'DIRECT'
          WHERE mr_inner.id = po.mr_id LIMIT 1
        ),
        (
          SELECT so.project_name 
          FROM material_requests mr_inner
          JOIN sales_orders so ON mr_inner.notes LIKE CONCAT('%', so.project_name, '%')
          WHERE mr_inner.id = po.mr_id LIMIT 1
        ),
        (
          SELECT so.project_name 
          FROM material_requests mr_inner
          JOIN sales_orders so ON mr_inner.notes REGEXP CONCAT('SO-[0-9]{4}-', LPAD(so.id, 4, '0'))
          WHERE mr_inner.id = po.mr_id LIMIT 1
        ),
        'Stock/Internal'
      ) as project_name,
      COALESCE(
        (
          SELECT c.company_name 
          FROM companies c 
          JOIN sales_orders so ON c.id = so.company_id 
          WHERE so.id = po.sales_order_id
        ),
        (
          SELECT c.company_name 
          FROM companies c 
          JOIN orders o ON c.id = o.client_id 
          WHERE o.id = po.sales_order_id AND o.source_type = 'DIRECT'
        ),
        (
          SELECT c2.company_name 
          FROM material_requests mr_inner
          JOIN production_plans pp ON mr_inner.plan_id = pp.id
          LEFT JOIN (
            SELECT plan_id, sales_order_item_id FROM production_plan_items
            WHERE id IN (SELECT MIN(id) FROM production_plan_items GROUP BY plan_id)
          ) ppi ON pp.id = ppi.plan_id
          LEFT JOIN sales_order_items soi ON ppi.sales_order_item_id = soi.id
          LEFT JOIN sales_orders so ON (
            (soi.id IS NOT NULL AND soi.sales_order_id = so.id) OR
            (soi.id IS NULL AND pp.sales_order_id = so.id)
          )
          LEFT JOIN companies c2 ON so.company_id = c2.id
          WHERE mr_inner.id = po.mr_id LIMIT 1
        ),
        (
          SELECT c3.company_name 
          FROM material_requests mr_inner
          JOIN production_plans pp ON mr_inner.plan_id = pp.id
          JOIN orders o ON pp.sales_order_id = o.id AND o.source_type = 'DIRECT'
          JOIN companies c3 ON o.client_id = c3.id
          WHERE mr_inner.id = po.mr_id LIMIT 1
        ),
        'Internal'
      ) as company_name,
      COUNT(poi.id) as items_count,
      IFNULL(SUM(poi.quantity), 0) as total_quantity,
      (SELECT IFNULL(SUM(gi.accepted_qty), 0) 
       FROM grn_items gi 
       JOIN purchase_order_items poi2 ON gi.po_item_id = poi2.id 
       WHERE poi2.purchase_order_id = po.id 
       AND gi.status IN ('RECEIVED', 'EXCESS_ACCEPTED', 'Approved ', 'APPROVED', 'PASSED', 'ACCEPTED', 'SHORTAGE')) as accepted_quantity
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
    `SELECT po.*, v.vendor_name, v.email as vendor_email, v.phone as vendor_phone, v.location as vendor_location, v.location as vendor_address, v.gstin as vendor_gstin, 
     (SELECT name FROM contacts WHERE company_id = po.vendor_id AND contact_type = 'PRIMARY' LIMIT 1) as contact_person,
     (SELECT phone FROM contacts WHERE company_id = po.vendor_id AND contact_type = 'PRIMARY' LIMIT 1) as contact_phone,
     mr.mr_number, so.so_number,
     po.invoice_url,
     (SELECT q.host_company_id FROM quotations q WHERE q.id = po.quotation_id LIMIT 1) as host_company_id,
     (SELECT p.payment_mode FROM payments p WHERE p.po_id = po.id AND p.status = 'CONFIRMED' LIMIT 1) as payment_mode,
     (SELECT p.transaction_ref_no FROM payments p WHERE p.po_id = po.id AND p.status = 'CONFIRMED' LIMIT 1) as transaction_ref_no,
     (SELECT p.upi_transaction_id FROM payments p WHERE p.po_id = po.id AND p.status = 'CONFIRMED' LIMIT 1) as upi_transaction_id,
     (SELECT p.payment_date FROM payments p WHERE p.po_id = po.id AND p.status = 'CONFIRMED' LIMIT 1) as payment_date,
     (SELECT ba.bank_name FROM payments p JOIN bank_accounts ba ON p.bank_account_id = ba.id WHERE p.po_id = po.id AND p.status = 'CONFIRMED' LIMIT 1) as bank_name,
     (SELECT ba.account_number FROM payments p JOIN bank_accounts ba ON p.bank_account_id = ba.id WHERE p.po_id = po.id AND p.status = 'CONFIRMED' LIMIT 1) as account_number,
     (SELECT CONCAT(u.first_name, ' ', u.last_name) FROM payments p JOIN users u ON p.created_by = u.id WHERE p.po_id = po.id AND p.status = 'CONFIRMED' LIMIT 1) as paid_by,
     (SELECT CONCAT(first_name, ' ', last_name) FROM users WHERE id = po.approved_by) as updated_by,
     (SELECT CONCAT('GRN-', LPAD(g.id, 4, '0')) FROM grns g WHERE g.po_number = po.po_number LIMIT 1) as shipment_code,
     COALESCE(
        so.project_name,
        o_dir.project_name,
        (SELECT so2.project_name 
         FROM material_requests mr_inner
         JOIN production_plans pp ON mr_inner.plan_id = pp.id
         LEFT JOIN (
           SELECT plan_id, sales_order_item_id FROM production_plan_items
           WHERE id IN (SELECT MIN(id) FROM production_plan_items GROUP BY plan_id)
         ) ppi ON pp.id = ppi.plan_id
         LEFT JOIN sales_order_items soi ON ppi.sales_order_item_id = soi.id
         LEFT JOIN sales_orders so2 ON (
           (soi.id IS NOT NULL AND soi.sales_order_id = so2.id) OR
           (soi.id IS NULL AND pp.sales_order_id = so2.id)
         )
         WHERE mr_inner.id = po.mr_id LIMIT 1),
        (SELECT o.project_name 
         FROM material_requests mr_inner
         JOIN production_plans pp ON mr_inner.plan_id = pp.id
         JOIN orders o ON pp.sales_order_id = o.id AND o.source_type = 'DIRECT'
         WHERE mr_inner.id = po.mr_id LIMIT 1),
        (SELECT so3.project_name 
         FROM material_requests mr_inner
         JOIN sales_orders so3 ON mr_inner.notes LIKE CONCAT('%', so3.project_name, '%')
         WHERE mr_inner.id = po.mr_id LIMIT 1),
        'Stock/Internal'
      ) as project_name,
      COALESCE(
        (SELECT c.company_name FROM companies c WHERE c.id = so.company_id),
        (SELECT c.company_name FROM companies c WHERE c.id = o_dir.client_id),
        (SELECT c2.company_name 
         FROM material_requests mr_inner
         JOIN production_plans pp ON mr_inner.plan_id = pp.id
         LEFT JOIN (
           SELECT plan_id, sales_order_item_id FROM production_plan_items
           WHERE id IN (SELECT MIN(id) FROM production_plan_items GROUP BY plan_id)
         ) ppi ON pp.id = ppi.plan_id
         LEFT JOIN sales_order_items soi ON ppi.sales_order_item_id = soi.id
         LEFT JOIN sales_orders so2 ON (
           (soi.id IS NOT NULL AND soi.sales_order_id = so2.id) OR
           (soi.id IS NULL AND pp.sales_order_id = so2.id)
         )
         LEFT JOIN companies c2 ON so2.company_id = c2.id
         WHERE mr_inner.id = po.mr_id LIMIT 1),
        (SELECT c3.company_name 
         FROM material_requests mr_inner
         JOIN production_plans pp ON mr_inner.plan_id = pp.id
         JOIN orders o ON pp.sales_order_id = o.id AND o.source_type = 'DIRECT'
         JOIN companies c3 ON o.client_id = c3.id
         WHERE mr_inner.id = po.mr_id LIMIT 1),
        'Internal'
      ) as company_name
      FROM purchase_orders po
      LEFT JOIN vendors v ON v.id = po.vendor_id
      LEFT JOIN material_requests mr ON mr.id = po.mr_id
      LEFT JOIN sales_orders so ON so.id = po.sales_order_id AND so.is_sales_order = 1
      LEFT JOIN orders o_dir ON o_dir.id = po.sales_order_id AND o_dir.source_type = 'DIRECT'
      WHERE po.id = ? OR po.public_id = ?`,
    [poId, poId]
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
      poi.planned_qty,
      poi.quantity,
      poi.unit,
      poi.unit_rate,
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
      COALESCE(NULLIF(poi.length, 0), sb.length, 0) as length,
      COALESCE(NULLIF(poi.width, 0), sb.width, 0) as width,
      COALESCE(NULLIF(poi.thickness, 0), sb.thickness, 0) as thickness,
      COALESCE(NULLIF(poi.diameter, 0), sb.diameter, 0) as diameter,
      COALESCE(NULLIF(poi.outer_diameter, 0), sb.outer_diameter, 0) as outer_diameter,
      COALESCE(NULLIF(poi.density, 0), sb.density, 0) as density,
      COALESCE(NULLIF(poi.weight_per_unit, 0), sb.weight_per_unit, 0) as weight_per_unit,
      (SELECT status FROM sales_order_items soi 
       WHERE (poi.drawing_no = soi.drawing_no OR poi.item_code = soi.item_code) 
       AND soi.sales_order_id = ? 
       LIMIT 1) as sales_order_item_status
     FROM purchase_order_items poi
     LEFT JOIN (
       SELECT 
         item_code, 
         MAX(material_name) as material_name,
         MAX(length) as length,
         MAX(width) as width,
         MAX(thickness) as thickness,
         MAX(diameter) as diameter,
         MAX(outer_diameter) as outer_diameter,
         MAX(density) as density,
         MAX(weight_per_unit) as weight_per_unit
       FROM stock_balance 
       GROUP BY item_code
     ) sb ON poi.item_code = sb.item_code
     WHERE poi.purchase_order_id = ?`,
    [po.sales_order_id, po.id]
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
             SET unit_rate = ?, amount = ?, cgst_percent = ?, cgst_amount = ?, sgst_percent = ?, sgst_amount = ?, total_amount = ?, quantity = ?, design_qty = ?, planned_qty = ?, description = ?, item_code = ?, unit = ?,
                 length = ?, width = ?, thickness = ?, diameter = ?, outer_diameter = ?, density = ?, weight_per_unit = ?
             WHERE id = ? AND purchase_order_id = ?`,
            [
              rate, amount, cgstPercent, cgstAmount, sgstPercent, sgstAmount, totalItemAmount, qty, designQty, parseFloat(item.planned_qty) || designQty || 0, item.description, item.item_code, item.unit,
              item.length || 0, item.width || 0, item.thickness || 0, item.diameter || 0, item.outer_diameter || 0, item.density || 0, item.weight_per_unit || 0,
              item.id, poId
            ]
          );
        } else {
          await connection.execute(
            `INSERT INTO purchase_order_items 
             (purchase_order_id, item_code, description, quantity, design_qty, planned_qty, unit, unit_rate, amount, cgst_percent, cgst_amount, sgst_percent, sgst_amount, total_amount,
              length, width, thickness, diameter, outer_diameter, density, weight_per_unit)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              poId, item.item_code, item.description, qty, designQty, parseFloat(item.planned_qty) || designQty || 0, item.unit || 'NOS', rate, amount, cgstPercent, cgstAmount, sgstPercent, sgstAmount, totalItemAmount,
              item.length || 0, item.width || 0, item.thickness || 0, item.diameter || 0, item.outer_diameter || 0, item.density || 0, item.weight_per_unit || 0
            ]
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
      SUM(CASE WHEN status IN ('ORDERED', 'Sent ', 'ACKNOWLEDGED') THEN 1 ELSE 0 END) as to_receive_pos,
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
      COALESCE(NULLIF(poi.length, 0), sb.length, 0) as length,
      COALESCE(NULLIF(poi.width, 0), sb.width, 0) as width,
      COALESCE(NULLIF(poi.thickness, 0), sb.thickness, 0) as thickness,
      COALESCE(NULLIF(poi.diameter, 0), sb.diameter, 0) as diameter,
      COALESCE(NULLIF(poi.outer_diameter, 0), sb.outer_diameter, 0) as outer_diameter,
      COALESCE(NULLIF(poi.density, 0), sb.density, 0) as density,
      COALESCE(NULLIF(poi.weight_per_unit, 0), sb.weight_per_unit, 0) as weight_per_unit,
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
    LEFT JOIN (
      SELECT 
        item_code, 
        MAX(length) as length,
        MAX(width) as width,
        MAX(thickness) as thickness,
        MAX(diameter) as diameter,
        MAX(outer_diameter) as outer_diameter,
        MAX(density) as density,
        MAX(weight_per_unit) as weight_per_unit
      FROM stock_balance 
      GROUP BY item_code
    ) sb ON poi.item_code = sb.item_code
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
  const vendor = vendorRows[0] || {};

  // Fallback for contact info from contacts table
  let phone = vendor.phone;
  let email = vendor.email;
  if (!phone || phone === 'N/A' || !email || email === 'N/A') {
    const [contactRows] = await pool.query(
      "SELECT phone, email FROM contacts WHERE company_id = ? AND contact_type = 'PRIMARY' LIMIT 1",
      [po.vendor_id]
    );
    if (contactRows.length > 0) {
      if (!phone || phone === 'N/A') phone = contactRows[0].phone;
      if (!email || email === 'N/A') email = contactRows[0].email;
    }
  }

  // Fallback for location from company_addresses
  let location = vendor.location;
  if (!location || location === 'N/A' || location === '') {
    const [addressRows] = await pool.query(
      "SELECT line1, line2, city, state, pincode FROM company_addresses WHERE company_id = ? AND address_type = 'BILLING' LIMIT 1",
      [po.vendor_id]
    );
    if (addressRows.length > 0) {
      const addr = addressRows[0];
      location = [addr.line1, addr.line2, addr.city, addr.state, addr.pincode]
        .filter(part => part && String(part).trim() !== '')
        .join(', ');
    }
  }

  const adminCompanyMasterService = require('./adminCompanyMasterService');
  let activeCompany = null;

  // 1. If PO is linked to a quotation, check its host_company_id
  if (po.quotation_id) {
    try {
      const [quoteRow] = await pool.query('SELECT host_company_id FROM quotations WHERE id = ?', [po.quotation_id]);
      if (quoteRow.length > 0 && quoteRow[0].host_company_id) {
        activeCompany = await adminCompanyMasterService.getCompanyById(quoteRow[0].host_company_id);
      }
    } catch (err) {
      console.error('Error fetching quotation host_company_id:', err);
    }
  }

  // 2. If the PO is linked to a sales order, we can check if it has a host_company_id
  if (!activeCompany && po.sales_order_id) {
    try {
      const [soRow] = await pool.query('SELECT host_company_id FROM sales_orders WHERE id = ?', [po.sales_order_id]);
      if (soRow.length > 0 && soRow[0].host_company_id) {
        activeCompany = await adminCompanyMasterService.getCompanyById(soRow[0].host_company_id);
      }
    } catch (err) {
      console.error('Error fetching sales order host_company_id:', err);
    }
  }

  // 3. Fallback to MR-linked sales order host_company_id
  if (!activeCompany && po.mr_id) {
    try {
      const [mrRow] = await pool.query(
        `SELECT so.host_company_id 
         FROM material_requests mr 
         JOIN production_plans pp ON mr.plan_id = pp.id 
         JOIN sales_orders so ON pp.sales_order_id = so.id 
         WHERE mr.id = ? LIMIT 1`,
        [po.mr_id]
      );
      if (mrRow.length > 0 && mrRow[0].host_company_id) {
        activeCompany = await adminCompanyMasterService.getCompanyById(mrRow[0].host_company_id);
      }
    } catch (err) {
      console.error('Error fetching MR host_company_id:', err);
    }
  }

  // Final fallback to active company
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
<title>Purchase Order - {{hostCompanyName}}</title>
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
        <div class="po-title-block">PURCHASE ORDER</div>
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
        <div class="section-title">VENDOR DETAILS</div>
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
        <div class="vendor-name">{{hostCompanyName}}</div>
        <div class="address-text">{{{hostCompanyAddressHtml}}}</div>
        <table class="details-subtable" style="margin-top: 6px;">
          <tr>
            <td style="width: 32%; font-weight: bold;">GSTIN NO.</td>
            <td style="width: 5%;">:</td>
            <td>{{hostGSTIN}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">State</td>
            <td>:</td>
            <td>{{hostState}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Contact Person</td>
            <td>:</td>
            <td>{{created_by_name}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Telephone</td>
            <td>:</td>
            <td>{{created_by_mobile}}</td>
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
        <th style="width: 25%; text-align: left; vertical-align: top; line-height: 1.3;">Item No.<br/>Item Description</th>
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
      </tr>
      {{/sub_assemblies}}
      {{/items}}
      {{#empty_rows}}
      <tr style="height: 22px;">
        <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
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

  const subtotal = po.items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const cgst_total = po.items.reduce((sum, item) => sum + (parseFloat(item.cgst_amount) || 0), 0);
  const sgst_total = po.items.reduce((sum, item) => sum + (parseFloat(item.sgst_amount) || 0), 0);
  const grand_total = parseFloat(po.total_amount || (subtotal + cgst_total + sgst_total));

  const firstItem = po.items[0] || {};
  const cgst_rate_summary = parseFloat(firstItem.cgst_percent || 0).toFixed(0);
  const sgst_rate_summary = parseFloat(firstItem.sgst_percent || 0).toFixed(0);

  // Basic number to words for the words section
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
    po_date: formatDate(po.created_at),
    customer_code: vendor?.vendor_code || ('VEND-' + String(po.vendor_id).padStart(6, '0')),
    created_at: formatDate(po.created_at),
    expected_delivery_date: formatDate(po.expected_delivery_date),
    vendor_name: vendor?.vendor_name || 'N/A',
    vendor_email: email || 'N/A',
    vendor_address_html: location ? location.split(', ').join('<br/>') : 'N/A',
    phone: phone || 'N/A',
    vendor_gstin: vendor?.gstin || 'N/A',
    contact_person: po.contact_person || 'N/A',
    project_name: po.project_name || 'General Procurement',
    project_ref: po.mr_number ? `MR-${po.mr_number}` : (po.sales_order_id ? `SO-${po.so_number || po.sales_order_id}` : 'Direct Procurement'),
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
    created_by_name: activeCompany?.contact_person || po.updated_by || 'Rohit Kuchekar',
    created_by_mobile: activeCompany?.phone || '09823714674',
    created_by_phone: activeCompany?.telephone || '-',
    created_by_email: activeCompany?.email || 'milindpodar@gmail.com',
    vendor_code: vendor?.vendor_code || ('VEND-' + String(po.vendor_id).padStart(6, '0')),
    plant: activeCompany?.plant_code || 'STPTPL-01',
    version_no: '1.0',
    order_type: 'Standard Purchase Order',
    payment_terms: po.payment_terms || vendor?.payment_terms || '45 days from invoice date',
    freight: po.freight || 'Included',
    p_and_f: po.p_and_f || 'Included',
    insurance: po.insurance || 'Included',
    purchase_term: po.purchase_term || 'Standard Purchase Order',
    delivery_terms: po.delivery_terms || 'As Per Item Wise Delivery Date',
    our_ref_no: po.our_ref_no || '—',
    hostBankName: activeCompany?.bank_name || 'HDFC BANK LTD.',
    hostAccountName: activeCompany?.company_name || 'SP TECHPIONEER PRIVATE LIMITED',
    hostAccountNumber: activeCompany?.account_number || '123456789999',
    hostIFSCCode: activeCompany?.ifsc_code ? activeCompany.ifsc_code.toUpperCase() : 'HDFC0001234',
    hostBranchName: activeCompany?.branch_name || 'Bhosari, Pune - 411026, Maharashtra',
    hostState: activeCompany?.state || 'Maharashtra',
    items: (po.items || []).map((i, idx) => {
      const dQty = parseFloat(i.design_qty);
      const qty = parseFloat(i.quantity);
      const displayQty = (dQty && dQty !== 0) ? dQty : (qty || 0);

      return {
        ...i,
        sl_no: idx + 1,
        item_code: i.item_code || '—',
        item_no: i.item_code || '—',
        drawing_no: i.drawing_no || i.item_code || '—',
        material_name: i.material_name || i.description || '—',
        description: i.drawing_no ? `DRW: ${i.drawing_no}` : '—',
        material_type: i.material_type || '—',
        hsn_code: '73089090', // realistic fallback
        expected_delivery_date: formatDate(po.expected_delivery_date),
        pur_req_no: po.mr_number || '—',
        quantity: displayQty.toFixed(3),
        unit: (i.unit || 'NOS').toUpperCase(),
        unit_rate: parseFloat(i.unit_rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        amount: parseFloat(i.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        discount: (0).toFixed(2),
        transaction_amount: parseFloat(i.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        cgst_rate: parseFloat(i.cgst_percent || 0).toFixed(2),
        cgst_amount: parseFloat(i.cgst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        sgst_rate: parseFloat(i.sgst_percent || 0).toFixed(2),
        sgst_amount: parseFloat(i.sgst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      };
    }),
    empty_rows: Array.from({ length: Math.max(0, 4 - (po.items || []).length) })
  };

  const mustache = require('mustache');
  const puppeteer = require('puppeteer');
  const html = mustache.render(htmlTemplate, viewData);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  const pdf = await page.pdf({
    format: 'A4',
    landscape: true,
    printBackground: true,
    margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' }
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
      // Always generate and attach the latest PO PDF
      const pdfBuffer = await generatePurchaseOrderPDF(poId);
      attachments.push({
        filename: `PurchaseOrder-${po.po_number}.pdf`,
        content: pdfBuffer
      });

      // If there's an uploaded invoice, attach it as well
      if (po.invoice_url) {
        const path = require('path');
        const fs = require('fs');
        const absolutePath = path.resolve(process.cwd(), po.invoice_url);

        if (fs.existsSync(absolutePath)) {
          const extension = path.extname(po.invoice_url) || '.pdf';
          attachments.push({
            filename: `VendorInvoice-${po.po_number}${extension}`,
            path: absolutePath
          });
        }
      }
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
