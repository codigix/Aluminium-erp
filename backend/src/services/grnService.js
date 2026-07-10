const pool = require('../config/db');

const getGRNWithDetails = async (grnId) => {
  const [grns] = await pool.query(
    `SELECT 
      g.id,
      g.po_number AS poNumber,
      g.grn_date AS grnDate,
      g.received_quantity AS receivedQuantity,
      g.status,
      g.notes,
      g.po_receipt_id AS receiptId,
      g.created_at AS createdAt,
      g.updated_at AS updatedAt,
      po.vendor_id AS vendorId,
      v.vendor_name AS vendorName,
      v.location AS vendorAddress,
      COALESCE(
        (
          SELECT COALESCE(soi_inner.drawing_no, oi_inner.drawing_no, ppi_inner.item_code)
          FROM material_requests mr_inner 
          JOIN production_plans pp_inner ON mr_inner.plan_id = pp_inner.id
          LEFT JOIN production_plan_items ppi_inner ON pp_inner.id = ppi_inner.plan_id
          LEFT JOIN sales_order_items soi_inner ON ppi_inner.sales_order_item_id = soi_inner.id
          LEFT JOIN order_items oi_inner ON ppi_inner.sales_order_item_id = oi_inner.id AND ppi_inner.sales_order_id = oi_inner.order_id
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
      ) as projectName,
      SUM(COALESCE(poi.design_qty, poi.quantity)) AS orderedQuantity
    FROM grns g
    LEFT JOIN purchase_orders po ON g.po_number = po.po_number
    LEFT JOIN vendors v ON po.vendor_id = v.id
    LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
    WHERE g.id = ?
    GROUP BY g.id`,
    [grnId]
  );
  
  return grns[0] || null;
};

const getAllGRNs = async () => {
  const [grns] = await pool.query(
    `SELECT 
      g.id,
      g.po_number AS poNumber,
      g.grn_date AS grnDate,
      g.received_quantity AS receivedQuantity,
      g.status,
      g.notes,
      g.po_receipt_id AS receiptId,
      g.created_at AS createdAt,
      g.updated_at AS updatedAt,
      po.vendor_id AS vendorId,
      v.vendor_name AS vendorName,
      v.location AS vendorAddress,
      COALESCE(
        (
          SELECT COALESCE(soi_inner.drawing_no, oi_inner.drawing_no, ppi_inner.item_code)
          FROM material_requests mr_inner 
          JOIN production_plans pp_inner ON mr_inner.plan_id = pp_inner.id
          LEFT JOIN production_plan_items ppi_inner ON pp_inner.id = ppi_inner.plan_id
          LEFT JOIN sales_order_items soi_inner ON ppi_inner.sales_order_item_id = soi_inner.id
          LEFT JOIN order_items oi_inner ON ppi_inner.sales_order_item_id = oi_inner.id AND ppi_inner.sales_order_id = oi_inner.order_id
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
      ) as projectName,
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
        'N/A'
      ) as clientName,
      (SELECT COUNT(*) FROM grn_items WHERE grn_id = g.id) AS items_count
    FROM grns g
    LEFT JOIN purchase_orders po ON g.po_number = po.po_number
    LEFT JOIN vendors v ON po.vendor_id = v.id
    GROUP BY g.id
    ORDER BY g.created_at DESC`
  );
  
  return grns;
};

const createGRN = async (poNumber, grnDate, receivedQuantity, notes, receiptId = null) => {
  if (!poNumber || receivedQuantity === undefined) {
    const error = new Error('PO number and received quantity are required');
    error.statusCode = 400;
    throw error;
  }

  const [result] = await pool.execute(
    `INSERT INTO grns (po_number, grn_date, received_quantity, notes, po_receipt_id)
     VALUES (?, ?, ?, ?, ?)`,
    [poNumber, grnDate, receivedQuantity, notes || null, receiptId]
  );

  return getGRNWithDetails(result.insertId);
};

const updateGRN = async (grnId, updates) => {
  const { grnDate, receivedQuantity, status, notes } = updates;
  
  const setClause = [];
  const values = [];

  if (grnDate !== undefined) {
    setClause.push('grn_date = ?');
    values.push(grnDate);
  }

  if (receivedQuantity !== undefined) {
    setClause.push('received_quantity = ?');
    values.push(receivedQuantity);
    if (status === undefined) {
      setClause.push('status = ?');
      values.push('RECEIVED');
    }
  }

  if (status !== undefined) {
    setClause.push('status = ?');
    values.push(status);
  }

  if (notes !== undefined) {
    setClause.push('notes = ?');
    values.push(notes);
  }

  if (setClause.length === 0) {
    return getGRNWithDetails(grnId);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    values.push(grnId);

    await connection.execute(
      `UPDATE grns SET ${setClause.join(', ')} WHERE id = ?`,
      values
    );

    if (receivedQuantity !== undefined) {
      const [qcRows] = await connection.query(
        'SELECT id FROM qc_inspections WHERE grn_id = ? LIMIT 1',
        [grnId]
      );

      if (qcRows.length) {
        await connection.execute(
          'UPDATE qc_inspections SET status = ? WHERE id = ?',
          ['IN_PROGRESS', qcRows[0].id]
        );
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getGRNWithDetails(grnId);
};

const deleteGRN = async (grnId) => {
  const [result] = await pool.execute(
    'DELETE FROM grns WHERE id = ?',
    [grnId]
  );

  if (result.affectedRows === 0) {
    const error = new Error('GRN not found');
    error.statusCode = 404;
    throw error;
  }

  return { success: true };
};

const getGRNStats = async () => {
  const [stats] = await pool.query(
    `SELECT
      COUNT(*) as totalGrns,
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pendingGrns,
      SUM(CASE WHEN status = 'RECEIVED' THEN 1 ELSE 0 END) as receivedGrns,
      SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approvedGrns,
      SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejectedGrns
    FROM grns`
  );

  return stats[0] || {
    totalGrns: 0,
    pendingGrns: 0,
    receivedGrns: 0,
    approvedGrns: 0,
    rejectedGrns: 0
  };
};

module.exports = {
  getGRNWithDetails,
  getAllGRNs,
  createGRN,
  updateGRN,
  deleteGRN,
  getGRNStats
};
