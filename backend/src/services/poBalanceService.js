const pool = require('../config/db');

const PO_ITEM_STATUS = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  EXCESS: 'EXCESS'
};

const calculateItemBalance = async (poItemId) => {
  const [result] = await pool.query(
    `SELECT 
      poi.id,
      poi.purchase_order_id,
      poi.item_code,
      poi.description,
      poi.quantity as po_qty,
      poi.unit,
      poi.unit_rate,
      poi.amount,
      COALESCE(SUM(CASE WHEN gi.status IN ('RECEIVED', 'EXCESS_ACCEPTED', 'Approved ', 'APPROVED', 'PASSED', 'ACCEPTED', 'SHORTAGE') THEN gi.accepted_qty ELSE 0 END), 0) as total_accepted_qty,
      COALESCE(SUM(CASE WHEN gi.status = 'REJECTED' THEN gi.rejected_qty ELSE 0 END), 0) as total_rejected_qty,
      COALESCE(SUM(CASE WHEN gi.status = 'SHORT_RECEIPT' THEN gi.shortage_qty ELSE 0 END), 0) as total_shortage_qty
    FROM purchase_order_items poi
    LEFT JOIN grn_items gi ON poi.id = gi.po_item_id
    WHERE poi.id = ?
    GROUP BY poi.id`,
    [poItemId]
  );

  if (!result.length) {
    return null;
  }

  const item = result[0];
  const balanceQty = item.po_qty - item.total_accepted_qty;

  return {
    po_item_id: item.id,
    item_code: item.item_code,
    description: item.description,
    po_qty: item.po_qty,
    unit: item.unit,
    unit_rate: item.unit_rate,
    total_accepted_qty: item.total_accepted_qty,
    total_rejected_qty: item.total_rejected_qty,
    total_shortage_qty: item.total_shortage_qty,
    balance_qty: balanceQty,
    status: balanceQty > 0 ? PO_ITEM_STATUS.OPEN : (balanceQty === 0 ? PO_ITEM_STATUS.CLOSED : PO_ITEM_STATUS.EXCESS),
    amount: item.amount
  };
};

const calculatePOBalance = async (poId) => {
  const [items] = await pool.query(
    `SELECT 
      poi.id,
      poi.item_code,
      poi.description,
      poi.quantity as po_qty,
      poi.unit,
      COALESCE(SUM(CASE WHEN gi.status IN ('RECEIVED', 'EXCESS_ACCEPTED', 'Approved ', 'APPROVED', 'PASSED', 'ACCEPTED', 'SHORTAGE') THEN gi.accepted_qty ELSE 0 END), 0) as total_accepted_qty,
      COALESCE(SUM(CASE WHEN gi.status = 'REJECTED' THEN gi.rejected_qty ELSE 0 END), 0) as total_rejected_qty
    FROM purchase_order_items poi
    LEFT JOIN grn_items gi ON poi.id = gi.po_item_id
    WHERE poi.purchase_order_id = ?
    GROUP BY poi.id`,
    [poId]
  );

  let totalPOQty = 0;
  let totalAcceptedQty = 0;
  let totalRejectedQty = 0;
  let openItemsCount = 0;
  let closedItemsCount = 0;

  const itemBalances = items.map(item => {
    const balanceQty = item.po_qty - item.total_accepted_qty;
    const status = balanceQty > 0 ? PO_ITEM_STATUS.OPEN : (balanceQty === 0 ? PO_ITEM_STATUS.CLOSED : PO_ITEM_STATUS.EXCESS);

    totalPOQty += item.po_qty;
    totalAcceptedQty += item.total_accepted_qty;
    totalRejectedQty += item.total_rejected_qty;

    if (status === PO_ITEM_STATUS.OPEN) {
      openItemsCount++;
    } else if (status === PO_ITEM_STATUS.CLOSED) {
      closedItemsCount++;
    }

    return {
      po_item_id: item.id,
      item_code: item.item_code,
      description: item.description,
      po_qty: item.po_qty,
      unit: item.unit,
      accepted_qty: item.total_accepted_qty,
      rejected_qty: item.total_rejected_qty,
      balance_qty: balanceQty,
      status
    };
  });

  const overallStatus = closedItemsCount === items.length ? 'COMPLETED' : (openItemsCount > 0 ? 'PARTIALLY_RECEIVED' : 'ORDERED');

  return {
    po_id: poId,
    total_items: items.length,
    total_po_qty: totalPOQty,
    total_accepted_qty: totalAcceptedQty,
    total_rejected_qty: totalRejectedQty,
    total_balance_qty: totalPOQty - totalAcceptedQty,
    open_items: openItemsCount,
    closed_items: closedItemsCount,
    overall_status: overallStatus,
    item_balances: itemBalances
  };
};

const updatePOItemStatus = async (poItemId, itemStatus) => {
  const [result] = await pool.execute(
    `UPDATE purchase_order_items SET status = ? WHERE id = ?`,
    [itemStatus, poItemId]
  );

  return result.affectedRows > 0;
};

const updatePOStatus = async (poId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const balanceInfo = await calculatePOBalance(poId);

    await connection.execute(
      `UPDATE purchase_orders SET status = ? WHERE id = ?`,
      [balanceInfo.overall_status, poId]
    );

    for (const itemBalance of balanceInfo.item_balances) {
      await connection.execute(
        `UPDATE purchase_order_items SET status = ? WHERE id = ?`,
        [itemBalance.status, itemBalance.po_item_id]
      );
    }

    await connection.commit();

    return {
      po_id: poId,
      new_status: balanceInfo.overall_status,
      balance_info: balanceInfo
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getPOReceiptHistory = async (poId, poItemId = null) => {
  let query = `
    SELECT 
      g.id as grn_id,
      g.grn_date,
      g.status as grn_status,
      gi.id as grn_item_id,
      gi.po_item_id,
      gi.po_qty,
      gi.received_qty,
      gi.accepted_qty,
      gi.rejected_qty,
      gi.shortage_qty,
      gi.overage_qty,
      gi.status as grn_item_status,
      poi.item_code,
      poi.description,
      poi.unit
    FROM grns g
    JOIN grn_items gi ON g.id = gi.grn_id
    JOIN purchase_order_items poi ON gi.po_item_id = poi.id
    WHERE poi.purchase_order_id = ?
  `;

  const params = [poId];

  if (poItemId) {
    query += ` AND gi.po_item_id = ?`;
    params.push(poItemId);
  }

  query += ` ORDER BY g.grn_date DESC, g.id DESC`;

  const [history] = await pool.query(query, params);

  return history;
};

const getPoBalanceByPoNumber = async (poNumber) => {
  const [poData] = await pool.query(
    `SELECT id FROM purchase_orders WHERE po_number = ?`,
    [poNumber]
  );

  if (!poData.length) {
    throw new Error('PO not found');
  }

  return calculatePOBalance(poData[0].id);
};

module.exports = {
  PO_ITEM_STATUS,
  calculateItemBalance,
  calculatePOBalance,
  updatePOItemStatus,
  updatePOStatus,
  getPOReceiptHistory,
  getPoBalanceByPoNumber
};
