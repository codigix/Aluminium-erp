const pool = require('../config/db');
const stockEntryService = require('./stockEntryService');
const qcInspectionsService = require('./qcInspectionsService');

const getPOReceipts = async (filters = {}) => {
  let query = `
    SELECT 
      pr.*,
      po.po_number,
      v.vendor_name,
      po.total_amount
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
    `SELECT pr.*, po.po_number, v.vendor_name, po.total_amount
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
    `SELECT pri.*, poi.item_code, poi.description, poi.material_name, poi.material_type, poi.unit, poi.quantity as expected_quantity,
            poi.unit_rate, poi.cgst_amount, poi.sgst_amount, poi.total_amount as po_item_total
     FROM po_receipt_items pri
     LEFT JOIN purchase_order_items poi ON poi.id = pri.po_item_id
     WHERE pri.receipt_id = ?`,
    [receiptId]
  );

  return { ...receipt, items };
};

const createPOReceipt = async (poId, receiptDate, receivedQuantity, notes, items = [], userId = 1) => {
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
      `INSERT INTO po_receipts (po_id, receipt_date, received_quantity, status, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [
        poId,
        dateValue,
        receivedQuantity || 0,
        'DRAFT',
        notes || null
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
          `INSERT INTO po_receipt_items (receipt_id, po_item_id, received_quantity)
           VALUES (?, ?, ?)`,
          [receiptId, item.id, receivedQty]
        );

        // Map warehouse code/name to ID
        const warehouse = allWarehouses.find(w => 
          w.warehouse_code === item.warehouse || 
          w.warehouse_name === item.warehouse
        );
        const warehouseId = warehouse ? warehouse.id : null;

        // Also create GRN item
        await connection.execute(
          `INSERT INTO grn_items (grn_id, po_item_id, po_qty, received_qty, accepted_qty, status, warehouse_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            grnId, 
            item.id, 
            item.design_qty || item.quantity || 0, 
            receivedQty, 
            receivedQty, 
            'PENDING',
            warehouseId
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

const updatePOReceipt = async (receiptId, receiptDate, receivedQuantity, notes, status) => {
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

  if (status !== undefined) {
    const validStatuses = ['DRAFT', 'SENT', 'RECEIVED', 'ACKNOWLEDGED', 'CLOSED'];
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
      SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as sent_receipts,
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
