const pool = require('../config/db');
const stockEntryService = require('./stockEntryService');
const qcInspectionsService = require('./qcInspectionsService');

const getPOReceipts = async (filters = {}) => {
  let query = `
    SELECT 
      pr.*,
      po.po_number,
      po.is_merged,
      v.vendor_name,
      po.total_amount,
      COALESCE(
        (
          SELECT COALESCE(soi_inner.drawing_no, oi_inner.drawing_no, ppi_inner.item_code)
          FROM material_requests mr_inner 
          JOIN production_plans pp_inner ON mr_inner.plan_id = pp_inner.id
          LEFT JOIN production_plan_items ppi_inner ON pp_inner.id = ppi_inner.plan_id
          LEFT JOIN sales_order_items soi_inner ON ppi_inner.sales_order_item_id = soi_inner.id
          LEFT JOIN order_items oi_inner ON ppi_inner.sales_order_item_id = oi_inner.id AND pp_inner.sales_order_id = oi_inner.order_id
          WHERE mr_inner.id = po.mr_id
          LIMIT 1
        ),
        (
          SELECT pp_inner.bom_no 
          FROM material_requests mr_inner 
          JOIN production_plans pp_inner ON mr_inner.plan_id = pp_inner.id 
          WHERE mr_inner.id = po.mr_id 
          LIMIT 1
        ),
        (
          SELECT soi_inner.drawing_no 
          FROM sales_order_items soi_inner 
          WHERE soi_inner.sales_order_id = po.sales_order_id 
          LIMIT 1
        ),
        (
          SELECT poi_inner.drawing_no
          FROM purchase_order_items poi_inner
          WHERE poi_inner.purchase_order_id = po.id
            AND poi_inner.drawing_no IS NOT NULL
            AND poi_inner.drawing_no != ''
          LIMIT 1
        )
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
      COALESCE(pr.host_company_id, (SELECT q.host_company_id FROM quotations q WHERE q.id = po.quotation_id LIMIT 1)) as host_company_id,
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
      ) as company_name
    FROM po_receipts pr
    LEFT JOIN purchase_orders po ON po.id = pr.po_id
    LEFT JOIN vendors v ON v.id = po.vendor_id
    WHERE 1=1
  `;
  const params = [];

  if (filters.status) {
    query += ' AND pr.status = ?';
    params.push(filters.status);
  }

  if (filters.poId) {
    query += ' AND pr.po_id = ?';
    params.push(filters.poId);
  }

  query += ' ORDER BY pr.created_at DESC';

  const [receipts] = await pool.query(query, params);
  return receipts;
};

const getPOReceiptById = async (receiptId) => {
  const [rows] = await pool.query(
    `SELECT pr.*, po.po_number, v.vendor_name, po.total_amount,
     COALESCE(pr.host_company_id, (SELECT q.host_company_id FROM quotations q WHERE q.id = po.quotation_id LIMIT 1)) as host_company_id,
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
      ) as company_name
     FROM po_receipts pr
     LEFT JOIN purchase_orders po ON po.id = pr.po_id
     LEFT JOIN vendors v ON v.id = po.vendor_id
     WHERE pr.id = ?`,
    [receiptId]
  );

  if (!rows.length) {
    const error = new Error('PO Receipt not found');
    error.statusCode = 404;
    throw error;
  }

  const receipt = rows[0];

  const [items] = await pool.query(
    `SELECT pri.*, poi.item_code, poi.description, poi.material_name, poi.material_type, poi.unit, 
            poi.drawing_no, poi.cgst_percent, poi.sgst_percent,
            poi.design_qty, poi.planned_qty, poi.quantity as expected_quantity,
            poi.unit_rate, poi.cgst_amount, poi.sgst_amount, poi.total_amount as po_item_total,
            COALESCE(NULLIF(pri.length, 0), poi.length, 0) as length,
            COALESCE(NULLIF(pri.width, 0), poi.width, 0) as width,
            COALESCE(NULLIF(pri.thickness, 0), poi.thickness, 0) as thickness,
            COALESCE(NULLIF(pri.diameter, 0), poi.diameter, 0) as diameter,
            COALESCE(NULLIF(pri.outer_diameter, 0), poi.outer_diameter, 0) as outer_diameter,
            COALESCE(NULLIF(pri.density, 0), poi.density, 0) as density,
            COALESCE(NULLIF(pri.weight_per_unit, 0), poi.weight_per_unit, 0) as weight_per_unit
     FROM po_receipt_items pri
     LEFT JOIN purchase_order_items poi ON poi.id = pri.po_item_id
     WHERE pri.receipt_id = ?`,
    [receiptId]
  );

  return { ...receipt, items };
};

const createPOReceipt = async (poId, receiptDate, receivedQuantity, notes, items = [], userId = 1, hostCompanyId = null, pdfPath = null) => {
  if (!poId) {
    const error = new Error('Purchase Order ID is required');
    error.statusCode = 400;
    throw error;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [po] = await connection.query(
      'SELECT id, po_number, status FROM purchase_orders WHERE id = ?',
      [poId]
    );

    if (!po.length) {
      throw new Error('Purchase Order not found');
    }

    if (po[0].status === 'DRAFT') {
      throw new Error('Cannot create receipt for a Draft Purchase Order. Please approve it first.');
    }

    const poNumber = po[0].po_number;
    const dateValue = receiptDate ? new Date(receiptDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    
    const [result] = await connection.execute(
      `INSERT INTO po_receipts (po_id, receipt_date, received_quantity, status, notes, host_company_id, pdf_path)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        poId,
        dateValue,
        receivedQuantity || 0,
        'DRAFT',
        notes || null,
        hostCompanyId ? Number(hostCompanyId) : null,
        pdfPath
      ]
    );

    const receiptId = result.insertId;

    // Filter items to remove FG and Sub Assembly
    const filteredItems = (items || []).filter(item => {
      // Note: We might need to fetch material_type from purchase_order_items if not in item object
      // But usually 'item' here is from the request body which is derived from the PO details we already filtered in frontend
      const type = (item.material_type || '').toUpperCase();
      return type !== 'FG' && type !== 'FINISHED GOOD' && type !== 'SUB_ASSEMBLY' && type !== 'SUB ASSEMBLY';
    });

    // Create GRN entry automatically
    const [grnResult] = await connection.execute(
      `INSERT INTO grns (po_number, grn_date, received_quantity, status, notes, po_receipt_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [poNumber, dateValue, receivedQuantity || 0, 'PENDING', notes || null, receiptId]
    );
    const grnId = grnResult.insertId;

    if (filteredItems.length > 0) {
      // Pre-fetch all warehouses to map code/name to ID
      const [allWarehouses] = await connection.query('SELECT id, warehouse_code, warehouse_name FROM warehouses');
      
      for (const item of filteredItems) {
        const receivedQty = item.received_qty || item.receivedQty || 0;
        await connection.execute(
          `INSERT INTO po_receipt_items (
            receipt_id, po_item_id, received_quantity, 
            length, width, thickness, diameter, outer_diameter, density, weight_per_unit
          )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            receiptId, 
            item.id, 
            receivedQty,
            item.length || 0,
            item.width || 0,
            item.thickness || 0,
            item.diameter || 0,
            item.outer_diameter || 0,
            item.density || 0,
            item.weight_per_unit || 0
          ]
        );

        // Map warehouse code/name to ID
        const warehouse = allWarehouses.find(w => 
          w.warehouse_code === item.warehouse || 
          w.warehouse_name === item.warehouse
        );
        const warehouseId = warehouse ? warehouse.id : null;

        // Also create GRN item
        await connection.execute(
          `INSERT INTO grn_items (
            grn_id, po_item_id, po_qty, received_qty, accepted_qty, status, warehouse_id,
            length, width, thickness, diameter, outer_diameter, density, weight_per_unit
          )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            grnId, 
            item.id, 
            item.quantity || item.required_qty || item.design_qty || 0, 
            receivedQty, 
            receivedQty, 
            'PENDING',
            warehouseId,
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

    // Auto-create QC record
    try {
      await qcInspectionsService.createQC(
        grnId,
        dateValue,
        receivedQuantity || 0,
        0,
        null,
        'Auto-created from Purchase Receipt',
        connection
      );
      console.log(`[PO Receipt] Auto-created QC record for GRN: ${grnId}`);
    } catch (qcError) {
      console.error('[PO Receipt] QC auto-creation failed:', qcError.message);
    }

    // Update PO status to RECEIVED
    await connection.execute(
      'UPDATE purchase_orders SET status = ? WHERE id = ?',
      ['RECEIVED', poId]
    );

    await connection.commit();
    return { id: receiptId, po_id: poId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updatePOReceipt = async (receiptId, receiptDate, receivedQuantity, notes, status, pdfPath) => {
  await getPOReceiptById(receiptId);

  const updateFields = [];
  const updateValues = [];

  if (receiptDate !== undefined) {
    updateFields.push('receipt_date = ?');
    const dateOnly = new Date(receiptDate).toISOString().split('T')[0];
    updateValues.push(dateOnly);
  }

  if (receivedQuantity !== undefined) {
    updateFields.push('received_quantity = ?');
    updateValues.push(receivedQuantity);
  }

  if (notes !== undefined) {
    updateFields.push('notes = ?');
    updateValues.push(notes);
  }

  if (pdfPath !== undefined) {
    updateFields.push('pdf_path = ?');
    updateValues.push(pdfPath);
  }

  if (status !== undefined) {
    const validStatuses = ['DRAFT', 'Sent ', 'RECEIVED', 'ACKNOWLEDGED', 'CLOSED'];
    if (!validStatuses.includes(status)) {
      const error = new Error('Invalid status');
      error.statusCode = 400;
      throw error;
    }
    updateFields.push('status = ?');
    updateValues.push(status);
  }

  if (updateFields.length === 0) {
    return { id: receiptId };
  }

  updateValues.push(receiptId);

  await pool.execute(
    `UPDATE po_receipts SET ${updateFields.join(', ')} WHERE id = ?`,
    updateValues
  );

  return { id: receiptId };
};

const deletePOReceipt = async (receiptId) => {
  await getPOReceiptById(receiptId);
  await pool.execute('DELETE FROM po_receipts WHERE id = ?', [receiptId]);
};

const getPOReceiptStats = async () => {
  const [stats] = await pool.query(`
    SELECT 
      COUNT(*) as total_receipts,
      SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END) as draft_receipts,
      SUM(CASE WHEN status = 'Sent ' THEN 1 ELSE 0 END) as sent_receipts,
      SUM(CASE WHEN status = 'RECEIVED' THEN 1 ELSE 0 END) as received_receipts,
      SUM(CASE WHEN status = 'ACKNOWLEDGED' THEN 1 ELSE 0 END) as acknowledged_receipts,
      SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) as closed_receipts
    FROM po_receipts
  `);

  return stats[0] || {
    total_receipts: 0,
    draft_receipts: 0,
    sent_receipts: 0,
    received_receipts: 0,
    acknowledged_receipts: 0,
    closed_receipts: 0
  };
};

module.exports = {
  getPOReceipts,
  getPOReceiptById,
  createPOReceipt,
  updatePOReceipt,
  deletePOReceipt,
  getPOReceiptStats
};
