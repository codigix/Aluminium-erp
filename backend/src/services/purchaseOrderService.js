const pool = require('../config/db');

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

const createPurchaseOrder = async (quotationId, expectedDeliveryDate, notes, manualPoNumber = null) => {
  if (!quotationId) {
    const error = new Error('Quotation is required');
    error.statusCode = 400;
    throw error;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [quotation] = await connection.query(
      'SELECT * FROM quotations WHERE id = ?',
      [quotationId]
    );

    if (!quotation.length) {
      throw new Error('Quotation not found');
    }

    const quote = quotation[0];

    const [items] = await connection.query(
      'SELECT * FROM quotation_items WHERE quotation_id = ?',
      [quotationId]
    );

    let poNumber = manualPoNumber;
    
    if (!poNumber) {
      poNumber = await generatePONumber();

      if (quote.sales_order_id) {
        const [salesOrder] = await connection.query(
          'SELECT customer_po_id FROM sales_orders WHERE id = ?',
          [quote.sales_order_id]
        );

        if (salesOrder.length && salesOrder[0].customer_po_id) {
          const [customerPO] = await connection.query(
            'SELECT po_number FROM customer_pos WHERE id = ?',
            [salesOrder[0].customer_po_id]
          );

          if (customerPO.length && customerPO[0].po_number) {
            poNumber = customerPO[0].po_number;
          }
        }
      }
    }

    const [result] = await connection.execute(
      `INSERT INTO purchase_orders (po_number, quotation_id, vendor_id, sales_order_id, status, total_amount, expected_delivery_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        poNumber,
        quotationId,
        quote.vendor_id,
        quote.sales_order_id || null,
        'ORDERED',
        quote.total_amount || 0,
        expectedDeliveryDate || null,
        notes || null
      ]
    );

    const poId = result.insertId;

    if (items.length > 0) {
      for (const item of items) {
        // Inherit tax amounts from quotation if available, otherwise default to 0
        const cgstAmount = item.cgst_amount || 0;
        const sgstAmount = item.sgst_amount || 0;
        const totalAmount = item.total_amount || (parseFloat(item.amount || 0) + parseFloat(cgstAmount) + parseFloat(sgstAmount));

        await connection.execute(
          `INSERT INTO purchase_order_items (
            purchase_order_id, item_code, description, quantity, unit, unit_rate, amount,
            cgst_percent, cgst_amount, sgst_percent, sgst_amount, total_amount,
            material_name, material_type
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            poId,
            item.item_code || null,
            item.description || null,
            item.quantity || 0,
            item.unit || 'NOS',
            item.unit_rate || 0,
            item.amount || 0,
            item.cgst_percent || 0,
            cgstAmount,
            item.sgst_percent || 0,
            sgstAmount,
            totalAmount,
            item.material_name || null,
            item.material_type || null
          ]
        );
      }
    }

    const [grnResult] = await connection.execute(
      `INSERT INTO grns (po_number, grn_date, received_quantity, status, notes)
       VALUES (?, ?, ?, ?, ?)` ,
      [poNumber, new Date(), 0, 'PENDING', null]
    );

    await connection.execute(
      `INSERT INTO qc_inspections (grn_id, inspection_date, pass_quantity, fail_quantity, status, defects, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?)` ,
      [grnResult.insertId, new Date(), 0, 0, 'PENDING', null, null]
    );

    if (quote.sales_order_id) {
      await connection.execute(
        'UPDATE sales_orders SET status = ? WHERE id = ?',
        ['MATERIAL_PURCHASE_IN_PROGRESS', quote.sales_order_id]
      );
    }

    const [receiptResult] = await connection.execute(
      `INSERT INTO po_receipts (po_id, receipt_date, received_quantity, status, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [
        poId,
        new Date().toISOString().split('T')[0],
        0,
        'DRAFT',
        `Auto-created for PO ${poNumber}`
      ]
    );

    await connection.commit();
    return { id: poId, po_number: poNumber, receipt_id: receiptResult.insertId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getPurchaseOrders = async (filters = {}) => {
  let query = `
    SELECT 
      po.*,
      v.vendor_name,
      COUNT(poi.id) as items_count,
      SUM(poi.quantity) as total_quantity
    FROM purchase_orders po
    LEFT JOIN vendors v ON v.id = po.vendor_id
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

  query += ' GROUP BY po.id ORDER BY po.created_at DESC';

  const [pos] = await pool.query(query, params);
  return pos;
};

const getPurchaseOrderById = async (poId) => {
  const [rows] = await pool.query(
    `SELECT po.*, v.vendor_name
     FROM purchase_orders po
     LEFT JOIN vendors v ON v.id = po.vendor_id
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
      id,
      item_code,
      description,
      quantity,
      unit,
      unit_rate,
      amount,
      cgst_percent,
      cgst_amount,
      sgst_percent,
      sgst_amount,
      total_amount,
      material_name,
      material_type
     FROM purchase_order_items 
     WHERE purchase_order_id = ?`,
    [poId]
  );

  // Use the total_amount stored in po if available, otherwise calculate from items
  if (!po.total_amount || po.total_amount === 0) {
    const [totalResult] = await pool.query(
      'SELECT SUM(total_amount) as total FROM purchase_order_items WHERE purchase_order_id = ?',
      [poId]
    );
    po.total_amount = totalResult[0]?.total || 0;
  }

  return { ...po, items };
};

const updatePurchaseOrder = async (poId, payload) => {
  const { status, poNumber, expectedDeliveryDate, notes } = payload;
  
  const validStatuses = ['DRAFT', 'ORDERED', 'SENT', 'ACKNOWLEDGED', 'RECEIVED', 'CLOSED'];
  if (status && !validStatuses.includes(status)) {
    const error = new Error('Invalid status');
    error.statusCode = 400;
    throw error;
  }

  await getPurchaseOrderById(poId);

  const updates = [];
  const params = [];

  if (status) {
    updates.push('status = ?');
    params.push(status);
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

  if (updates.length > 0) {
    params.push(poId);
    await pool.execute(
      `UPDATE purchase_orders SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
  }

  return { id: poId, status };
};

const deletePurchaseOrder = async (poId) => {
  await getPurchaseOrderById(poId);
  await pool.execute('DELETE FROM purchase_orders WHERE id = ?', [poId]);
};

const getPurchaseOrderStats = async () => {
  const [stats] = await pool.query(`
    SELECT 
      COUNT(*) as total_pos,
      SUM(CASE WHEN status = 'ORDERED' THEN 1 ELSE 0 END) as pending_pos,
      SUM(CASE WHEN status = 'ACKNOWLEDGED' THEN 1 ELSE 0 END) as approved_pos,
      SUM(CASE WHEN status = 'RECEIVED' THEN 1 ELSE 0 END) as delivered_pos,
      SUM(total_amount) as total_value
    FROM purchase_orders
  `);

  return stats[0] || {
    total_pos: 0,
    pending_pos: 0,
    approved_pos: 0,
    delivered_pos: 0,
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

module.exports = {
  createPurchaseOrder,
  previewPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  deletePurchaseOrder,
  getPurchaseOrderStats,
  getPOMaterialRequests,
  handleStoreAcceptance
};
