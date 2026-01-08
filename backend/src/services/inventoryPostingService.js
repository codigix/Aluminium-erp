const pool = require('../config/db');

const POSTING_TYPE = {
  INWARD: 'INWARD',
  OUTWARD: 'OUTWARD',
  ADJUSTMENT: 'ADJUSTMENT',
  REJECTION: 'REJECTION',
  RETURN: 'RETURN'
};

const postInventoryFromGRN = async (grnId, poItemId, acceptedQty, rejectedQty, reference = null) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [itemData] = await connection.query(
      `SELECT id, item_code, description, unit
       FROM purchase_order_items
       WHERE id = ?`,
      [poItemId]
    );

    if (!itemData.length) {
      throw new Error('Item not found in purchase order');
    }

    const item = itemData[0];
    let inventoryItemId = null;

    const [existingItem] = await connection.query(
      'SELECT id FROM inventory WHERE item_code = ?',
      [item.item_code]
    );

    if (existingItem.length) {
      inventoryItemId = existingItem[0].id;
    } else {
      const [newItem] = await connection.execute(
        `INSERT INTO inventory (item_code, description, unit, stock_on_hand, reorder_level, reorder_qty)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [item.item_code, item.description, item.unit || 'NOS', 0, 0, 0]
      );
      inventoryItemId = newItem.insertId;
    }

    if (acceptedQty > 0) {
      await connection.execute(
        `UPDATE inventory SET 
          stock_on_hand = stock_on_hand + ?,
          updated_at = NOW()
         WHERE id = ?`,
        [acceptedQty, inventoryItemId]
      );

      const [postingResult] = await connection.execute(
        `INSERT INTO inventory_postings (
          inventory_id, posting_type, quantity, reference_type, reference_id, remarks
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          inventoryItemId,
          POSTING_TYPE.INWARD,
          acceptedQty,
          'GRN',
          grnId,
          `Accepted from GRN ${reference || grnId}`
        ]
      );
    }

    if (rejectedQty > 0) {
      const [postingResult] = await connection.execute(
        `INSERT INTO inventory_postings (
          inventory_id, posting_type, quantity, reference_type, reference_id, remarks
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          inventoryItemId,
          POSTING_TYPE.REJECTION,
          rejectedQty,
          'GRN',
          grnId,
          `Rejected from GRN ${reference || grnId} - Awaiting return/replacement`
        ]
      );
    }

    await connection.commit();

    return {
      inventory_item_id: inventoryItemId,
      item_code: item.item_code,
      accepted_qty_posted: acceptedQty,
      rejected_qty_noted: rejectedQty,
      posting_date: new Date()
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getInventoryItem = async (itemCode) => {
  const [items] = await pool.query(
    `SELECT * FROM inventory WHERE item_code = ?`,
    [itemCode]
  );

  if (!items.length) {
    return null;
  }

  return items[0];
};

const getInventoryLedger = async (inventoryItemId, limit = 100) => {
  const [postings] = await pool.query(
    `SELECT * FROM inventory_postings 
     WHERE inventory_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [inventoryItemId, limit]
  );

  return postings;
};

const updateInventoryDashboardMetrics = async (grnSummary) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [dashboardData] = await connection.query(
      `SELECT id FROM inventory_dashboard LIMIT 1`
    );

    if (!dashboardData.length) {
      await connection.execute(
        `INSERT INTO inventory_dashboard (
          total_stock_on_hand,
          today_inward_qty,
          grn_count,
          pending_po_qty,
          updated_at
        ) VALUES (?, ?, ?, ?, NOW())`,
        [
          grnSummary.total_accepted_qty,
          grnSummary.total_accepted_qty,
          1,
          0
        ]
      );
    } else {
      await connection.execute(
        `UPDATE inventory_dashboard SET
          total_stock_on_hand = total_stock_on_hand + ?,
          today_inward_qty = today_inward_qty + ?,
          grn_count = grn_count + 1,
          updated_at = NOW()
         WHERE id = ?`,
        [
          grnSummary.total_accepted_qty,
          grnSummary.total_accepted_qty,
          dashboardData[0].id
        ]
      );
    }

    await connection.commit();

    return { success: true, message: 'Dashboard metrics updated' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateInventoryDashboardPendingPO = async (poId, deductQty = 0) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [dashboardData] = await pool.query(
      `SELECT id FROM inventory_dashboard LIMIT 1`
    );

    if (dashboardData.length && deductQty > 0) {
      await connection.execute(
        `UPDATE inventory_dashboard SET
          pending_po_qty = GREATEST(0, pending_po_qty - ?),
          updated_at = NOW()
         WHERE id = ?`,
        [deductQty, dashboardData[0].id]
      );
    }

    await connection.commit();

    return { success: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const validateStockAvailability = async (itemCode, requiredQty) => {
  const [items] = await pool.query(
    `SELECT stock_on_hand FROM inventory WHERE item_code = ?`,
    [itemCode]
  );

  if (!items.length) {
    return { available: false, stock_on_hand: 0, required_qty: requiredQty };
  }

  const stockOnHand = items[0].stock_on_hand;
  return {
    available: stockOnHand >= requiredQty,
    stock_on_hand: stockOnHand,
    required_qty: requiredQty,
    shortage: Math.max(0, requiredQty - stockOnHand)
  };
};

module.exports = {
  POSTING_TYPE,
  postInventoryFromGRN,
  getInventoryItem,
  getInventoryLedger,
  updateInventoryDashboardMetrics,
  updateInventoryDashboardPendingPO,
  validateStockAvailability
};
