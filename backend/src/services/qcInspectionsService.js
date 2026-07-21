const pool = require('../config/db');
const stockService = require('./stockService');
const emailService = require('./emailService');
const puppeteer = require('puppeteer');
const mustache = require('mustache');

/**
 * Helper to find the correct item_code from stock_balance by matching material name/type
 * if the provided item_code is missing or inconsistent.
 */
const getCorrectItemCode = async (item, connection) => {
  let itemCode = item.item_code || item.drawing_no;

  const length = item.length || 0;
  const width = item.width || 0;
  const thickness = item.thickness || 0;
  const diameter = item.diameter || 0;
  const outerDiameter = item.outer_diameter || item.outerDiameter || 0;

  // 0. If we already have a specific item code that exists in stock_balance and matches name + dimensions, use it!
  if (itemCode && itemCode !== 'auto-generated') {
    const [existing] = await connection.query(
      `SELECT item_code, material_type FROM stock_balance 
       WHERE (item_code = ? OR drawing_no = ?) 
         AND LOWER(TRIM(material_name)) = LOWER(TRIM(?))
         AND (ABS(COALESCE(length, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(width, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(thickness, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(diameter, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(outer_diameter, 0) - COALESCE(?, 0)) < 0.0001)
       LIMIT 1`,
      [itemCode, itemCode, item.material_name, length, width, thickness, diameter, outerDiameter]
    );
    if (existing.length > 0) {
      if (existing[0].material_type) {
        item.material_type = existing[0].material_type;
      }
      return existing[0].item_code;
    }
  }

  if (item.material_name) {
    // 1. Try matching by name, material type, and dimensions
    const [sb] = await connection.query(
      `SELECT item_code FROM stock_balance 
       WHERE LOWER(TRIM(material_name)) = LOWER(TRIM(?)) 
         AND (material_type = ? OR UPPER(REPLACE(material_type, ' ', '_')) = UPPER(REPLACE(?, ' ', '_')))
         AND (ABS(COALESCE(length, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(width, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(thickness, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(diameter, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(outer_diameter, 0) - COALESCE(?, 0)) < 0.0001)
       LIMIT 1`,
      [item.material_name, item.material_type, item.material_type, length, width, thickness, diameter, outerDiameter]
    );

    if (sb.length > 0) {
      return sb[0].item_code;
    }

    // 2. Try matching by name and dimensions only (more flexible type match)
    const [sbNameDims] = await connection.query(
      `SELECT item_code FROM stock_balance 
       WHERE LOWER(TRIM(material_name)) = LOWER(TRIM(?)) 
         AND (ABS(COALESCE(length, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(width, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(thickness, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(diameter, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(outer_diameter, 0) - COALESCE(?, 0)) < 0.0001)
       LIMIT 1`,
      [item.material_name, length, width, thickness, diameter, outerDiameter]
    );

    if (sbNameDims.length > 0) {
      return sbNameDims[0].item_code;
    }
  }

  // 3. Fallback: If we have an item code, check if it exists in stock_balance with different dimensions.
  // If it does, we ignore it (isMismatch = true) so we generate a new unique code.
  // If it doesn't exist, or has empty dimensions, or matches, we reuse it.
  let isMismatch = false;
  if (itemCode && itemCode !== 'auto-generated') {
    const [existing] = await connection.query(
      `SELECT item_code, length, width, thickness, diameter, outer_diameter FROM stock_balance 
       WHERE item_code = ? LIMIT 1`,
      [itemCode]
    );
    if (existing.length > 0) {
      const ext = existing[0];
      const hasDimensions = (parseFloat(ext.length || 0) > 0 || parseFloat(ext.width || 0) > 0 || parseFloat(ext.thickness || 0) > 0 || parseFloat(ext.diameter || 0) > 0 || parseFloat(ext.outer_diameter || 0) > 0);
      const incomingHasDimensions = (length > 0 || width > 0 || thickness > 0 || diameter > 0 || outerDiameter > 0);
      
      if (incomingHasDimensions && (!hasDimensions || itemCode.startsWith('RM-'))) {
        isMismatch = true;
      } else if (hasDimensions) {
        const lengthDiff = Math.abs(parseFloat(ext.length || 0) - length) >= 0.0001;
        const widthDiff = Math.abs(parseFloat(ext.width || 0) - width) >= 0.0001;
        const thicknessDiff = Math.abs(parseFloat(ext.thickness || 0) - thickness) >= 0.0001;
        const diameterDiff = Math.abs(parseFloat(ext.diameter || 0) - diameter) >= 0.0001;
        const outerDiameterDiff = Math.abs(parseFloat(ext.outer_diameter || 0) - outerDiameter) >= 0.0001;
        
        if (lengthDiff || widthDiff || thicknessDiff || diameterDiff || outerDiameterDiff) {
          isMismatch = true;
        }
      }
    }
  }

  if (itemCode && itemCode !== 'auto-generated' && !isMismatch) {
    return itemCode;
  }

  // 4. Fallback: Generate a standard item code and create a new master record in stock_balance
  if (item.material_name) {
    const generatedCode = await stockService.generateItemCode(item.material_name, item.material_type);
    
    // Create new blank record in stock_balance for the new item so future lookups match it
    const normalizedType = (item.material_type || '').toUpperCase().trim().replace(/ /g, '_');
    await connection.execute(
      `INSERT INTO stock_balance (
        item_code, material_name, material_type, unit, current_balance, valuation_rate,
        length, width, thickness, diameter, outer_diameter, density, weight_per_unit, shape_id, material_id
      ) VALUES (?, ?, ?, ?, 0.000, 0.00, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generatedCode,
        item.material_name,
        normalizedType,
        item.unit || 'NOS',
        item.length || null,
        item.width || null,
        item.thickness || null,
        item.diameter || null,
        item.outer_diameter || null,
        item.density || null,
        item.weight_per_unit || null,
        item.shape_id || null,
        item.material_id || null
      ]
    );
    return generatedCode;
  }

  return null;
};

const getQCWithDetails = async (qcId) => {
  const [qcs] = await pool.query(
    `SELECT 
      qc.id,
      qc.grn_id,
      qc.inspection_date,
      qc.pass_quantity,
      qc.fail_quantity,
      qc.status,
      qc.defects,
      qc.remarks,
      qc.invoice_url,
      qc.created_at,
      qc.updated_at,
      (SELECT id FROM stock_entries WHERE grn_id = qc.grn_id LIMIT 1) AS stock_entry_id,
      (SELECT entry_no FROM stock_entries WHERE grn_id = qc.grn_id LIMIT 1) AS stock_entry_no,
      g.po_number,
      po.id AS po_id,
      po.vendor_id,
      v.vendor_name AS vendor_name,
      v.email AS vendor_email,
      COALESCE(
        (SELECT so.project_name FROM sales_orders so WHERE so.id = po.sales_order_id AND so.is_sales_order = 1),
        (SELECT o.project_name FROM orders o WHERE o.id = po.sales_order_id AND o.source_type = 'DIRECT'),
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
        (SELECT c.company_name FROM companies c JOIN sales_orders so ON c.id = so.company_id WHERE so.id = po.sales_order_id),
        (SELECT c.company_name FROM companies c JOIN orders o ON c.id = o.client_id WHERE o.id = po.sales_order_id AND o.source_type = 'DIRECT'),
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
      ) as company_name,
      COALESCE(
        (SELECT pr.host_company_id FROM po_receipts pr WHERE pr.id = g.po_receipt_id LIMIT 1),
        (SELECT q.host_company_id FROM purchase_orders po_inner JOIN quotations q ON po_inner.quotation_id = q.id WHERE po_inner.po_number = g.po_number LIMIT 1)
      ) as host_company_id,
      (SELECT cm.company_name FROM company_master cm WHERE cm.id = 
        COALESCE(
          (SELECT pr.host_company_id FROM po_receipts pr WHERE pr.id = g.po_receipt_id LIMIT 1),
          (SELECT q.host_company_id FROM purchase_orders po_inner JOIN quotations q ON po_inner.quotation_id = q.id WHERE po_inner.po_number = g.po_number LIMIT 1)
        ) LIMIT 1
      ) as host_company_name
    FROM qc_inspections qc
    LEFT JOIN grns g ON qc.grn_id = g.id
    LEFT JOIN purchase_orders po ON g.po_number = po.po_number
    LEFT JOIN vendors v ON po.vendor_id = v.id
    WHERE qc.id = ?`,
    [qcId]
  );

  if (qcs.length > 0) {
    const qc = qcs[0];

    const [qcItems] = await pool.query(
      `SELECT 
        qci.id,
        qci.item_code, 
        qci.po_qty, 
        qci.received_qty,
        qci.accepted_qty, 
        qci.rejected_qty, 
        qci.status,
        grn.po_number as po_number,
        COALESCE(poi.material_name, pri.material_name) as material_name,
        COALESCE(poi.description, pri.material_name, pri.item_code) as description,
        poi.unit_rate,
        COALESCE(poi.planned_qty, pri.po_qty, qci.po_qty, 0) as planned_qty,
        COALESCE(poi.design_qty, pri.po_qty, qci.po_qty, 0) as design_qty,
        poi.quantity,
        COALESCE(poi.drawing_no, pri.drawing_no) as drawing_no,
        COALESCE(NULLIF(qci.item_code,''), poi.item_code, pri.item_code) as item_code,
        COALESCE(poi.uom, poi.unit, pri.unit) as uom,
        CASE WHEN gi.length > 0 THEN gi.length ELSE COALESCE(poi.length, 0) END as length,
        CASE WHEN gi.width > 0 THEN gi.width ELSE COALESCE(poi.width, 0) END as width,
        CASE WHEN gi.thickness > 0 THEN gi.thickness ELSE COALESCE(poi.thickness, 0) END as thickness,
        CASE WHEN gi.diameter > 0 THEN gi.diameter ELSE COALESCE(poi.diameter, 0) END as diameter,
        CASE WHEN gi.outer_diameter > 0 THEN gi.outer_diameter ELSE COALESCE(poi.outer_diameter, 0) END as outer_diameter,
        CASE WHEN gi.density > 0 THEN gi.density ELSE COALESCE(poi.density, 0) END as density,
        CASE WHEN gi.weight_per_unit > 0 THEN gi.weight_per_unit ELSE COALESCE(poi.weight_per_unit, 0) END as weight_per_unit,
        w.warehouse_name
       FROM qc_inspection_items qci
       LEFT JOIN grn_items gi ON qci.grn_item_id = gi.id
       LEFT JOIN grns grn ON gi.grn_id = grn.id
       LEFT JOIN purchase_order_items poi ON gi.po_item_id = poi.id
       LEFT JOIN po_receipt_items pri ON pri.receipt_id = grn.po_receipt_id
         AND (pri.po_item_id = gi.po_item_id OR (gi.po_item_id IS NULL AND pri.po_item_id IS NULL))
       LEFT JOIN warehouses w ON qci.warehouse_id = w.id
       WHERE qci.qc_inspection_id = ?`,
      [qcId]
    );


    const orderedQty = qcItems.reduce((sum, item) => sum + (parseFloat(item.po_qty) || 0), 0);
    const acceptedQty = qcItems.reduce((sum, item) => sum + (parseFloat(item.accepted_qty) || 0), 0);

    qc.shortage = orderedQty > acceptedQty ? orderedQty - acceptedQty : 0;
    qc.overage = acceptedQty > orderedQty ? acceptedQty - orderedQty : 0;
    qc.items = qcItems.length;
    qc.accepted_quantity = acceptedQty;

    qc.items_detail = qcItems.map(item => ({
      id: item.id,
      item_code: item.item_code,
      po_number: item.po_number,
      status: item.status,
      material_name: item.material_name,
      description: item.description,
      drawing_no: item.drawing_no || null,
      uom: item.uom,
      length: item.length,
      width: item.width,
      thickness: item.thickness,
      diameter: item.diameter,
      outer_diameter: item.outer_diameter,
      density: item.density,
      weight_per_unit: item.weight_per_unit,
      rate: parseFloat(item.unit_rate) || 0,
      design_qty: parseFloat(item.planned_qty || item.design_qty || 0),
      planned_qty: parseFloat(item.planned_qty || 0),
      warehouse_name: item.warehouse_name,
      ordered_qty: parseFloat(item.quantity || item.po_qty) || 0,
      received_qty: parseFloat(item.received_qty) || 0,
      accepted_qty: parseFloat(item.accepted_qty) || 0,
      rejected_qty: parseFloat(item.rejected_qty) || 0,
      shortage: Math.max(0, (parseFloat(item.po_qty) || 0) - (parseFloat(item.accepted_qty) || 0)),
      overage: Math.max(0, (parseFloat(item.accepted_qty) || 0) - (parseFloat(item.po_qty) || 0))
    }));
  }

  return qcs[0] || null;
};

const getAllQCs = async () => {
  const [qcs] = await pool.query(
    `SELECT 
      qc.id,
      qc.grn_id,
      qc.inspection_date,
      qc.pass_quantity,
      qc.fail_quantity,
      qc.status,
      qc.defects,
      qc.remarks,
      qc.invoice_url,
      qc.created_at,
      qc.updated_at,
      (SELECT id FROM stock_entries WHERE grn_id = qc.grn_id LIMIT 1) AS stock_entry_id,
      (SELECT entry_no FROM stock_entries WHERE grn_id = qc.grn_id LIMIT 1) AS stock_entry_no,
      g.po_number,
      (
        SELECT GROUP_CONCAT(DISTINCT 
          COALESCE(
            -- 1. Drawing from production plan linked to the item's mr_id
            (
              SELECT COALESCE(soi_inner.drawing_no, oi_inner.drawing_no, ppi_inner.item_code)
              FROM material_requests mr_inner 
              JOIN production_plans pp_inner ON mr_inner.plan_id = pp_inner.id
              LEFT JOIN production_plan_items ppi_inner ON pp_inner.id = ppi_inner.plan_id
              LEFT JOIN sales_order_items soi_inner ON ppi_inner.sales_order_item_id = soi_inner.id
              LEFT JOIN order_items oi_inner ON ppi_inner.sales_order_item_id = oi_inner.id AND pp_inner.sales_order_id = oi_inner.order_id
              WHERE mr_inner.id = poi_d.mr_id
              LIMIT 1
            ),
            -- 2. BOM No from production plan linked to the item's mr_id
            (
              SELECT pp_inner.bom_no 
              FROM material_requests mr_inner 
              JOIN production_plans pp_inner ON mr_inner.plan_id = pp_inner.id 
              WHERE mr_inner.id = poi_d.mr_id 
              LIMIT 1
            ),
            -- 3. Drawing from sales order linked to the item
            (
              SELECT soi_inner.drawing_no 
              FROM sales_order_items soi_inner 
              WHERE soi_inner.sales_order_id = poi_d.sales_order_id 
              LIMIT 1
            ),
            -- 4. Drawing No directly on the PO item
            IF(poi_d.drawing_no IS NOT NULL AND poi_d.drawing_no != '' AND poi_d.drawing_no != poi_d.item_code, poi_d.drawing_no, NULL),
            -- 5. Item Code directly on the PO item
            poi_d.item_code
          )
          ORDER BY poi_d.id SEPARATOR ', '
        )
        FROM grn_items gi_d
        JOIN purchase_order_items poi_d ON gi_d.po_item_id = poi_d.id
        WHERE gi_d.grn_id = qc.grn_id
      ) as drawing_no,
      COALESCE(
        (
          SELECT ppi_inner.description 
          FROM material_requests mr_inner 
          JOIN production_plans pp_inner ON mr_inner.plan_id = pp_inner.id 
          JOIN production_plan_items ppi_inner ON pp_inner.id = ppi_inner.plan_id 
          WHERE mr_inner.id = po.mr_id 
          LIMIT 1
        ),
        (
          SELECT soi_inner.description 
          FROM sales_order_items soi_inner 
          WHERE soi_inner.sales_order_id = po.sales_order_id 
          LIMIT 1
        )
      ) as finished_good,
      po.vendor_id,
      v.vendor_name AS vendor_name,
      v.email AS vendor_email,
      COALESCE(
        (SELECT so.project_name FROM sales_orders so WHERE so.id = po.sales_order_id AND so.is_sales_order = 1),
        (SELECT o.project_name FROM orders o WHERE o.id = po.sales_order_id AND o.source_type = 'DIRECT'),
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
        (SELECT c.company_name FROM companies c JOIN sales_orders so ON c.id = so.company_id WHERE so.id = po.sales_order_id),
        (SELECT c.company_name FROM companies c JOIN orders o ON c.id = o.client_id WHERE o.id = po.sales_order_id AND o.source_type = 'DIRECT'),
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
      ) as company_name,
      COALESCE(
        (SELECT pr.host_company_id FROM po_receipts pr WHERE pr.id = g.po_receipt_id LIMIT 1),
        (SELECT q.host_company_id FROM purchase_orders po_inner JOIN quotations q ON po_inner.quotation_id = q.id WHERE po_inner.po_number = g.po_number LIMIT 1)
      ) as host_company_id,
      (SELECT cm.company_name FROM company_master cm WHERE cm.id = 
        COALESCE(
          (SELECT pr.host_company_id FROM po_receipts pr WHERE pr.id = g.po_receipt_id LIMIT 1),
          (SELECT q.host_company_id FROM purchase_orders po_inner JOIN quotations q ON po_inner.quotation_id = q.id WHERE po_inner.po_number = g.po_number LIMIT 1)
        ) LIMIT 1
      ) as host_company_name
    FROM qc_inspections qc
    LEFT JOIN grns g ON qc.grn_id = g.id
    LEFT JOIN purchase_orders po ON g.po_number = po.po_number
    LEFT JOIN vendors v ON po.vendor_id = v.id
    ORDER BY qc.created_at DESC`
  );

  const result = [];
  for (const qc of qcs) {
    const [qcItems] = await pool.query(
      `SELECT 
        qci.id,
        qci.item_code, 
        qci.po_qty, 
        qci.received_qty, 
        qci.accepted_qty, 
        qci.rejected_qty, 
        qci.status,
        COALESCE(poi.material_name, pri.material_name) as material_name,
        COALESCE(poi.description, pri.material_name, pri.item_code) as description,
        poi.unit_rate,
        COALESCE(poi.planned_qty, pri.po_qty, qci.po_qty, 0) as planned_qty,
        COALESCE(poi.design_qty, pri.po_qty, qci.po_qty, 0) as design_qty,
        poi.quantity,
        COALESCE(poi.drawing_no, pri.drawing_no) as drawing_no,
        COALESCE(NULLIF(qci.item_code,''), poi.item_code, pri.item_code) as item_code,
        COALESCE(poi.uom, poi.unit, pri.unit) as uom,
        CASE WHEN gi.length > 0 THEN gi.length ELSE COALESCE(poi.length, 0) END as length,
        CASE WHEN gi.width > 0 THEN gi.width ELSE COALESCE(poi.width, 0) END as width,
        CASE WHEN gi.thickness > 0 THEN gi.thickness ELSE COALESCE(poi.thickness, 0) END as thickness,
        CASE WHEN gi.diameter > 0 THEN gi.diameter ELSE COALESCE(poi.diameter, 0) END as diameter,
        CASE WHEN gi.outer_diameter > 0 THEN gi.outer_diameter ELSE COALESCE(poi.outer_diameter, 0) END as outer_diameter,
        CASE WHEN gi.density > 0 THEN gi.density ELSE COALESCE(poi.density, 0) END as density,
        CASE WHEN gi.weight_per_unit > 0 THEN gi.weight_per_unit ELSE COALESCE(poi.weight_per_unit, 0) END as weight_per_unit,
        w.warehouse_name
       FROM qc_inspection_items qci 
       LEFT JOIN grn_items gi ON qci.grn_item_id = gi.id
       LEFT JOIN grns grn ON gi.grn_id = grn.id
       LEFT JOIN purchase_order_items poi ON gi.po_item_id = poi.id
       LEFT JOIN po_receipt_items pri ON pri.receipt_id = grn.po_receipt_id
         AND (pri.po_item_id = gi.po_item_id OR (gi.po_item_id IS NULL AND pri.po_item_id IS NULL))
       LEFT JOIN warehouses w ON qci.warehouse_id = w.id
       WHERE qci.qc_inspection_id = ?`,
      [qc.id]
    );


    const orderedQty = qcItems.reduce((sum, item) => sum + (parseFloat(item.po_qty) || 0), 0);
    const acceptedQty = qcItems.reduce((sum, item) => sum + (parseFloat(item.accepted_qty) || 0), 0);

    result.push({
      ...qc,
      shortage: orderedQty > acceptedQty ? orderedQty - acceptedQty : 0,
      overage: acceptedQty > orderedQty ? acceptedQty - orderedQty : 0,
      items: qcItems.length,
      accepted_quantity: acceptedQty,
      items_detail: qcItems.map(item => ({
        id: item.id,
        item_code: item.item_code,
        material_name: item.material_name,
        description: item.description,
        drawing_no: item.drawing_no || null,
        uom: item.uom,
        length: item.length,
        width: item.width,
        thickness: item.thickness,
        diameter: item.diameter,
        outer_diameter: item.outer_diameter,
        density: item.density,
        weight_per_unit: item.weight_per_unit,
        rate: parseFloat(item.unit_rate) || 0,
        design_qty: parseFloat(item.planned_qty || item.design_qty || 0),
        planned_qty: parseFloat(item.planned_qty || 0),
        warehouse_name: item.warehouse_name,
        ordered_qty: parseFloat(item.quantity || item.po_qty) || 0,
        received_qty: parseFloat(item.received_qty) || 0,
        accepted_qty: parseFloat(item.accepted_qty) || 0,
        rejected_qty: parseFloat(item.rejected_qty) || 0,
        shortage: Math.max(0, (parseFloat(item.po_qty) || 0) - (parseFloat(item.accepted_qty) || 0)),
        overage: Math.max(0, (parseFloat(item.accepted_qty) || 0) - (parseFloat(item.po_qty) || 0)),
        status: item.status
      }))
    });
  }

  return result;
};

const createQC = async (grnId, inspectionDate, passQuantity, failQuantity, defects, remarks, providedConnection = null) => {
  if (!grnId) {
    const error = new Error('GRN ID is required');
    error.statusCode = 400;
    throw error;
  }

  const connection = providedConnection || await pool.getConnection();
  const shouldRelease = !providedConnection;
  const shouldCommit = !providedConnection;

  try {
    if (shouldCommit) await connection.beginTransaction();

    const [grn] = await connection.query(
      'SELECT id FROM grns WHERE id = ?',
      [grnId]
    );

    if (!grn.length) {
      throw new Error('GRN not found');
    }

    const passQty = passQuantity ?? 0;

    const [result] = await connection.execute(
      `INSERT INTO qc_inspections (grn_id, inspection_date, pass_quantity, fail_quantity, status, defects, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [grnId, inspectionDate, passQty, failQuantity || 0, 'PENDING', defects || null, remarks || null]
    );

    const qcId = result.insertId;

    const [grnItems] = await connection.query(
      `SELECT 
        gi.id, 
        poi.item_code, 
        poi.material_name,
        poi.material_type,
        gi.po_qty, 
        gi.received_qty, 
        gi.accepted_qty, 
        gi.rejected_qty, 
        gi.status,
        gi.warehouse_id,
        COALESCE(poi.unit, gi.uom, 'NOS') as unit,
        gi.length,
        gi.width,
        gi.thickness,
        gi.diameter,
        gi.outer_diameter,
        gi.density,
        gi.weight_per_unit
       FROM grn_items gi
       LEFT JOIN purchase_order_items poi ON gi.po_item_id = poi.id
       WHERE gi.grn_id = ?`,
      [grnId]
    );

    for (const item of grnItems) {
      const correctedItemCode = await getCorrectItemCode(item, connection);

      await connection.execute(
        `INSERT INTO qc_inspection_items 
         (qc_inspection_id, grn_item_id, warehouse_id, item_code, po_qty, received_qty, accepted_qty, rejected_qty, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [qcId, item.id, item.warehouse_id, correctedItemCode, item.po_qty, item.received_qty, item.accepted_qty, item.rejected_qty, 'PENDING']
      );
    }

    if (shouldCommit) await connection.commit();
    return qcId; // Returning ID instead of full details to avoid complex getQCWithDetails with connection
  } catch (error) {
    if (shouldCommit) await connection.rollback();
    throw error;
  } finally {
    if (shouldRelease) connection.release();
  }
};

const updateQC = async (qcId, updates) => {
  const { inspectionDate, passQuantity, failQuantity, status, defects, remarks, items } = updates;

  const setClause = [];
  const values = [];

  if (inspectionDate !== undefined) {
    setClause.push('inspection_date = ?');
    values.push(inspectionDate);
  }

  if (passQuantity !== undefined) {
    setClause.push('pass_quantity = ?');
    values.push(passQuantity);
  }

  if (failQuantity !== undefined) {
    setClause.push('fail_quantity = ?');
    values.push(failQuantity);
  }

  if (status !== undefined) {
    setClause.push('status = ?');
    values.push(status);
  }

  if (defects !== undefined) {
    setClause.push('defects = ?');
    values.push(defects);
  }

  if (remarks !== undefined) {
    setClause.push('remarks = ?');
    values.push(remarks);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    if (setClause.length > 0) {
      values.push(qcId);

      await connection.execute(
        `UPDATE qc_inspections SET ${setClause.join(', ')} WHERE id = ?`,
        values
      );
    }

    // Update items if provided
    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (item.id) {
          await connection.execute(
            `UPDATE qc_inspection_items 
             SET accepted_qty = ?, rejected_qty = ?, status = ?, remarks = ? 
             WHERE id = ?`,
            [
              item.accepted_qty || 0,
              item.rejected_qty || 0,
              item.status || status || 'PENDING',
              item.remarks || null,
              item.id
            ]
          );

          // Also update grn_items
          const [qcItem] = await connection.query(
            'SELECT grn_item_id FROM qc_inspection_items WHERE id = ?',
            [item.id]
          );

          if (qcItem.length) {
            await connection.execute(
              'UPDATE grn_items SET accepted_qty = ?, rejected_qty = ?, status = ? WHERE id = ?',
              [
                item.accepted_qty || 0,
                item.rejected_qty || 0,
                item.status || status || 'PENDING',
                qcItem[0].grn_item_id
              ]
            );
          }
        }
      }
    }

    const [qcData] = await connection.query(
      'SELECT grn_id, pass_quantity, status FROM qc_inspections WHERE id = ?',
      [qcId]
    );

    const currentStatus = status !== undefined ? status : (qcData.length > 0 ? qcData[0].status : null);

    if (qcData.length) {
      const grnId = qcData[0].grn_id;

      const [grnItems] = await connection.query(
        'SELECT id, accepted_qty FROM grn_items WHERE grn_id = ?',
        [grnId]
      );

      const totalAcceptedQty = grnItems.reduce((sum, item) => sum + (parseFloat(item.accepted_qty) || 0), 0);

      let grnStatus = 'PENDING';
      if (currentStatus === 'PASSED' || currentStatus === 'ACCEPTED') {
        grnStatus = 'APPROVED';
      } else if (currentStatus === 'FAILED') {
        grnStatus = 'REJECTED';
      } else if (currentStatus === 'SHORTAGE') {
        grnStatus = 'INSPECTED';
      } else if (currentStatus === 'IN_PROGRESS') {
        grnStatus = 'INSPECTED';
      } else if (currentStatus === 'PENDING') {
        grnStatus = 'PENDING';
      }

      await connection.execute(
        'UPDATE grns SET received_quantity = ?, status = ? WHERE id = ?',
        [totalAcceptedQty, grnStatus, grnId]
      );
      if (currentStatus === 'PASSED' || currentStatus === 'ACCEPTED') {
        for (const item of grnItems) {
          await connection.execute(
            'UPDATE grn_items SET status = ? WHERE id = ?',
            ['APPROVED', item.id]
          );
        }
      } else if (currentStatus === 'FAILED' || currentStatus === 'REJECTED') {
        for (const item of grnItems) {
          await connection.execute(
            'UPDATE grn_items SET status = ? WHERE id = ?',
            ['REJECTED', item.id]
          );
        }
      }
    } else {
      const error = new Error('QC Inspection not found');
      error.statusCode = 404;
      throw error;
    }

    if (currentStatus === 'ACCEPTED' || currentStatus === 'SHORTAGE' || currentStatus === 'PASSED') {
      const [linked] = await connection.query(
        `SELECT po.sales_order_id, po.id as po_id
         FROM qc_inspections qc
         LEFT JOIN grns g ON qc.grn_id = g.id
         LEFT JOIN purchase_orders po ON g.po_number = po.po_number
         WHERE qc.id = ?
         LIMIT 1`,
        [qcId]
      );

      if (linked.length) {
        if (linked[0].sales_order_id) {
          await connection.execute(
            'UPDATE sales_orders SET status = ?, material_available = 1 WHERE id = ?',
            ['MATERIAL_READY', linked[0].sales_order_id]
          );
        }

        // Update PO status to FULFILLED when QC passes
        if (linked[0].po_id && (currentStatus === 'ACCEPTED' || currentStatus === 'PASSED')) {
          await connection.execute(
            'UPDATE purchase_orders SET status = ? WHERE id = ?',
            ['FULFILLED', linked[0].po_id]
          );
        }
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getQCWithDetails(qcId);
};

const updateQCItem = async (qcItemId, updates) => {
  const { acceptedQty, rejectedQty, status, remarks } = updates;

  const setClause = [];
  const values = [];

  if (acceptedQty !== undefined) {
    setClause.push('accepted_qty = ?');
    values.push(acceptedQty);
  }

  if (rejectedQty !== undefined) {
    setClause.push('rejected_qty = ?');
    values.push(rejectedQty);
  }

  if (status !== undefined) {
    setClause.push('status = ?');
    values.push(status);
  }

  if (remarks !== undefined) {
    setClause.push('remarks = ?');
    values.push(remarks);
  }

  if (setClause.length === 0) {
    return null;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    values.push(qcItemId);

    await connection.execute(
      `UPDATE qc_inspection_items SET ${setClause.join(', ')} WHERE id = ?`,
      values
    );

    const [qcItem] = await connection.query(
      'SELECT grn_item_id, accepted_qty, rejected_qty, status FROM qc_inspection_items WHERE id = ?',
      [qcItemId]
    );

    if (qcItem.length) {
      const grnItemId = qcItem[0].grn_item_id;
      const finalAcceptedQty = acceptedQty !== undefined ? acceptedQty : qcItem[0].accepted_qty;
      const finalRejectedQty = rejectedQty !== undefined ? rejectedQty : qcItem[0].rejected_qty;
      const finalStatus = status || qcItem[0].status;

      await connection.execute(
        'UPDATE grn_items SET accepted_qty = ?, rejected_qty = ?, status = ? WHERE id = ?',
        [finalAcceptedQty, finalRejectedQty, finalStatus, grnItemId]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const [updated] = await pool.query(
    'SELECT * FROM qc_inspection_items WHERE id = ?',
    [qcItemId]
  );

  return updated.length ? updated[0] : null;
};

const getQCItems = async (qcId) => {
  const [items] = await pool.query(
    `SELECT 
      qci.id,
      qci.qc_inspection_id,
      qci.grn_item_id,
      qci.item_code,
      qci.po_qty,
      qci.received_qty,
      qci.accepted_qty,
      qci.rejected_qty,
      qci.status,
      qci.remarks,
      qci.created_at,
      qci.updated_at,
      poi.material_name,
      poi.description,
      w.warehouse_name
    FROM qc_inspection_items qci
    LEFT JOIN grn_items gi ON qci.grn_item_id = gi.id
    LEFT JOIN purchase_order_items poi ON gi.po_item_id = poi.id
    LEFT JOIN warehouses w ON qci.warehouse_id = w.id
    WHERE qci.qc_inspection_id = ?
    ORDER BY qci.created_at ASC`,
    [qcId]
  );

  return items;
};

const deleteQC = async (qcId) => {
  const [result] = await pool.execute(
    'DELETE FROM qc_inspections WHERE id = ?',
    [qcId]
  );

  if (result.affectedRows === 0) {
    const error = new Error('QC Inspection not found');
    error.statusCode = 404;
    throw error;
  }

  return { success: true };
};

const getQCStats = async (filters = {}) => {
  const { start, end, supplier } = filters;
  let dateFilter = '';
  let params = [];
  if (start && end) {
    dateFilter = ' AND DATE(date) BETWEEN ? AND ?';
    params = [start, end, start, end];
  }

  const [[stats]] = await pool.query(
    `SELECT
      COUNT(*) as totalQc,
      SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as passedQc,
      SUM(CASE WHEN failed = 1 THEN 1 ELSE 0 END) as failedQc
    FROM (
      SELECT inspection_date as date, 
             CASE WHEN UPPER(TRIM(status)) IN ('PASSED', 'ACCEPTED', 'QC_APPROVED', 'COMPLETED') THEN 1 ELSE 0 END as passed,
             CASE WHEN UPPER(TRIM(status)) IN ('FAILED', 'REJECTED', 'QC_REJECTED') THEN 1 ELSE 0 END as failed
      FROM qc_inspections
      UNION ALL
      SELECT check_date as date,
             CASE WHEN rejected_qty = 0 THEN 1 ELSE 0 END as passed,
             CASE WHEN rejected_qty > 0 THEN 1 ELSE 0 END as failed
      FROM job_card_quality_logs
    ) combined_stats
    WHERE 1=1 ${dateFilter}`,
    params
  );

  return stats || {
    totalQc: 0,
    passedQc: 0,
    failedQc: 0
  };
};

const getQCReports = async (filters = {}) => {
  // 1. KPI Stats
  const stats = await getQCStats(filters);

  // Calculate Pass Rate and Rejection Rate
  const totalCompleted = (stats.passedQc || 0) + (stats.failedQc || 0);
  const passRate = totalCompleted > 0 ? Math.round((stats.passedQc / totalCompleted) * 100) : 0;
  const rejectionRate = totalCompleted > 0 ? Math.round((stats.failedQc / totalCompleted) * 100) : 0;
  const qualityScore = passRate; // Simplified for now
  const defectScore = rejectionRate; // Simplified for now

  const { start, end, supplier } = filters;
  let dateFilter = '';
  let params = [];
  if (start && end) {
    dateFilter = ' AND DATE(date) BETWEEN ? AND ?';
    params = [start, end, start, end];
  }

  // 2. Monthly Trend (Last 6 months)
  const [monthlyTrend] = await pool.query(`
    SELECT 
      DATE_FORMAT(month_list.month, '%b') as month,
      COALESCE(SUM(passed), 0) as passed,
      COALESCE(SUM(failed), 0) as failed
    FROM (
      SELECT CURRENT_DATE - INTERVAL 5 MONTH as month UNION ALL
      SELECT CURRENT_DATE - INTERVAL 4 MONTH UNION ALL
      SELECT CURRENT_DATE - INTERVAL 3 MONTH UNION ALL
      SELECT CURRENT_DATE - INTERVAL 2 MONTH UNION ALL
      SELECT CURRENT_DATE - INTERVAL 1 MONTH UNION ALL
      SELECT CURRENT_DATE
    ) month_list
    LEFT JOIN (
      SELECT inspection_date as date, 
             CASE WHEN UPPER(TRIM(status)) IN ('PASSED', 'ACCEPTED', 'QC_APPROVED', 'COMPLETED') THEN 1 ELSE 0 END as passed,
             CASE WHEN UPPER(TRIM(status)) IN ('FAILED', 'REJECTED', 'QC_REJECTED') THEN 1 ELSE 0 END as failed
      FROM qc_inspections
      UNION ALL
      SELECT check_date as date,
             CASE WHEN rejected_qty = 0 THEN 1 ELSE 0 END as passed,
             CASE WHEN rejected_qty > 0 THEN 1 ELSE 0 END as failed
      FROM job_card_quality_logs
    ) combined_qc ON DATE_FORMAT(combined_qc.date, '%Y-%m') = DATE_FORMAT(month_list.month, '%Y-%m')
    GROUP BY month_list.month
    ORDER BY month_list.month ASC
  `);

  let supplierFilter = '';
  let supplierParams = [];
  if (supplier && supplier !== 'All') {
    supplierFilter = ' AND v.vendor_name = ?';
    supplierParams = [supplier];
  }

  // 3. Defect Category Breakdown
  const [defectData] = await pool.query(`
    SELECT name, SUM(val) as count FROM (
      SELECT rejection_reason as name, COUNT(*) as val
      FROM job_card_quality_logs
      WHERE rejected_qty > 0 AND rejection_reason IS NOT NULL AND rejection_reason != ''
      GROUP BY rejection_reason
      UNION ALL
      SELECT defects as name, COUNT(*) as val
      FROM qc_inspections
      WHERE UPPER(TRIM(status)) IN ('FAILED', 'REJECTED', 'QC_REJECTED') AND defects IS NOT NULL AND defects != ''
      GROUP BY defects
    ) combined_defects
    GROUP BY name
    ORDER BY count DESC
    LIMIT 4
  `);

  const totalDefects = defectData.reduce((sum, d) => sum + parseInt(d.count), 0);
  let defectBreakdown = defectData.map(d => ({
    name: d.name,
    value: totalDefects > 0 ? Math.round((parseInt(d.count) / totalDefects) * 100) : 0
  }));

  if (defectBreakdown.length === 0) {
    defectBreakdown = [
      { name: 'Surface Finish', value: 35 },
      { name: 'Dimensional', value: 30 },
      { name: 'Material Defect', value: 20 },
      { name: 'Packaging', value: 15 }
    ];
  }

  // 4. Supplier Quality Performance
  const [supplierPerformance] = await pool.query(`
    SELECT 
      v.vendor_name as supplier,
      ROUND((SUM(CASE WHEN UPPER(TRIM(qc.status)) IN ('PASSED', 'ACCEPTED', 'QC_APPROVED', 'COMPLETED') THEN 1 ELSE 0 END) / COUNT(*)) * 100) as qualityScore
    FROM qc_inspections qc
    JOIN grns g ON qc.grn_id = g.id
    JOIN purchase_orders po ON g.po_number = po.po_number
    JOIN vendors v ON po.vendor_id = v.id
    WHERE 1=1 ${supplierFilter}
    GROUP BY v.id
    ORDER BY qualityScore DESC
    LIMIT 50
  `, supplierParams);

  // 5. Recent Inspection Reports
  let reportsDateFilter = '';
  if (start && end) {
    reportsDateFilter = ' AND DATE(qc.inspection_date) BETWEEN ? AND ?';
  }

  const [recentReports] = await pool.query(`
    SELECT 
      qc.id as reportId,
      qc.grn_id as grnId,
      CONCAT('GRN-', LPAD(qc.grn_id, 4, '0')) as grn,
      qc.inspection_date as date,
      qc.status,
      'QA Inspector' as inspector
    FROM qc_inspections qc
    JOIN grns g ON qc.grn_id = g.id
    JOIN purchase_orders po ON g.po_number = po.po_number
    JOIN vendors v ON po.vendor_id = v.id
    WHERE 1=1 ${reportsDateFilter} ${supplierFilter}
    ORDER BY qc.created_at DESC
    LIMIT 100
  `, [...(start && end ? [start, end] : []), ...supplierParams]);

  // 6. Recent Rejections
  const recentRejections = await getRejectedItems(filters);

  return {
    kpis: {
      totalInspections: stats.totalQc,
      passRate: passRate + '%',
      rejectionRate: rejectionRate + '%',
      qualityScore: qualityScore + '%',
      defectScore: defectScore + '%'
    },
    monthlyTrend,
    defectBreakdown,
    supplierPerformance,
    recentReports,
    recentRejections: recentRejections.slice(0, 10)
  };
};

const sendQCAlertEmail = async (qcId, emailData) => {
  const { to, subject, message, attachPDF } = emailData;

  const qc = await getQCWithDetails(qcId);

  if (!to || !subject || !message) {
    throw new Error('Email recipient, subject, and message are required');
  }

  try {
    let attachments = [];
    if (attachPDF) {
      const pdfBuffer = await generateQCInspectionPDF(qcId);
      attachments.push({
        filename: `QC_Report_GRN-${String(qc.grn_id).padStart(4, '0')}.pdf`,
        content: pdfBuffer
      });
    }

    const emailResult = await emailService.sendEmail(to, subject, message, attachments);

    return {
      id: qcId,
      sent_to: to,
      sent_at: new Date(),
      message: emailResult.message,
      messageId: emailResult.messageId
    };
  } catch (error) {
    console.error(`[sendQCAlertEmail] Error: ${error.message}`);
    throw error;
  }
};

const generateQCInspectionPDF = async (qcId) => {
  const qc = await getQCWithDetails(qcId);
  if (!qc) throw new Error('QC Inspection not found');

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'roboto', sans-serif; color: #333; line-height: 1.6; margin: 40px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
        .company-info h1 { color: #2563eb; margin: 0; font-size: 24px; }
        .report-title { text-align: right; }
        .report-title h2 { margin: 0; color: #64748b; font-size: 18px; }
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
        .section-label { font-weight: bold; color: #64748b; font-size: 12px; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background: #f8fafc; color: #64748b; text-align: left; padding: 12px 8px; font-size: 11px; border-bottom: 1px solid #e2e8f0; }
        td { padding: 12px 8px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 10px; font-weight: bold; text-transform: ; }
        .status-passed { background: #ecfdf5; color: #059669; border: 1px solid #10b981; }
        .status-failed { background: #fef2f2; color: #dc2626; border: 1px solid #ef4444; }
        .status-pending { background: #fffbeb; color: #d97706; border: 1px solid #f59e0b; }
        .notes-section { background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #cbd5e1; margin-bottom: 20px; }
        .footer { margin-top: 50px; text-align: center; color: #94a3b8; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-info">
          <h1>SPTECHPIONEER PVT LTD</h1>
          <p>Industrial Area, Sector 5<br>Pune, Maharashtra - 411026</p>
        </div>
        <div class="report-title">
          <h2>QC Inspection Report</h2>
          <p><strong>GRN No:</strong> GRN-{{grn_padded}}<br>
          <strong>PO No:</strong> {{po_number}}<br>
          <strong>Date:</strong> {{inspection_date}}</p>
        </div>
      </div>

      <div class="details-grid">
        <div>
          <div class="section-label">Vendor Information</div>
          <p><strong>{{vendor_name}}</strong><br>
          Email: {{vendor_email}}</p>
        </div>
        <div style="text-align: right;">
          <div class="section-label">Inspection Status</div>
          <span class="status-badge status-{{status_lower}}">{{status}}</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Item Details</th>
            <th style="text-align: center">Ordered</th>
            <th style="text-align: center">Received</th>
            <th style="text-align: center">Accepted</th>
            <th style="text-align: center">Rejected</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {{#items_detail}}
          <tr>
            <td>
              <strong>{{material_name}}</strong><br>
              <span style="font-size: 10px; color: #64748b">{{item_code}}</span>
            </td>
            <td style="text-align: center">{{ordered_qty}}</td>
            <td style="text-align: center">{{received_qty}}</td>
            <td style="text-align: center; color: #059669; font-weight: bold">{{accepted_qty}}</td>
            <td style="text-align: center; color: #dc2626">{{rejected_qty}}</td>
            <td>{{remarks}}</td>
          </tr>
          {{/items_detail}}
          {{^items_detail}}
          <tr>
            <td colspan="6" style="text-align: center; padding: 20px; color: #64748b; font-style: italic;">
              No shortages or overages detected in this inspection.
            </td>
          </tr>
          {{/items_detail}}
        </tbody>
      </table>

      {{#defects}}
      <div class="notes-section">
        <div class="section-label">Reported Defects</div>
        <p>{{defects}}</p>
      </div>
      {{/defects}}

      {{#remarks}}
      <div class="notes-section">
        <div class="section-label">Overall Remarks</div>
        <p>{{remarks}}</p>
      </div>
      {{/remarks}}

      <div class="footer">
        <p>This is a computer-generated Quality Control report. No signature is required.<br>
        SPTECHPIONEER PVT LTD | Quality Assurance Department</p>
      </div>
    </body>
    </html>
  `;

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const viewData = {
    ...qc,
    grn_padded: String(qc.grn_id).padStart(4, '0'),
    inspection_date: formatDate(qc.inspection_date),
    status_lower: qc.status?.toLowerCase(),
    items_detail: (qc.items_detail || [])
      .filter(i => {
        const ordered = parseFloat(i.ordered_qty) || 0;
        const accepted = parseFloat(i.accepted_qty) || 0;
        const rejected = parseFloat(i.rejected_qty) || 0;
        return Math.abs(ordered - accepted) > 0.001 || rejected > 0.001;
      })
      .map(i => ({
        ...i,
        ordered_qty: parseFloat(i.ordered_qty || 0).toFixed(3),
        received_qty: parseFloat(i.received_qty || 0).toFixed(3),
        accepted_qty: parseFloat(i.accepted_qty || 0).toFixed(3),
        rejected_qty: parseFloat(i.rejected_qty || 0).toFixed(3),
        remarks: i.remarks || '—'
      }))
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

const updateQCInvoice = async (qcId, invoiceUrl) => {
  const [result] = await pool.execute(
    'UPDATE qc_inspections SET invoice_url = ? WHERE id = ?',
    [invoiceUrl, qcId]
  );
  if (result.affectedRows === 0) throw new Error('QC Inspection not found');
  return { id: qcId, invoice_url: invoiceUrl };
};

const addQCAttachments = async (qcId, attachments) => {
  const results = [];
  for (const attachment of attachments) {
    const [result] = await pool.execute(
      'INSERT INTO qc_attachments (qc_id, file_name, file_url) VALUES (?, ?, ?)',
      [qcId, attachment.file_name, attachment.file_url]
    );
    results.push({ id: result.insertId, ...attachment });
  }
  return results;
};

const getQCAttachments = async (qcId) => {
  const [rows] = await pool.query(
    'SELECT * FROM qc_attachments WHERE qc_id = ? ORDER BY uploaded_at DESC',
    [qcId]
  );
  return rows;
};

const deleteQCAttachment = async (attachmentId) => {
  const [result] = await pool.execute(
    'DELETE FROM qc_attachments WHERE id = ?',
    [attachmentId]
  );
  if (result.affectedRows === 0) throw new Error('Attachment not found');
  return { message: 'Attachment deleted successfully' };
};

const getRejectedItems = async (filters = {}) => {
  const { start, end, supplier } = filters;
  let dateFilter = '';
  let params = [];
  if (start && end) {
    dateFilter = ' AND DATE(date) BETWEEN ? AND ?';
    params = [start, end, start, end];
  }

  let supplierFilter = '';
  if (supplier && supplier !== 'All') {
    supplierFilter = ' AND source_name = ?';
    params.push(supplier);
  }

  const [items] = await pool.query(
    `SELECT * FROM (
      (SELECT 
        CONCAT('GRN-', qci.id) as id,
        qci.item_code,
        CASE 
          WHEN COALESCE(qci.accepted_qty, 0) > COALESCE(qci.po_qty, 0) THEN qci.accepted_qty - qci.po_qty
          ELSE GREATEST(COALESCE(qci.rejected_qty, 0), CASE WHEN COALESCE(qci.po_qty, 0) > COALESCE(qci.accepted_qty, 0) THEN qci.po_qty - qci.accepted_qty ELSE 0 END)
        END as rejected_qty,
        CASE 
          WHEN qci.status != 'PENDING' AND qci.status IS NOT NULL THEN qci.status
          WHEN COALESCE(qci.accepted_qty, 0) > COALESCE(qci.po_qty, 0) THEN 'OVERAGE'
          WHEN COALESCE(qci.po_qty, 0) > COALESCE(qci.accepted_qty, 0) THEN 'SHORTAGE'
          ELSE 'REJECTED'
        END as item_status,
        qci.remarks as item_remarks,
        qc.inspection_date as date,
        g.po_number as po_number,
        qc.grn_id as ref_id,
        'GRN' as ref_type,
        v.vendor_name as source_name,
        poi.material_name as material_name,
        qc.id as qc_inspection_id
      FROM qc_inspection_items qci
      JOIN qc_inspections qc ON qci.qc_inspection_id = qc.id
      LEFT JOIN grns g ON qc.grn_id = g.id
      LEFT JOIN purchase_orders po ON g.po_number = po.po_number
      LEFT JOIN vendors v ON po.vendor_id = v.id
      LEFT JOIN grn_items gi ON qci.grn_item_id = gi.id
      LEFT JOIN purchase_order_items poi ON gi.po_item_id = poi.id
      WHERE COALESCE(qci.rejected_qty, 0) > 0 OR COALESCE(qci.po_qty, 0) > COALESCE(qci.accepted_qty, 0) OR COALESCE(qci.accepted_qty, 0) > COALESCE(qci.po_qty, 0))
      
      UNION ALL
      
      (SELECT 
        CONCAT('JC-', ql.id) as id,
        wo.item_code as item_code,
        ql.rejected_qty,
        ql.status as item_status,
        ql.rejection_reason as item_remarks,
        ql.check_date as date,
        wo.wo_number as po_number,
        jc.id as ref_id,
        'JOB_CARD' as ref_type,
        CONCAT('Op: ', COALESCE(o.operation_name, jc.operation_name)) as source_name,
        wo.item_name as material_name,
        NULL as qc_inspection_id
      FROM job_card_quality_logs ql
      JOIN job_cards jc ON ql.job_card_id = jc.id
      JOIN work_orders wo ON jc.work_order_id = wo.id
      LEFT JOIN operations o ON jc.operation_id = o.id
      WHERE ql.rejected_qty > 0)
    ) combined_rejected
    WHERE 1=1 ${dateFilter} ${supplierFilter}
    ORDER BY date DESC`,
    params
  );

  return items.map(item => ({
    ...item,
    reference_number: item.ref_type === 'GRN'
      ? `GRN-${String(item.ref_id).padStart(4, '0')}`
      : `JC-${String(item.ref_id).padStart(4, '0')}`
  }));
};

const createShipmentFromQC = async (qcId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Check if shipment order already exists for this QC
    // We'll check by qc_id if we add that column, or just by linking via grn
    const [existingShipment] = await connection.query(
      `SELECT s.id FROM shipment_orders s
       JOIN sales_orders so ON s.sales_order_id = so.id
       JOIN purchase_orders po ON so.id = po.sales_order_id
       JOIN grns g ON po.po_number = g.po_number
       JOIN qc_inspections qc ON g.id = qc.grn_id
       WHERE qc.id = ?`,
      [qcId]
    );

    if (existingShipment.length > 0) {
      throw new Error('Shipment order already exists for the associated sales order');
    }

    // 2. Fetch QC details with linked PO and potentially SO
    const [qcRows] = await connection.query(
      `SELECT 
        qc.id, 
        qc.grn_id,
        g.po_number,
        po.sales_order_id,
        po.vendor_id,
        v.vendor_name,
        so.company_id as so_customer_id,
        c.company_name as so_customer_name,
        so.target_dispatch_date,
        so.production_priority,
        so.status as so_status
       FROM qc_inspections qc
       JOIN grns g ON qc.grn_id = g.id
       JOIN purchase_orders po ON g.po_number = po.po_number
       LEFT JOIN vendors v ON po.vendor_id = v.id
       LEFT JOIN sales_orders so ON po.sales_order_id = so.id
       LEFT JOIN companies c ON so.company_id = c.id
       WHERE qc.id = ?`,
      [qcId]
    );

    if (qcRows.length === 0) {
      throw new Error('QC Inspection or associated Purchase Order not found');
    }

    const qcData = qcRows[0];

    // Determine customer_id and snapshot details
    const salesOrderId = qcData.sales_order_id || null;
    let customerId = qcData.so_customer_id || null;
    let customerName = qcData.so_customer_name || qcData.vendor_name || null;
    let targetDate = qcData.target_dispatch_date || new Date();
    const priority = qcData.production_priority || 'NORMAL';

    if (salesOrderId) {
      const [soCheck] = await connection.query(
        'SELECT id FROM sales_orders WHERE id = ?',
        [salesOrderId]
      );
      if (soCheck.length === 0) {
        const [altOrderRows] = await connection.query(
          `SELECT o.client_id as company_id, o.delivery_date as target_dispatch_date, c.company_name, o.project_name
           FROM orders o 
           LEFT JOIN companies c ON o.client_id = c.id
           WHERE o.id = ?`,
          [salesOrderId]
        );
        if (altOrderRows.length > 0) {
          const altOrder = altOrderRows[0];
          console.log(`[createShipmentFromQC] Found in orders table. Syncing to sales_orders to satisfy foreign key for sales_order_id ${salesOrderId}...`);
          await connection.execute(
            `INSERT IGNORE INTO sales_orders (id, company_id, so_number, target_dispatch_date, status, current_department, request_accepted, is_sales_order, project_name)
             VALUES (?, ?, ?, ?, ?, 'SHIPMENT', 1, 1, ?)`,
            [
              salesOrderId,
              altOrder.company_id,
              `ORD-${String(salesOrderId).padStart(4, '0')}`,
              altOrder.target_dispatch_date,
              'READY_FOR_SHIPMENT',
              altOrder.project_name || null
            ]
          );
          customerId = altOrder.company_id;
          customerName = altOrder.company_name || customerName;
          targetDate = altOrder.target_dispatch_date || targetDate;
        }
      }
    }

    // 3. Generate Shipment Code
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const shipmentCode = `SHP-${year}${month}-QC${String(qcId).padStart(4, '0')}`;

    // 4. Create Shipment Order
    let result;
    try {
      [result] = await connection.execute(
        `INSERT INTO shipment_orders 
         (shipment_code, sales_order_id, customer_id, customer_name, dispatch_target_date, priority, status)
         VALUES (?, ?, ?, ?, ?, ?, 'PENDING_ACCEPTANCE')`,
        [shipmentCode, salesOrderId, customerId, customerName, targetDate, priority]
      );
    } catch (insertErr) {
      console.error('INSERT FAILED in createShipmentFromQC:', insertErr);
      throw insertErr;
    }

    // 5. Update Sales Order Status if linked
    if (salesOrderId && ['PRODUCTION_COMPLETED', 'QC_IN_PROGRESS', 'QC_APPROVED'].includes(qcData.so_status)) {
      await connection.execute(
        'UPDATE sales_orders SET status = ?, current_department = ?, updated_at = NOW() WHERE id = ?',
        ['READY_FOR_SHIPMENT', 'SHIPMENT', salesOrderId]
      );
    }

    await connection.commit();
    return { success: true, shipmentCode, shipmentId: result.insertId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const generateQcPdfUtil = require('../utils/generateQcPdf');

const generateQcPdf = async (qcId) => {
  const qc = await getQCWithDetails(qcId);
  if (!qc) throw new Error('QC Inspection not found');

  const items = qc.items_detail || [];

  return await generateQcPdfUtil({
    qc,
    items
  });
};

module.exports = {
  getQCWithDetails,
  getAllQCs,
  createQC,
  updateQC,
  updateQCItem,
  getQCItems,
  deleteQC,
  getQCStats,
  getQCReports,
  sendQCAlertEmail,
  updateQCInvoice,
  addQCAttachments,
  getQCAttachments,
  deleteQCAttachment,
  getRejectedItems,
  createShipmentFromQC,
  generateQcPdf,
  getCorrectItemCode
};
