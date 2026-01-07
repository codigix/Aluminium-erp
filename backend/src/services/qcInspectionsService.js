const pool = require('../config/db');

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
      qc.created_at,
      qc.updated_at,
      g.po_number,
      po.id AS po_id,
      po.vendor_id,
      v.vendor_name AS vendor_name,
      g.received_quantity AS accepted_quantity,
      SUM(poi.quantity) AS ordered_quantity
    FROM qc_inspections qc
    LEFT JOIN grns g ON qc.grn_id = g.id
    LEFT JOIN purchase_orders po ON g.po_number = po.po_number
    LEFT JOIN vendors v ON po.vendor_id = v.id
    LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
    WHERE qc.id = ?
    GROUP BY qc.id`,
    [qcId]
  );
  
  if (qcs.length > 0) {
    const qc = qcs[0];
    const orderedQty = qc.ordered_quantity || 0;
    const acceptedQty = qc.accepted_quantity || 0;
    
    qc.shortage = orderedQty > acceptedQty ? orderedQty - acceptedQty : 0;
    qc.overage = acceptedQty > orderedQty ? acceptedQty - orderedQty : 0;
    qc.items = orderedQty || acceptedQty;
    
    if (qc.po_id) {
      const [items] = await pool.query(
        `SELECT 
          id,
          item_code,
          description,
          quantity AS ordered_qty,
          unit,
          unit_rate
        FROM purchase_order_items
        WHERE purchase_order_id = ?
        ORDER BY id`,
        [qc.po_id]
      );
      
      const receivedPerItem = Math.floor((acceptedQty || 0) / (items.length || 1));
      const remainder = (acceptedQty || 0) % (items.length || 1);
      
      qc.items_detail = items.map((item, index) => {
        const received = receivedPerItem + (index < remainder ? 1 : 0);
        const itemShortage = Math.max(0, item.ordered_qty - received);
        const itemOverage = Math.max(0, received - item.ordered_qty);
        
        return {
          ...item,
          received_qty: received,
          shortage: itemShortage,
          overage: itemOverage
        };
      });
    }
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
      qc.created_at,
      qc.updated_at,
      g.po_number,
      po.vendor_id,
      v.vendor_name AS vendor_name,
      g.received_quantity AS accepted_quantity,
      SUM(poi.quantity) AS ordered_quantity
    FROM qc_inspections qc
    LEFT JOIN grns g ON qc.grn_id = g.id
    LEFT JOIN purchase_orders po ON g.po_number = po.po_number
    LEFT JOIN vendors v ON po.vendor_id = v.id
    LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
    GROUP BY qc.id
    ORDER BY qc.created_at DESC`
  );
  
  return qcs.map(qc => {
    const orderedQty = qc.ordered_quantity || 0;
    const acceptedQty = qc.accepted_quantity || 0;
    
    return {
      ...qc,
      shortage: orderedQty > acceptedQty ? orderedQty - acceptedQty : 0,
      overage: acceptedQty > orderedQty ? acceptedQty - orderedQty : 0,
      items: orderedQty || acceptedQty
    };
  });
};

const createQC = async (grnId, inspectionDate, passQuantity, failQuantity, defects, remarks) => {
  if (!grnId) {
    const error = new Error('GRN ID is required');
    error.statusCode = 400;
    throw error;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

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

    await connection.commit();
    return getQCWithDetails(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateQC = async (qcId, updates) => {
  const { inspectionDate, passQuantity, failQuantity, status, defects, remarks } = updates;
  
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

  if (setClause.length === 0) {
    return getQCWithDetails(qcId);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    values.push(qcId);

    await connection.execute(
      `UPDATE qc_inspections SET ${setClause.join(', ')} WHERE id = ?`,
      values
    );

    if (status === 'ACCEPTED' || status === 'SHORTAGE') {
      const [linked] = await connection.query(
        `SELECT po.sales_order_id
         FROM qc_inspections qc
         LEFT JOIN grns g ON qc.grn_id = g.id
         LEFT JOIN purchase_orders po ON g.po_number = po.po_number
         WHERE qc.id = ?
         LIMIT 1`,
        [qcId]
      );

      if (linked.length && linked[0].sales_order_id) {
        await connection.execute(
          'UPDATE sales_orders SET status = ?, material_available = 1 WHERE id = ?',
          ['MATERIAL_READY', linked[0].sales_order_id]
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

  return getQCWithDetails(qcId);
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

const getQCStats = async () => {
  const [stats] = await pool.query(
    `SELECT
      COUNT(*) as totalQc,
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pendingQc,
      SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as inProgressQc,
      SUM(CASE WHEN status = 'PASSED' THEN 1 ELSE 0 END) as passedQc,
      SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failedQc,
      SUM(CASE WHEN status = 'SHORTAGE' THEN 1 ELSE 0 END) as shortageQc,
      SUM(CASE WHEN status = 'ACCEPTED' THEN 1 ELSE 0 END) as acceptedQc
    FROM qc_inspections`
  );

  return stats[0] || {
    totalQc: 0,
    pendingQc: 0,
    inProgressQc: 0,
    passedQc: 0,
    failedQc: 0,
    shortageQc: 0,
    acceptedQc: 0
  };
};

module.exports = {
  getQCWithDetails,
  getAllQCs,
  createQC,
  updateQC,
  deleteQC,
  getQCStats
};
