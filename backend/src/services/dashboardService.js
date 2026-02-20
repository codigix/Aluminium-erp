const pool = require('../config/db');

const getDashboardStats = async () => {
  const [[poCounts]] = await pool.query(
    `SELECT
       SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END) AS draftPos,
       SUM(CASE WHEN status = 'Approved ' THEN 1 ELSE 0 END) AS approvedPos
     FROM customer_pos`
  );

  const [[orderCounts]] = await pool.query(
    `SELECT
       SUM(CASE WHEN status = 'DESIGN' THEN 1 ELSE 0 END) AS designOrders,
       SUM(CASE WHEN status = 'PRODUCTION' THEN 1 ELSE 0 END) AS productionOrders,
       SUM(CASE WHEN status = 'DISPATCH_PENDING' THEN 1 ELSE 0 END) AS pendingDispatch,
       SUM(CASE WHEN status = 'PAYMENT_PENDING' THEN 1 ELSE 0 END) AS pendingPayment
     FROM sales_orders`
  );

  return {
    newPos: poCounts.draftPos || 0,
    approvedPos: poCounts.approvedPos || 0,
    designOrders: orderCounts.designOrders || 0,
    productionOrders: orderCounts.productionOrders || 0,
    pendingDispatch: orderCounts.pendingDispatch || 0,
    pendingPayment: orderCounts.pendingPayment || 0
  };
};

module.exports = { getDashboardStats };
