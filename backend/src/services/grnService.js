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
