const pool = require('../config/db');
const emailService = require('./emailService');
const purchaseOrderService = require('./purchaseOrderService');
const puppeteer = require('puppeteer');
const mustache = require('mustache');
const pdfModule = require('pdf-parse');
const PDFParseClass = pdfModule.PDFParse || (pdfModule.default && pdfModule.default.PDFParse) || pdfModule;
const fs = require('fs');
const path = require('path');

const generateQuoteNumber = async () => {
  const timestamp = Date.now();
  return `QT-${timestamp}`;
};

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

const createQuotation = async (payload) => {
  const {
    vendorId,
    salesOrderId,
    mrId,
    rfq_id,
    rfq_group_id,
    validUntil,
    notes,
    items = [],
    status = 'DRAFT',
    hostCompanyId,
    host_company_id
  } = payload;

  const hostCompanyIdVal = hostCompanyId || host_company_id || null;

  if (!vendorId) {
    const error = new Error('Vendor is required');
    error.statusCode = 400;
    throw error;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const quoteNumber = await generateQuoteNumber();

    const [result] = await connection.execute(
      `INSERT INTO quotations (quote_number, base_quote_number, version, vendor_id, sales_order_id, mr_id, rfq_id, rfq_group_id, status, valid_until, notes, host_company_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ,
      [quoteNumber, quoteNumber, 1, vendorId, salesOrderId || null, mrId || null, rfq_id || null, rfq_group_id || null, status, validUntil || null, notes || null, hostCompanyIdVal]
    );

    const quotationId = result.insertId;

    // Update RFQ status if rfq_id is provided, but only if it's not already SENT
    if (rfq_id) {
      await connection.execute(
        'UPDATE procurement_rfqs SET status = ? WHERE id = ? AND status != ?',
        ['SENT', rfq_id, 'SENT']
      );
    }

    // Update Sales Order status and quotation_id if salesOrderId is provided
    if (salesOrderId) {
      await connection.execute(
        "UPDATE sales_orders SET status = 'QUOTATION_SENT', quotation_id = ?, updated_at = NOW() WHERE id = ?",
        [quotationId, salesOrderId]
      );
    }

    // Update Material Request status to PROCESSING if mrId is provided, but only if it's not already PROCESSING
    if (mrId) {
      await connection.execute(
        'UPDATE material_requests SET status = ? WHERE id = ? AND status != ?',
        ['PROCESSING', mrId, 'PROCESSING']
      );
    }

    let totalAmount = 0;
    let totalTaxAmount = 0;

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const designQty = parseFloat(item.design_qty) || parseFloat(item.quantity) || 0;
        const qty = parseFloat(item.quantity) || designQty || 0;
        const rate = parseFloat(item.unit_rate) || 0;
        const amount = Number((qty * rate).toFixed(2));
        const cgstPercent = 9;
        const sgstPercent = 9;
        const cgstAmount = Number(((amount * cgstPercent) / 100).toFixed(2));
        const sgstAmount = Number(((amount * sgstPercent) / 100).toFixed(2));
        const totalItemAmount = Number((amount + cgstAmount + sgstAmount).toFixed(2));

        totalAmount = Number((totalAmount + amount).toFixed(2));
        totalTaxAmount = Number((totalTaxAmount + cgstAmount + sgstAmount).toFixed(2));

        const correctedItemCode = await getCorrectItemCode(item, connection);

        await connection.execute(
          `INSERT INTO quotation_items (
            quotation_id, item_code, description, material_name, material_type, drawing_no, 
            quantity, design_qty, planned_qty, unit, unit_rate, amount, 
            cgst_percent, cgst_amount, sgst_percent, sgst_amount, total_amount,
            length, width, thickness, diameter, outer_diameter, density, weight_per_unit
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ,
          [
            quotationId,
            correctedItemCode,
            item.description || null,
            item.material_name || null,
            item.material_type || null,
            item.drawing_no || correctedItemCode,
            qty,
            designQty,
            (item.planned_qty !== undefined && item.planned_qty !== null && item.planned_qty !== '') ? parseFloat(item.planned_qty) : null,
            item.uom || item.unit || 'NOS',
            rate,
            amount,
            cgstPercent,
            cgstAmount,
            sgstPercent,
            sgstAmount,
            totalItemAmount,
            parseFloat(item.length || (item.dimensions && item.dimensions.length)) || 0,
            parseFloat(item.width || (item.dimensions && item.dimensions.width)) || 0,
            parseFloat(item.thickness || (item.dimensions && item.dimensions.thickness)) || 0,
            parseFloat(item.diameter || (item.dimensions && item.dimensions.diameter)) || 0,
            parseFloat(item.outer_diameter || (item.dimensions && item.dimensions.outer_diameter)) || 0,
            parseFloat(item.density || (item.dimensions && item.dimensions.density)) || 0,
            parseFloat(item.weight_per_unit || (item.dimensions && item.dimensions.weight_per_unit)) || 0
          ]
        );
      }
    }

    const grandTotal = totalAmount + totalTaxAmount;

    await connection.execute(
      'UPDATE quotations SET total_amount = ?, tax_amount = ?, grand_total = ? WHERE id = ?',
      [totalAmount, totalTaxAmount, grandTotal, quotationId]
    );

    // If status is RECEIVED, check for single vendor auto-approval
    if (status === 'RECEIVED') {
      await handleAutoApproval(quotationId, connection);
    }

    await connection.commit();
    return { id: quotationId, quote_number: quoteNumber };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getQuotations = async (filters = {}) => {
  const { status, vendorId, latestOnly = true, baseQuoteNumber, search } = filters;

  let query = `
    SELECT q.*, v.vendor_name, so.so_number,
           COALESCE(
             (
               SELECT COALESCE(soi.drawing_no, oi.drawing_no, ppi_dr.item_code)
               FROM production_plan_items ppi_dr
               LEFT JOIN sales_order_items soi ON ppi_dr.sales_order_item_id = soi.id
               LEFT JOIN order_items oi ON ppi_dr.sales_order_item_id = oi.id AND ppi_dr.sales_order_id = oi.order_id
               WHERE ppi_dr.plan_id = pp.id
               LIMIT 1
             ),
             pp.bom_no,
             (
               SELECT soi.drawing_no 
               FROM sales_order_items soi 
               WHERE soi.sales_order_id = q.sales_order_id 
               LIMIT 1
             )
           ) as drawing_no,
           COALESCE(
             ppi.description,
             (
               SELECT soi.description 
               FROM sales_order_items soi 
               WHERE soi.sales_order_id = q.sales_order_id 
               LIMIT 1
             )
           ) as finished_good,
           COALESCE(
             so.project_name, 
             (
               SELECT so2.project_name 
               FROM production_plans pp
               LEFT JOIN (
                 SELECT plan_id, sales_order_item_id FROM production_plan_items
                 WHERE id IN (SELECT MIN(id) FROM production_plan_items GROUP BY plan_id)
               ) ppi ON pp.id = ppi.plan_id
               LEFT JOIN sales_order_items soi ON ppi.sales_order_item_id = soi.id
               LEFT JOIN sales_orders so2 ON (
                 (soi.id IS NOT NULL AND soi.sales_order_id = so2.id) OR
                 (soi.id IS NULL AND pp.sales_order_id = so2.id)
               )
               WHERE pp.id = mr.plan_id
             ),
             (
               SELECT o.project_name 
               FROM production_plans pp
               JOIN orders o ON pp.sales_order_id = o.id AND o.source_type = 'DIRECT'
               WHERE pp.id = mr.plan_id
             ),
             (SELECT so3.project_name FROM sales_orders so3 WHERE mr.notes LIKE CONCAT('%', so3.project_name, '%') LIMIT 1),
             mr.purpose, 
             'General Procurement'
           ) as project_name,
           COALESCE(
             c.company_name,
             (
               SELECT c2.company_name 
               FROM production_plans pp
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
               WHERE pp.id = mr.plan_id
             ),
             (
               SELECT c3.company_name 
               FROM production_plans pp
               JOIN orders o ON pp.sales_order_id = o.id AND o.source_type = 'DIRECT'
               JOIN companies c3 ON o.client_id = c3.id
               WHERE pp.id = mr.plan_id
             ),
             'Internal'
           ) as company_name,
           mr.mr_number, r.rfq_number
    FROM quotations q
    LEFT JOIN vendors v ON v.id = q.vendor_id
    LEFT JOIN sales_orders so ON so.id = q.sales_order_id
    LEFT JOIN companies c ON c.id = so.company_id
    LEFT JOIN material_requests mr ON mr.id = q.mr_id
    LEFT JOIN procurement_rfqs r ON r.id = q.rfq_id
    LEFT JOIN production_plans pp ON mr.plan_id = pp.id
    LEFT JOIN (
      SELECT plan_id, description FROM production_plan_items
      WHERE id IN (SELECT MIN(id) FROM production_plan_items GROUP BY plan_id)
    ) ppi ON pp.id = ppi.plan_id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ' AND q.status = ?';
    params.push(status);
  } else if (latestOnly) {
    query += " AND q.status != 'SUPERSEDED'";
  }

  if (vendorId) {
    query += ' AND q.vendor_id = ?';
    params.push(vendorId);
  }

  if (baseQuoteNumber) {
    query += ' AND q.base_quote_number = ?';
    params.push(baseQuoteNumber);
  }

  if (search) {
    const searchLike = `%${search}%`;
    query += ` AND (
      q.quote_number LIKE ? 
      OR v.vendor_name LIKE ? 
      OR so.project_name LIKE ? 
      OR c.company_name LIKE ? 
      OR mr.mr_number LIKE ? 
      OR EXISTS (
        SELECT 1 FROM quotation_items qi 
        WHERE qi.quotation_id = q.id 
        AND (qi.drawing_no LIKE ? OR qi.description LIKE ?)
      )
    )`;
    params.push(searchLike, searchLike, searchLike, searchLike, searchLike, searchLike, searchLike);
  }

  query += ' ORDER BY q.created_at DESC';

  const [quotations] = await pool.query(query, params);

  if (quotations.length === 0) return [];

  const quotationIds = quotations.map(q => q.id);
  const [items] = await pool.query(
    `SELECT qi.*, 
            COALESCE(NULLIF(qi.length, 0), mri.length, sb.length, 0) as length,
            COALESCE(NULLIF(qi.width, 0), mri.width, sb.width, 0) as width,
            COALESCE(NULLIF(qi.thickness, 0), mri.thickness, sb.thickness, 0) as thickness,
            COALESCE(NULLIF(qi.diameter, 0), mri.diameter, sb.diameter, 0) as diameter,
            COALESCE(NULLIF(qi.outer_diameter, 0), mri.outer_diameter, sb.outer_diameter, 0) as outer_diameter,
            COALESCE(NULLIF(qi.density, 0), mri.density, sb.density, 0) as density,
            COALESCE(NULLIF(qi.weight_per_unit, 0), mri.weight_per_unit, sb.weight_per_unit, 0) as weight_per_unit
     FROM quotation_items qi
     LEFT JOIN quotations q ON qi.quotation_id = q.id
     LEFT JOIN material_request_items mri ON q.mr_id = mri.mr_id AND qi.item_code = mri.item_code AND ABS(qi.quantity - mri.quantity) < 0.01
     LEFT JOIN (
       SELECT item_code, 
              MAX(length) as length, MAX(width) as width, MAX(thickness) as thickness, 
              MAX(diameter) as diameter, MAX(outer_diameter) as outer_diameter,
              MAX(density) as density, MAX(weight_per_unit) as weight_per_unit
       FROM stock_balance 
       GROUP BY item_code
     ) sb ON qi.item_code = sb.item_code
     WHERE qi.quotation_id IN (?)`,
    [quotationIds]
  );

  return quotations.map(q => {
    const parentDrawingNo = q.drawing_no;
    const isParentDwgPattern = parentDrawingNo ? /^(RM-|OTH-|SFG-|FG-|GEN-|CAT-)/i.test(parentDrawingNo) : false;

    const quoteItems = items.filter(i => i.quotation_id === q.id).map(item => {
      if (parentDrawingNo && !isParentDwgPattern) {
        return { ...item, drawing_no: parentDrawingNo };
      }
      return item;
    });

    return {
      ...q,
      items: quoteItems
    };
  });
};

const getQuotationById = async (quotationId) => {
  const [rows] = await pool.query(
    `SELECT q.*, mr.mr_number, so.so_number,
            COALESCE(
              (
                SELECT COALESCE(soi.drawing_no, oi.drawing_no, ppi_dr.item_code)
                FROM production_plan_items ppi_dr
                LEFT JOIN sales_order_items soi ON ppi_dr.sales_order_item_id = soi.id
                LEFT JOIN order_items oi ON ppi_dr.sales_order_item_id = oi.id AND ppi_dr.sales_order_id = oi.order_id
                WHERE ppi_dr.plan_id = pp.id
                LIMIT 1
              ),
              pp.bom_no,
              (
                SELECT soi.drawing_no 
                FROM sales_order_items soi 
                WHERE soi.sales_order_id = q.sales_order_id 
                LIMIT 1
              )
            ) as drawing_no,
            COALESCE(
              ppi.description,
              (
                SELECT soi.description 
                FROM sales_order_items soi 
                WHERE soi.sales_order_id = q.sales_order_id 
                LIMIT 1
              )
            ) as finished_good,
            COALESCE(
              so.project_name, 
              (SELECT so2.project_name FROM sales_orders so2 JOIN production_plans pp ON so2.id = pp.sales_order_id WHERE pp.id = mr.plan_id),
              (SELECT so3.project_name FROM sales_orders so3 WHERE mr.notes LIKE CONCAT('%', so3.project_name, '%') LIMIT 1),
              mr.purpose, 
              'General Procurement'
            ) as project_name, 
            COALESCE(
              c.company_name,
              (SELECT c2.company_name FROM companies c2 JOIN sales_orders so2 ON c2.id = so2.company_id JOIN production_plans pp ON so2.id = pp.sales_order_id WHERE pp.id = mr.plan_id),
              'Internal'
            ) as company_name,
            r.rfq_number
     FROM quotations q 
     LEFT JOIN material_requests mr ON mr.id = q.mr_id
     LEFT JOIN sales_orders so ON so.id = q.sales_order_id
     LEFT JOIN companies c ON c.id = so.company_id
     LEFT JOIN procurement_rfqs r ON r.id = q.rfq_id
     LEFT JOIN production_plans pp ON mr.plan_id = pp.id
     LEFT JOIN (
       SELECT plan_id, description FROM production_plan_items
       WHERE id IN (SELECT MIN(id) FROM production_plan_items GROUP BY plan_id)
     ) ppi ON pp.id = ppi.plan_id
     WHERE q.id = ?`,
    [quotationId]
  );

  if (!rows.length) {
    const error = new Error('Quotation not found');
    error.statusCode = 404;
    throw error;
  }

  const [items] = await pool.query(
    `SELECT qi.*, 
            COALESCE(
              -- 1. Try production_plan_materials
              (
                SELECT ppm.bom_ref 
                FROM production_plan_materials ppm
                JOIN material_requests mr ON mr.plan_id = ppm.plan_id
                WHERE mr.id = q.mr_id
                  AND (ppm.material_name = qi.material_name OR ppm.item_code = qi.item_code)
                LIMIT 1
              ),
              -- 2. Try sales_order_item_materials
              (
                SELECT som.drawing_no 
                FROM sales_order_item_materials som
                JOIN sales_order_items soi ON soi.id = som.sales_order_item_id
                WHERE soi.sales_order_id = q.sales_order_id
                  AND (som.material_name = qi.material_name OR som.item_code = qi.item_code)
                LIMIT 1
              ),
              qi.drawing_no,
              qi.item_code
            ) AS drawing_no,
            (
              SELECT cd.description 
              FROM customer_drawings cd 
              WHERE cd.drawing_no = COALESCE(
                (
                  SELECT ppm.bom_ref 
                  FROM production_plan_materials ppm
                  JOIN material_requests mr ON mr.plan_id = ppm.plan_id
                  WHERE mr.id = q.mr_id
                    AND (ppm.material_name = qi.material_name OR ppm.item_code = qi.item_code)
                  LIMIT 1
                ),
                (
                  SELECT som.drawing_no 
                  FROM sales_order_item_materials som
                  JOIN sales_order_items soi ON soi.id = som.sales_order_item_id
                  WHERE soi.sales_order_id = q.sales_order_id
                    AND (som.material_name = qi.material_name OR som.item_code = qi.item_code)
                  LIMIT 1
                )
              )
              LIMIT 1
            ) AS drawing_name,
            COALESCE(
              NULLIF(qi.length, 0),
              (
                SELECT ppm.length 
                FROM production_plan_materials ppm
                JOIN material_requests mr ON mr.plan_id = ppm.plan_id
                WHERE mr.id = q.mr_id
                  AND (ppm.material_name = qi.material_name OR ppm.item_code = qi.item_code)
                LIMIT 1
              ),
              (
                SELECT som.length 
                FROM sales_order_item_materials som
                JOIN sales_order_items soi ON soi.id = som.sales_order_item_id
                WHERE soi.sales_order_id = q.sales_order_id
                  AND (som.material_name = qi.material_name OR som.item_code = qi.item_code)
                LIMIT 1
              ),
              mri.length,
              sb.length,
              0
            ) as length,
            COALESCE(
              NULLIF(qi.width, 0),
              (
                SELECT ppm.width 
                FROM production_plan_materials ppm
                JOIN material_requests mr ON mr.plan_id = ppm.plan_id
                WHERE mr.id = q.mr_id
                  AND (ppm.material_name = qi.material_name OR ppm.item_code = qi.item_code)
                LIMIT 1
              ),
              (
                SELECT som.width 
                FROM sales_order_item_materials som
                JOIN sales_order_items soi ON soi.id = som.sales_order_item_id
                WHERE soi.sales_order_id = q.sales_order_id
                  AND (som.material_name = qi.material_name OR som.item_code = qi.item_code)
                LIMIT 1
              ),
              mri.width,
              sb.width,
              0
            ) as width,
            COALESCE(
              NULLIF(qi.thickness, 0),
              (
                SELECT ppm.thickness 
                FROM production_plan_materials ppm
                JOIN material_requests mr ON mr.plan_id = ppm.plan_id
                WHERE mr.id = q.mr_id
                  AND (ppm.material_name = qi.material_name OR ppm.item_code = qi.item_code)
                LIMIT 1
              ),
              (
                SELECT som.thickness 
                FROM sales_order_item_materials som
                JOIN sales_order_items soi ON soi.id = som.sales_order_item_id
                WHERE soi.sales_order_id = q.sales_order_id
                  AND (som.material_name = qi.material_name OR som.item_code = qi.item_code)
                LIMIT 1
              ),
              mri.thickness,
              sb.thickness,
              0
            ) as thickness,
            COALESCE(
              NULLIF(qi.diameter, 0),
              (
                SELECT ppm.diameter 
                FROM production_plan_materials ppm
                JOIN material_requests mr ON mr.plan_id = ppm.plan_id
                WHERE mr.id = q.mr_id
                  AND (ppm.material_name = qi.material_name OR ppm.item_code = qi.item_code)
                LIMIT 1
              ),
              (
                SELECT som.diameter 
                FROM sales_order_item_materials som
                JOIN sales_order_items soi ON soi.id = som.sales_order_item_id
                WHERE soi.sales_order_id = q.sales_order_id
                  AND (som.material_name = qi.material_name OR som.item_code = qi.item_code)
                LIMIT 1
              ),
              mri.diameter,
              sb.diameter,
              0
            ) as diameter,
            COALESCE(
              NULLIF(qi.outer_diameter, 0),
              (
                SELECT ppm.outer_diameter 
                FROM production_plan_materials ppm
                JOIN material_requests mr ON mr.plan_id = ppm.plan_id
                WHERE mr.id = q.mr_id
                  AND (ppm.material_name = qi.material_name OR ppm.item_code = qi.item_code)
                LIMIT 1
              ),
              (
                SELECT som.outer_diameter 
                FROM sales_order_item_materials som
                JOIN sales_order_items soi ON soi.id = som.sales_order_item_id
                WHERE soi.sales_order_id = q.sales_order_id
                  AND (som.material_name = qi.material_name OR som.item_code = qi.item_code)
                LIMIT 1
              ),
              mri.outer_diameter,
              sb.outer_diameter,
              0
            ) as outer_diameter,
            COALESCE(NULLIF(qi.density, 0), mri.density, sb.density, 0) as density,
            COALESCE(NULLIF(qi.weight_per_unit, 0), mri.weight_per_unit, sb.weight_per_unit, 0) as weight_per_unit
     FROM quotation_items qi
     LEFT JOIN quotations q ON qi.quotation_id = q.id
     LEFT JOIN material_request_items mri ON q.mr_id = mri.mr_id AND qi.item_code = mri.item_code AND ABS(qi.quantity - mri.quantity) < 0.01
     LEFT JOIN (
       SELECT item_code, 
              MAX(length) as length, MAX(width) as width, MAX(thickness) as thickness, 
              MAX(diameter) as diameter, MAX(outer_diameter) as outer_diameter,
              MAX(density) as density, MAX(weight_per_unit) as weight_per_unit
       FROM stock_balance 
       GROUP BY item_code
     ) sb ON qi.item_code = sb.item_code
     WHERE qi.quotation_id = ?`,
    [quotationId]
  );

  const quote = rows[0];
  if (quote && quote.drawing_no) {
    const parentDrawingNo = quote.drawing_no;
    const isParentDwgPattern = /^(RM-|OTH-|SFG-|FG-|GEN-|CAT-)/i.test(parentDrawingNo);
    if (!isParentDwgPattern) {
      items.forEach(item => {
        item.drawing_no = parentDrawingNo;
      });
    }
  }

  return { ...quote, items };
};

const handleAutoApproval = async (quotationId, connection) => {
  const [q] = await connection.query(
    'SELECT rfq_group_id, rfq_id, sales_order_id, mr_id, base_quote_number FROM quotations WHERE id = ?',
    [quotationId]
  );

  if (q.length > 0) {
    const { rfq_group_id, rfq_id, sales_order_id, mr_id, base_quote_number } = q[0];
    let whereClause = '';
    let params = [];

    if (rfq_group_id) {
      whereClause = 'rfq_group_id = ?';
      params = [rfq_group_id];
    } else if (rfq_id) {
      whereClause = 'rfq_id = ?';
      params = [rfq_id];
    } else {
      whereClause = 'sales_order_id <=> ? AND mr_id <=> ?';
      params = [sales_order_id, mr_id];
    }

    const [countRows] = await connection.query(
      `SELECT COUNT(DISTINCT vendor_id) as count FROM quotations WHERE ${whereClause} AND status != 'SUPERSEDED'`,
      params
    );

    if (countRows[0].count === 1) {
      console.log(`[AutoApprove] Single vendor detected for quotation ${quotationId}. Setting status to REVIEWED.`);

      await connection.execute(
        'UPDATE quotations SET status = ? WHERE id = ?',
        ['REVIEWED', quotationId]
      );

      // Check if PO already exists for this quotation or its base versions to avoid duplicates
      const [existingPO] = await connection.query(
        `SELECT po.id FROM purchase_orders po
         JOIN quotations q ON po.quotation_id = q.id
         WHERE q.id = ? OR q.base_quote_number = ?`,
        [quotationId, base_quote_number]
      );

      if (existingPO.length === 0) {
        await purchaseOrderService.createPurchaseOrder({
          quotationId: quotationId
        }, connection);
      } else {
        // If PO exists, we might want to update it with the new quotation_id to link it to the latest version
        await connection.execute(
          'UPDATE purchase_orders SET quotation_id = ? WHERE id = ?',
          [quotationId, existingPO[0].id]
        );
      }
      return true;
    }
  }
  return false;
};

const updateQuotationStatus = async (quotationId, status) => {
  const validStatuses = ['DRAFT', 'SENT', 'EMAIL_RECEIVED', 'RECEIVED', 'REVIEWED', 'CLOSED', 'PENDING', 'SUPERSEDED', 'REJECTED'];
  if (!validStatuses.includes(status)) {
    const error = new Error('Invalid status');
    error.statusCode = 400;
    throw error;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      'UPDATE quotations SET status = ? WHERE id = ?',
      [status, quotationId]
    );

    // Auto-rejection of other quotations is disabled to allow many-to-many / individual item selection without rejecting competing quotes.

    // If status is RECEIVED, check for auto-approval
    if (status === 'RECEIVED') {
      await handleAutoApproval(quotationId, connection);
    } else if (status === 'REVIEWED') {
      // Manual approval - create PO if not exists
      // Check if PO already exists for this quotation or its base versions to avoid duplicates
      const [qInfo] = await connection.query('SELECT base_quote_number FROM quotations WHERE id = ?', [quotationId]);
      const baseQuoteNumber = qInfo[0]?.base_quote_number;

      const [existingPO] = await connection.query(
        `SELECT po.id FROM purchase_orders po
         JOIN quotations q ON po.quotation_id = q.id
         WHERE q.id = ? OR q.base_quote_number = ?`,
        [quotationId, baseQuoteNumber]
      );

      if (existingPO.length === 0) {
        await purchaseOrderService.createPurchaseOrder({
          quotationId: quotationId
        }, connection);
      } else {
        // Link existing PO to new quotation version
        await connection.execute(
          'UPDATE purchase_orders SET quotation_id = ? WHERE id = ?',
          [quotationId, existingPO[0].id]
        );
      }
    }

    await connection.commit();

    // Get final status (might have changed to REVIEWED via auto-approval)
    const [finalRow] = await connection.query('SELECT status FROM quotations WHERE id = ?', [quotationId]);
    return finalRow[0].status;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateQuotation = async (quotationId, payload) => {
  const { vendorId, vendor_id, validUntil, notes, items, received_pdf_path, status, hostCompanyId, host_company_id } = payload;

  const hostCompanyIdVal = hostCompanyId || host_company_id;
  const vendorIdVal = vendorId || vendor_id;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Get the current quotation to find base_quote_number and current version
    const [current] = await connection.query(
      'SELECT * FROM quotations WHERE id = ?',
      [quotationId]
    );

    if (current.length === 0) {
      throw new Error('Quotation not found');
    }

    const oldQuote = current[0];
    const newVersion = (oldQuote.version || 1) + 1;
    const baseQuoteNumber = oldQuote.base_quote_number || oldQuote.quote_number;

    // New quote number reflects version
    const newQuoteNumber = `${baseQuoteNumber}-V${newVersion}`;

    // 2. Insert new version of quotation
    const [result] = await connection.execute(
      `INSERT INTO quotations (
        quote_number, base_quote_number, version, vendor_id, sales_order_id, 
        mr_id, rfq_id, rfq_group_id, status, valid_until, notes, received_pdf_path, host_company_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newQuoteNumber,
        baseQuoteNumber,
        newVersion,
        vendorIdVal !== undefined ? (vendorIdVal === '' ? null : parseInt(vendorIdVal)) : oldQuote.vendor_id,
        oldQuote.sales_order_id,
        oldQuote.mr_id,
        oldQuote.rfq_id,
        oldQuote.rfq_group_id,
        status !== undefined ? status : (oldQuote.status || 'RECEIVED'),
        validUntil !== undefined ? (validUntil === '' ? null : validUntil) : oldQuote.valid_until,
        notes !== undefined ? notes : oldQuote.notes,
        received_pdf_path !== undefined ? received_pdf_path : oldQuote.received_pdf_path,
        hostCompanyIdVal !== undefined ? (hostCompanyIdVal === '' ? null : hostCompanyIdVal) : oldQuote.host_company_id
      ]
    );

    const newQuotationId = result.insertId;

    // 3. Handle items
    let finalItems = items;
    if (!finalItems) {
      // If items not provided in payload, copy from old version
      const [oldItems] = await connection.query(
        'SELECT * FROM quotation_items WHERE quotation_id = ?',
        [quotationId]
      );
      finalItems = oldItems;
    }

    let totalAmount = 0;
    let totalTaxAmount = 0;

    if (Array.isArray(finalItems) && finalItems.length > 0) {
      for (const item of finalItems) {
        const designQty = parseFloat(item.design_qty) || parseFloat(item.quantity) || 0;
        const qty = parseFloat(item.quantity) || designQty || 0;
        const rate = parseFloat(item.unit_rate) || 0;
        const amount = Number((qty * rate).toFixed(2));
        const cgstPercent = parseFloat(item.cgst_percent) || 9;
        const sgstPercent = parseFloat(item.sgst_percent) || 9;
        const cgstAmount = Number(((amount * cgstPercent) / 100).toFixed(2));
        const sgstAmount = Number(((amount * sgstPercent) / 100).toFixed(2));
        const totalItemAmount = Number((amount + cgstAmount + sgstAmount).toFixed(2));

        totalAmount = Number((totalAmount + amount).toFixed(2));
        totalTaxAmount = Number((totalTaxAmount + cgstAmount + sgstAmount).toFixed(2));

        const correctedItemCode = await getCorrectItemCode(item, connection);

        await connection.execute(
          `INSERT INTO quotation_items (
            quotation_id, item_code, description, material_name, material_type, 
            drawing_no, quantity, design_qty, planned_qty, unit, unit_rate, 
            amount, cgst_percent, cgst_amount, sgst_percent, sgst_amount, total_amount,
            length, width, thickness, diameter, outer_diameter, density, weight_per_unit
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newQuotationId,
            correctedItemCode,
            item.description || null,
            item.material_name || null,
            item.material_type || null,
            item.drawing_no || correctedItemCode,
            qty,
            designQty,
            (item.planned_qty !== undefined && item.planned_qty !== null && item.planned_qty !== '') ? parseFloat(item.planned_qty) : null,
            item.uom || item.unit || 'NOS',
            rate,
            amount,
            cgstPercent,
            cgstAmount,
            sgstPercent,
            sgstAmount,
            totalItemAmount,
            parseFloat(item.length || (item.dimensions && item.dimensions.length)) || 0,
            parseFloat(item.width || (item.dimensions && item.dimensions.width)) || 0,
            parseFloat(item.thickness || (item.dimensions && item.dimensions.thickness)) || 0,
            parseFloat(item.diameter || (item.dimensions && item.dimensions.diameter)) || 0,
            parseFloat(item.outer_diameter || (item.dimensions && item.dimensions.outer_diameter)) || 0,
            parseFloat(item.density || (item.dimensions && item.dimensions.density)) || 0,
            parseFloat(item.weight_per_unit || (item.dimensions && item.dimensions.weight_per_unit)) || 0
          ]
        );
      }
    }

    const grandTotal = totalAmount + totalTaxAmount;

    await connection.execute(
      'UPDATE quotations SET total_amount = ?, tax_amount = ?, grand_total = ? WHERE id = ?',
      [totalAmount, totalTaxAmount, grandTotal, newQuotationId]
    );

    // Optional: Mark old version as superseded if it was the previous latest
    await connection.execute(
      "UPDATE quotations SET status = 'SUPERSEDED' WHERE id = ? AND status != 'SUPERSEDED'",
      [quotationId]
    );

    // Check if PO already exists for this quotation and update its quotation_id and vendor_id
    const [existingPO] = await connection.query(
      'SELECT id FROM purchase_orders WHERE quotation_id = ?',
      [quotationId]
    );

    if (existingPO.length > 0) {
      await connection.execute(
        'UPDATE purchase_orders SET quotation_id = ?, vendor_id = ? WHERE id = ?',
        [newQuotationId, vendorIdVal !== undefined ? parseInt(vendorIdVal) : oldQuote.vendor_id, existingPO[0].id]
      );
    }

    // If the new version is RECEIVED, check for single vendor auto-approval
    const currentStatus = status || 'RECEIVED';
    if (currentStatus === 'RECEIVED') {
      await handleAutoApproval(newQuotationId, connection);
    }

    await connection.commit();
    return { id: newQuotationId, quote_number: newQuoteNumber, version: newVersion };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const deleteQuotation = async (quotationId) => {
  try {
    await getQuotationById(quotationId);
  } catch (error) {
    if (error.statusCode === 404) {
      return; // Already deleted, consider success
    }
    throw error;
  }

  // Check if any purchase orders reference this quotation
  const [poRefs] = await pool.query('SELECT po_number FROM purchase_orders WHERE quotation_id = ?', [quotationId]);
  if (poRefs.length > 0) {
    const poNumbers = poRefs.map(p => p.po_number).join(', ');
    const error = new Error(`Cannot delete quotation because it is referenced by Purchase Order(s): ${poNumbers}. Please delete the PO(s) first.`);
    error.statusCode = 400;
    throw error;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Delete related items first
    await connection.execute('DELETE FROM quotation_items WHERE quotation_id = ?', [quotationId]);

    // Delete the quotation
    await connection.execute('DELETE FROM quotations WHERE id = ?', [quotationId]);

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getQuotationStats = async () => {
  const [stats] = await pool.query(`
    SELECT 
      COUNT(*) as total_quotations,
      SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as sent_quotations,
      SUM(CASE WHEN status = 'EMAIL_RECEIVED' THEN 1 ELSE 0 END) as email_received_quotations,
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_quotations,
      SUM(CASE WHEN status = 'REVIEWED' THEN 1 ELSE 0 END) as approved_quotations,
      SUM(CASE WHEN status = 'RECEIVED' THEN 1 ELSE 0 END) as received_quotations,
      SUM(total_amount) as total_value
    FROM quotations
  `);

  return stats[0] || {
    total_quotations: 0,
    sent_quotations: 0,
    pending_quotations: 0,
    approved_quotations: 0,
    received_quotations: 0,
    total_value: 0
  };
};

const sendQuotationEmail = async (quotationId, emailData) => {
  const { to, subject, message, attachPDF } = emailData;

  const quotation = await getQuotationById(quotationId);
  const [vendorRows] = await pool.query('SELECT * FROM vendors WHERE id = ?', [quotation.vendor_id]);
  const vendor = vendorRows[0];

  if (!to || !subject || !message) {
    const error = new Error('Email recipient, subject, and message are required');
    error.statusCode = 400;
    throw error;
  }

  if (!to.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    const error = new Error('Invalid email address');
    error.statusCode = 400;
    throw error;
  }

  try {
    let attachments = [];
    if (attachPDF) {
      const pdfBuffer = await generateQuotationPDF(quotationId);
      attachments.push({
        filename: `Quotation_${quotation.quote_number}.pdf`,
        content: pdfBuffer
      });
    }

    let finalSubject = subject;
    if (!subject.includes(quotation.quote_number)) {
      finalSubject = `[${quotation.quote_number}] ${subject}`;
    }

    const emailResult = await emailService.sendEmail(to, finalSubject, message, attachments);

    console.log(`[sendQuotationEmail] Email sent successfully to ${to}`);

    await pool.execute(
      'UPDATE quotations SET status = ? WHERE id = ?',
      ['SENT', quotationId]
    );

    return {
      id: quotationId,
      sent_to: to,
      sent_at: new Date(),
      message: emailResult.message,
      messageId: emailResult.messageId
    };
  } catch (error) {
    console.error(`[sendQuotationEmail] Error: ${error.message}`);
    throw error;
  }
};

const generateQuotationPDF = async (quotationId) => {
  const adminCompanyMasterService = require('./adminCompanyMasterService');
  const quotation = await getQuotationById(quotationId);

  let activeCompany = null;
  if (quotation.host_company_id) {
    try {
      activeCompany = await adminCompanyMasterService.getCompanyById(quotation.host_company_id);
    } catch (err) {
      console.error(`[generateQuotationPDF] Error loading company profile for host_company_id ${quotation.host_company_id}:`, err.message);
    }
  }

  if (!activeCompany) {
    activeCompany = await adminCompanyMasterService.getActiveCompany();
  }

  const hostCompanyName = activeCompany?.company_name || 'SPTECHPIONEER PVT LTD';
  const hostCompanyAddress = activeCompany?.company_address || 'Industrial Area, Sector 5, Pune, Maharashtra - 411026';
  const hostGSTIN = activeCompany?.gstin || '';
  const invoiceFooterNotes = activeCompany?.invoice_footer_notes || '';

  const fs = require('fs');
  const path = require('path');
  let logoBase64 = null;
  if (activeCompany && activeCompany.company_logo) {
    const logoPath = path.join(__dirname, '../../', activeCompany.company_logo);
    if (fs.existsSync(logoPath)) {
      logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
    }
  }

  const [vendorRows] = await pool.query('SELECT * FROM vendors WHERE id = ?', [quotation.vendor_id]);
  const vendor = vendorRows[0];

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        
        body { 
          font-family: 'Inter', sans-serif; 
          color: #1e293b; 
          line-height: 1.4; 
          margin: 0;
          padding: 0;
          background-color: #fff;
          font-size: 11px;
        }
        
        .page {
          padding: 20px;
          border: 1px solid #1e293b;
          min-height: 297mm;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }

        .header-box {
          border: 1px solid #1e293b;
          display: flex;
          align-items: center;
          padding: 10px 15px;
          margin-bottom: 15px;
        }

        .logo-container {
          width: 80px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-right: 1px solid #1e293b;
          padding-right: 15px;
          flex-shrink: 0;
        }

        .logo-placeholder {
          font-size: 24px;
          font-weight: 800;
          color: #64748b;
          border: 2px solid #64748b;
          padding: 5px;
          text-align: center;
          border-radius: 4px;
          line-height: 1;
        }

        .header-content {
          flex-grow: 1;
          text-align: center;
          padding-left: 15px;
        }

        .rfq-title {
          color: #ff6b00;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          margin: 0 0 5px 0;
        }

        .company-name {
          color: #1e293b;
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 5px 0;
          text-transform: uppercase;
        }

        .company-address {
          color: #475569;
          font-size: 10px;
          margin: 2px 0;
        }

        .company-contact {
          color: #475569;
          font-size: 10px;
          margin: 2px 0;
          font-weight: 500;
        }

        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-bottom: 15px;
        }

        .info-card {
          border: 1px solid #1e293b;
          padding: 10px;
          background: #fff;
          min-height: 95px;
        }

        .info-header {
          font-size: 10px;
          font-weight: 800;
          color: #1e293b;
          text-transform: uppercase;
          border-bottom: 1px solid #cbd5e1;
          padding-bottom: 5px;
          margin-bottom: 8px;
        }

        .info-body p {
          margin: 3px 0;
          line-height: 1.4;
        }

        .details-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
        }

        .details-table th, .details-table td {
          border: 1px solid #1e293b;
          padding: 6px 8px;
          font-size: 10px;
          text-align: left;
        }

        .details-table th {
          background: #f8fafc;
          font-weight: 700;
          text-transform: uppercase;
          color: #1e293b;
          border-bottom: 1px solid #1e293b;
        }

        .amount-col {
          text-align: right !important;
        }

        .center-col {
          text-align: center !important;
        }

        .summary-block {
          display: grid;
          grid-template-columns: 3fr 2fr;
          border: 1px solid #1e293b;
          margin-bottom: 15px;
          background: #fff;
        }

        .remarks-container {
          padding: 10px;
          border-right: 1px solid #1e293b;
        }

        .summary-table {
          width: 100%;
          border-collapse: collapse;
        }

        .summary-table td {
          padding: 6px 10px;
          font-size: 10px;
          border-bottom: 1px solid #e2e8f0;
        }

        .summary-table tr:last-child td {
          border-bottom: none;
        }

        .summary-label {
          color: #475569;
          font-weight: 500;
        }

        .summary-value {
          text-align: right;
          font-weight: 600;
          color: #1e293b;
        }

        .grand-total-row {
          background: #f8fafc;
          font-size: 11px;
          font-weight: 800 !important;
        }

        .grand-total-value {
          color: #10b981;
          font-size: 12px;
          font-weight: 800;
        }

        .section-box {
          border: 1px solid #1e293b;
          margin-bottom: 15px;
        }

        .section-box-header {
          background: #f8fafc;
          border-bottom: 1px solid #1e293b;
          padding: 6px 10px;
          font-size: 9px;
          font-weight: 800;
          color: #1e293b;
          text-transform: uppercase;
        }

        .section-box-content {
          padding: 10px;
          font-size: 10px;
          color: #334155;
          min-height: 25px;
        }

        .footer {
          margin-top: auto;
          padding-top: 10px;
          border-top: 1px solid #cbd5e1;
          display: flex;
          justify-content: space-between;
          color: #64748b;
          font-size: 9px;
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header-box">
          <div class="logo-container">
            {{#logoBase64}}
            <img src="{{logoBase64}}" style="max-height: 70px; max-width: 70px; object-fit: contain;" />
            {{/logoBase64}}
            {{^logoBase64}}
            <div class="logo-placeholder">SP<br><span style="font-size: 10px;">TP</span></div>
            {{/logoBase64}}
          </div>
          <div class="header-content">
            <h1 class="rfq-title">{{#isRFQ}}Request For Quotation{{/isRFQ}}{{^isRFQ}}Supplier PO{{/isRFQ}}</h1>
            <h2 class="company-name">{{hostCompanyName}}</h2>
            <p class="company-address">{{hostCompanyAddress}}</p>
            {{#hostGSTIN}}
            <p class="company-address">GST No: {{hostGSTIN}}</p>
            {{/hostGSTIN}}
            <p class="company-contact">
              {{#hostEmail}}Email: {{hostEmail}}{{/hostEmail}}
              {{#hostPhone}} | Mobile: {{hostPhone}}{{/hostPhone}}
            </p>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-card">
            <div class="info-header">RFQ TO:</div>
            <div class="info-body">
              <p><strong>{{vendor_name}}</strong></p>
              <p>{{location}}</p>
              <p style="color: #475569; font-size: 9px; margin-top: 4px;">Email: {{vendor_email}}</p>
              <p style="color: #475569; font-size: 9px;">Phone: {{phone}}</p>
              {{#vendor_gstin}}
              <p style="color: #475569; font-size: 9px; font-weight: 500;">GST No: {{vendor_gstin}}</p>
              {{/vendor_gstin}}
            </div>
          </div>
          <div class="info-card">
            <div class="info-header">RFQ DETAILS:</div>
            <table style="width: 100%; border: none; margin: 0; background: transparent;">
              <tr style="background: transparent;">
                <td style="width: 35%; border: none; padding: 2px 0; color: #475569;">Date</td>
                <td style="width: 5%; border: none; padding: 2px 0; color: #475569;">:</td>
                <td style="width: 60%; border: none; padding: 2px 0; font-weight: 600;">{{created_at}}</td>
              </tr>
              <tr style="background: transparent;">
                <td style="border: none; padding: 2px 0; color: #475569;">RFQ No</td>
                <td style="border: none; padding: 2px 0; color: #475569;">:</td>
                <td style="border: none; padding: 2px 0; font-weight: 600; font-family: monospace;">{{quote_number}}</td>
              </tr>
              <tr style="background: transparent;">
                <td style="border: none; padding: 2px 0; color: #475569;">Valid Till</td>
                <td style="border: none; padding: 2px 0; color: #475569;">:</td>
                <td style="border: none; padding: 2px 0; font-weight: 600;">{{valid_until}}</td>
              </tr>
            </table>
          </div>
        </div>

        <table class="details-table">
          <thead>
            {{#isRFQ}}
            <tr>
              <th style="width: 5%; text-align: center;">Sr. No</th>
              <th style="width: 25%">Item Code</th>
              <th style="width: 40%">Material Name</th>
              <th style="width: 15%; text-align: center;">Design Qty</th>
              <th style="width: 15%; text-align: center;">Required Weight</th>
            </tr>
            {{/isRFQ}}
            {{^isRFQ}}
            <tr>
              <th style="width: 5%; text-align: center;">Sr. No</th>
              <th style="width: 20%">Drawing No</th>
              <th style="width: 24%">Description / Material Name</th>
              <th style="width: 12%">Item Size</th>
              <th style="width: 8%; text-align: center;">Design Qty</th>
              <th style="width: 9%; text-align: center;">Required Weight</th>
              <th style="width: 8%; text-align: right;">Unit Rate (₹)</th>
              <th style="width: 5%; text-align: center;">GST</th>
              <th style="width: 9%; text-align: right;">Total</th>
            </tr>
            {{/isRFQ}}
          </thead>
          <tbody>
            {{#items}}
            <tr>
              <td class="center-col">{{sr}}</td>
              {{#isRFQ}}
              <td style="font-family: monospace; font-weight: 500;">{{drawing_no}}</td>
              <td>
                <strong>{{material_name}}</strong>
                {{#material_description}}<br><span style="font-size: 8px; color: #64748b;">{{material_description}}</span>{{/material_description}}
              </td>
              <td class="center-col"><strong>{{design_qty_str}}</strong></td>
              <td class="center-col"><strong>{{required_weight_str}}</strong></td>
              {{/isRFQ}}
              {{^isRFQ}}
              <td style="font-family: monospace; font-weight: 500;">
                {{drawing_no}}
                {{#drawing_name}}<br><span style="font-family: sans-serif; font-size: 8px; font-weight: 700; color: #1e293b;">{{drawing_name}}</span>{{/drawing_name}}
              </td>
              <td><strong>{{material_name}}</strong></td>
              <td><strong>{{item_size}}</strong></td>
              <td class="center-col"><strong>{{design_qty_str}}</strong></td>
              <td class="center-col"><strong>{{required_weight_str}}</strong></td>
              <td class="amount-col">{{unit_rate}}</td>
              <td class="center-col">{{gst_percent}}</td>
              <td class="amount-col">{{amount}}</td>
              {{/isRFQ}}
            </tr>
            {{/items}}
          </tbody>
        </table>

        {{#isRFQ}}
        <div class="section-box">
          <div class="section-box-header">Remarks / Delivery Requirements</div>
          <div class="section-box-content">
            {{notes}}{{^notes}}Request for quotation created from the procurement requirements.{{/notes}}
          </div>
        </div>
        {{/isRFQ}}
        {{^isRFQ}}
        <div class="summary-block">
          <div class="remarks-container">
            <p style="margin: 0 0 5px 0; font-weight: 700; font-size: 10px;">Remarks:</p>
            <p style="margin: 0; color: #475569; font-size: 10px; line-height: 1.4;">{{notes}}{{^notes}}Request for quotation created from the procurement requirements.{{/notes}}</p>
          </div>
          <div>
            <table class="summary-table">
              <tr>
                <td class="summary-label">Sub Total (Before Tax)</td>
                <td class="summary-value">₹{{total_amount}}</td>
              </tr>
              <tr>
                <td class="summary-label" style="color: #2563eb;">Total Profit</td>
                <td class="summary-value" style="color: #2563eb;">₹0.00</td>
              </tr>
              <tr>
                <td class="summary-label">Tax (GST 18%)</td>
                <td class="summary-value">₹{{tax_amount}}</td>
              </tr>
              <tr class="grand-total-row">
                <td style="font-weight: 800; border: none;">Grand Total</td>
                <td class="grand-total-value" style="border: none;">₹{{grand_total}}</td>
              </tr>
            </table>
          </div>
        </div>
        {{/isRFQ}}

        <div class="section-box">
          <div class="section-box-header">Special Instructions & Notes</div>
          <div class="section-box-content">
            RFQ Ref: {{rfq_ref}}
          </div>
        </div>

        <div class="section-box">
          <div class="section-box-header">Declaration & Terms</div>
          <div class="section-box-content">
            {{invoiceFooterNotes}}{{^invoiceFooterNotes}}ASDFGHJHGFDS{{/invoiceFooterNotes}}
          </div>
        </div>

        <div class="footer">
          <div class="footer-left">This is a system generated document and does not require physical signature.</div>
          <div class="footer-right">{{hostCompanyName}} | Page 1 of 1</div>
        </div>
      </div>
    </body>
    </html>
  `;

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

  const isRFQVal = ['DRAFT', 'SENT', 'EMAIL_RECEIVED', 'PENDING'].includes(quotation.status);

  const viewData = {
    ...quotation,
    isRFQ: isRFQVal,
    created_at: formatDate(quotation.created_at),
    valid_until: formatDate(quotation.valid_until),
    vendor_name: vendor?.vendor_name || 'N/A',
    vendor_email: vendor?.email || 'N/A',
    location: vendor?.location || 'N/A',
    phone: vendor?.phone || 'N/A',
    vendor_gstin: vendor?.gstin || '22ABCDE1234F1Z5',
    project_name: quotation.project_name,
    project_ref: quotation.mr_id ? `MR: ${quotation.mr_number}` : (quotation.sales_order_id ? `SO: ${quotation.so_number || quotation.sales_order_id}` : 'General Requirement'),
    total_amount: parseFloat(quotation.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    tax_amount: parseFloat(quotation.tax_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    grand_total: parseFloat(quotation.grand_total || quotation.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    rfq_ref: quotation.rfq_group_id ? `RFQ-${quotation.rfq_group_id}` : `RFQ-${quotation.quote_number || '1780046352127'}`,
    items: (quotation.items || []).map((i, idx) => {
      const qty = parseFloat(i.quantity || 0);
      const rate = parseFloat(i.unit_rate || 0);
      const amt = parseFloat(i.amount || qty * rate);
      const cgst = parseFloat(i.cgst_percent || 0);
      const sgst = parseFloat(i.sgst_percent || 0);
      const totalGst = cgst + sgst;

      const len = parseFloat(i.length || 0);
      const wid = parseFloat(i.width || 0);
      const thk = parseFloat(i.thickness || 0);
      const dia = parseFloat(i.diameter || 0);
      const od = parseFloat(i.outer_diameter || 0);

      let dimsSpec = '';
      if (len > 0 || wid > 0 || thk > 0 || dia > 0 || od > 0) {
        let parts = [];
        if (dia > 0) parts.push(`Ø${dia.toFixed(0)}`);
        else if (od > 0) parts.push(`OD ${od.toFixed(0)}`);
        
        if (wid > 0) parts.push(wid.toFixed(0));
        if (thk > 0) parts.push(thk % 1 === 0 ? thk.toFixed(0) : thk.toFixed(1));
        if (len > 0) parts.push(len.toFixed(0));
        
        dimsSpec = parts.join(' × ') + ' mm';
      }
      
      let sizeParts = [];
      if (dia > 0) {
        sizeParts.push(`Ø${dia.toFixed(0)}`);
      } else if (od > 0) {
        sizeParts.push(`OD ${od.toFixed(0)}`);
      }
      
      let otherParts = [];
      if (wid > 0) otherParts.push(`${wid.toFixed(0)}`);
      if (thk > 0) {
        otherParts.push(thk % 1 === 0 ? thk.toFixed(0) : thk.toFixed(1));
      }
      if (len > 0) otherParts.push(`${len.toFixed(0)}`);
      
      if (otherParts.length > 0) {
        sizeParts.push(otherParts.join(' × '));
      }
      
      let itemSize = sizeParts.join(' × ');
      if (itemSize) {
        itemSize += ' mm';
      }

      const designQtyVal = parseFloat(i.planned_qty || i.design_qty || 0);
      const isRaw = (i.material_type === 'RAW_MATERIAL') || (i.item_code || '').startsWith('RM-');
      
      const design_qty_str = isRaw ? `${designQtyVal.toFixed(0)} Nos` : `${qty.toFixed(0)} ${i.unit || 'Nos'}`;
      const required_weight_str = isRaw ? `${qty.toFixed(3)} Kg` : '—';

      return {
        ...i,
        isRFQ: isRFQVal,
        sr: idx + 1,
        drawing_no: i.drawing_no || i.item_code || '—',
        drawing_name: (() => {
          let cleanDwgName = i.drawing_name || i.description || '';
          if (cleanDwgName === '—' || cleanDwgName.trim() === '') {
            return null;
          }
          return cleanDwgName;
        })(),
        item_size: itemSize || '—',
        material_name: i.material_name || i.description || '—',
        material_description: dimsSpec || null,
        specification: dimsSpec || '—',
        design_qty_str,
        required_weight_str,
        material_type: i.material_type || '—',
        quantity: qty.toFixed(3),
        unit: i.unit || 'NOS',
        gst_percent: totalGst > 0 ? `${totalGst}%` : '18%',
        unit_rate: rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        amount: amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      };
    }),
    hostCompanyName,
    hostCompanyAddress,
    hostGSTIN,
    hostPAN: activeCompany?.pan || '',
    hostBankName: activeCompany?.bank_name || '',
    hostAccountNumber: activeCompany?.account_number || '',
    hostIFSCCode: activeCompany?.ifsc_code || '',
    hostBranchName: activeCompany?.branch_name || '',
    hostEmail: activeCompany?.email || '',
    hostPhone: activeCompany?.phone || '',
    hostContactPerson: activeCompany?.contact_person || '',
    invoiceFooterNotes,
    logoBase64
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

const parseVendorQuotationPDF = async (filePath) => {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error('PDF file not found');
  }

  const dataBuffer = fs.readFileSync(absolutePath);

  // Use mehmet-kozan/pdf-parse (v2.4.5) style
  let pdf;
  try {
    pdf = new PDFParseClass(new Uint8Array(dataBuffer));
    await pdf.load();
  } catch (e) {
    console.error('[PDF Parse] Error loading PDF:', e.message);
    throw new Error('Could not load PDF structure: ' + e.message);
  }

  let text = '';
  try {
    const result = await pdf.getText();
    text = typeof result === 'string' ? result : (result?.text || '');
  } catch (e) {
    console.error('[PDF Parse] Error getting text:', e.message);
    throw new Error('Could not extract text from PDF: ' + e.message);
  }

  console.log('[PDF Parse] Extracted text length:', text.length);

  const items = [];
  const lines = text.split('\n');

  let tableStarted = false;
  let hasDrawingNoColumn = true;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Detect table start and column structure
    if (line.includes('Drawing No') || line.includes('Material Name') || (line.includes('Qty') && line.includes('Rate')) || line.includes('Material')) {
      tableStarted = true;
      if (line.includes('Material') && !line.includes('Drawing No')) {
        hasDrawingNoColumn = false;
      }
      continue;
    }

    if (tableStarted) {
      if (line.toLowerCase().includes('total value') || line.toLowerCase().includes('total amount') || line.toLowerCase().includes('subtotal')) {
        break;
      }

      // More robust numeric extraction: find all parts that look like numbers
      const numericParts = [];
      const parts = line.split(/\s+/);

      for (let i = parts.length - 1; i >= 0; i--) {
        const rawVal = parts[i].replace(/[^\d.,]/g, '');
        if (rawVal && !isNaN(parseFloat(rawVal.replace(/,/g, '')))) {
          numericParts.push({ val: rawVal.replace(/,/g, ''), index: i });
        }
        if (numericParts.length >= 3) break; // Qty, Rate, Amount
      }

      if (numericParts.length >= 2) {
        // Amount is usually the last one, Rate is second to last
        const amount = parseFloat(numericParts[0].val);
        const rate = parseFloat(numericParts[1].val);

        let qty = 0;
        let unit = '';

        if (numericParts.length >= 3) {
          qty = parseFloat(numericParts[2].val);
          const qtyIdx = numericParts[2].index;
          const rateIdx = numericParts[1].index;
          // Unit is usually between qty and rate
          if (rateIdx > qtyIdx + 1) {
            unit = parts.slice(qtyIdx + 1, rateIdx).join(' ');
          }
        }

        const firstNumericIdx = numericParts[numericParts.length - 1].index;
        let drawingNo = '—';
        let materialName = '';

        if (hasDrawingNoColumn && firstNumericIdx > 1) {
          drawingNo = parts[0];
          materialName = parts.slice(1, firstNumericIdx).join(' ');
        } else {
          materialName = parts.slice(0, firstNumericIdx).join(' ');
        }

        if (materialName) {
          items.push({
            drawing_no: drawingNo,
            material_name: materialName,
            quantity: qty,
            unit: unit,
            unit_rate: rate,
            amount: amount
          });
        }
        continue;
      }
    }
  }

  console.log(`[PDF Parse] Found ${items.length} items`);
  return items;
};

const approveComparedQuotations = async (data) => {
  const { quotationIds, awards } = data;

  if (!Array.isArray(quotationIds) || quotationIds.length === 0) {
    const error = new Error('Quotation IDs are required');
    error.statusCode = 400;
    throw error;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Reset is_selected = 0 for all items in the involved quotations
    await connection.query(
      'UPDATE quotation_items SET is_selected = 0 WHERE quotation_id IN (?)',
      [quotationIds]
    );

    // 2. Mark the awarded items as is_selected = 1
    if (Array.isArray(awards) && awards.length > 0) {
      for (const award of awards) {
        const { quotationId, itemCode } = award;
        if (!quotationId || !itemCode) continue;

        await connection.execute(
          `UPDATE quotation_items 
           SET is_selected = 1 
           WHERE quotation_id = ? AND (item_code = ? OR drawing_no = ?)`,
          [quotationId, itemCode, itemCode]
        );
      }
    }

    // 3. Update the parent quotations' statuses
    const approvedQuotationIds = [];

    for (const qId of quotationIds) {
      const [rows] = await connection.query(
        'SELECT COUNT(*) as count FROM quotation_items WHERE quotation_id = ? AND is_selected = 1',
        [qId]
      );
      const hasSelectedItems = rows[0].count > 0;

      if (hasSelectedItems) {
        await connection.execute(
          "UPDATE quotations SET status = 'REVIEWED' WHERE id = ?",
          [qId]
        );
        approvedQuotationIds.push(qId);
      } else {
        // Do not auto-reject non-awarded quotations, let them remain as is (e.g. RECEIVED)
        console.log(`Quotation ${qId} has no selected items, keeping status unchanged`);
      }
    }

    // 4. Create Purchase Orders for each approved quotation (vendor)
    const purchaseOrderService = require('./purchaseOrderService');
    const createdPOs = [];

    for (const qId of approvedQuotationIds) {
      const poResult = await purchaseOrderService.createPurchaseOrder({ quotationId: qId }, connection);
      createdPOs.push(poResult);
    }

    await connection.commit();
    return {
      approvedQuotationIds,
      createdPOs
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  createQuotation,
  getQuotations,
  getQuotationById,
  updateQuotationStatus,
  updateQuotation,
  deleteQuotation,
  getQuotationStats,
  sendQuotationEmail,
  generateQuotationPDF,
  parseVendorQuotationPDF,
  approveComparedQuotations
};
