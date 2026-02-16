const pool = require('../config/db');
const stockService = require('./stockService');

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
      v.vendor_name AS vendor_name
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
        poi.material_name,
        poi.description,
        w.warehouse_name
       FROM qc_inspection_items qci
       LEFT JOIN grn_items gi ON qci.grn_item_id = gi.id
       LEFT JOIN purchase_order_items poi ON gi.po_item_id = poi.id
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
      material_name: item.material_name,
      description: item.description,
      warehouse_name: item.warehouse_name,
      ordered_qty: parseFloat(item.po_qty) || 0,
      received_qty: parseFloat(item.received_qty) || 0,
      accepted_qty: parseFloat(item.accepted_qty) || 0,
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
      qc.created_at,
      qc.updated_at,
      g.po_number,
      po.vendor_id,
      v.vendor_name AS vendor_name
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
        poi.material_name,
        poi.description,
        w.warehouse_name
       FROM qc_inspection_items qci 
       LEFT JOIN grn_items gi ON qci.grn_item_id = gi.id
       LEFT JOIN purchase_order_items poi ON gi.po_item_id = poi.id
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
        warehouse_name: item.warehouse_name,
        ordered_qty: parseFloat(item.po_qty) || 0,
        received_qty: parseFloat(item.received_qty) || 0,
        accepted_qty: parseFloat(item.accepted_qty) || 0,
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
        gi.po_qty, 
        gi.received_qty, 
        gi.accepted_qty, 
        gi.rejected_qty, 
        gi.status,
        gi.warehouse_id
       FROM grn_items gi
       LEFT JOIN purchase_order_items poi ON gi.po_item_id = poi.id
       WHERE gi.grn_id = ?`,
      [grnId]
    );

    for (const item of grnItems) {
      await connection.execute(
        `INSERT INTO qc_inspection_items 
         (qc_inspection_id, grn_item_id, warehouse_id, item_code, po_qty, received_qty, accepted_qty, rejected_qty, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [qcId, item.id, item.warehouse_id, item.item_code, item.po_qty, item.received_qty, item.accepted_qty, item.rejected_qty, 'PENDING']
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
  updateQCItem,
  getQCItems,
  deleteQC,
  getQCStats
};
