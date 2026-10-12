// Central definition of document lifecycles (Sales Order, Shipment, Purchase Order).
// Every status change should go through these helpers so that the
// Sales -> Design -> Procurement -> Production -> QC -> Shipment -> Accounts
// flow can only move in valid directions.

const workflowError = (message, statusCode = 409) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = 'WORKFLOW_VIOLATION';
  return error;
};

const normalizeStatus = status => String(status || '').trim().toUpperCase().replace(/\s+/g, '_');

// ---------------------------------------------------------------------------
// Sales Order
// ---------------------------------------------------------------------------
// Rank = position in the business flow. Statuses sharing a rank are siblings.
const SALES_ORDER_STAGES = {
  CREATED: 0,
  DESIGN_QUERY: 1,
  DESIGN_IN_REVIEW: 1,
  DESIGN_APPROVED: 2,
  BOM_SUBMITTED: 3,
  BOM_APPROVED: 4,
  QUOTATION_SENT: 5,
  PROCUREMENT_IN_PROGRESS: 6,
  MATERIAL_PURCHASE_IN_PROGRESS: 6,
  MATERIAL_READY: 7,
  IN_PRODUCTION: 8,
  PRODUCTION_COMPLETED: 9,
  QC_IN_PROGRESS: 10,
  QC_REJECTED: 10,
  QC_APPROVED: 11,
  READY_FOR_SHIPMENT: 12,
  PARTIALLY_SHIPPED: 13,
  SHIPPED: 14,
  DELIVERED: 15,
  CLOSED: 16,
  CANCELLED: 99
};

const SALES_ORDER_STATUSES = Object.keys(SALES_ORDER_STAGES);
const PRODUCTION_START_RANK = SALES_ORDER_STAGES.IN_PRODUCTION;
const SHIPPING_START_RANK = SALES_ORDER_STAGES.PARTIALLY_SHIPPED;
const TERMINAL_SO_STATUSES = ['CLOSED', 'CANCELLED'];

// Legacy spellings still sent by older screens
const SO_STATUS_ALIASES = {
  READY_FOR_DISPATCH: 'READY_FOR_SHIPMENT',
  DISPATCHED: 'SHIPPED',
  REJECTED_BOM: 'DESIGN_IN_REVIEW' // a rejected BOM goes back to Design for rework
};

const normalizeSalesOrderStatus = status => {
  const normalized = normalizeStatus(status);
  return SO_STATUS_ALIASES[normalized] || normalized;
};

const salesOrderRank = status => {
  const normalized = normalizeSalesOrderStatus(status);
  if (!normalized) return SALES_ORDER_STAGES.CREATED;
  return SALES_ORDER_STAGES[normalized] ?? SALES_ORDER_STAGES.CREATED;
};

const isProductionStarted = status => {
  const rank = salesOrderRank(status);
  return rank >= PRODUCTION_START_RANK && rank !== SALES_ORDER_STAGES.CANCELLED;
};

const canTransitionSalesOrder = (fromStatus, toStatus) => {
  const from = normalizeSalesOrderStatus(fromStatus) || 'CREATED';
  const to = normalizeSalesOrderStatus(toStatus);

  if (!SALES_ORDER_STATUSES.includes(to)) {
    return { ok: false, reason: `Unknown sales order status "${toStatus}"` };
  }
  if (from === to) return { ok: true };
  if (TERMINAL_SO_STATUSES.includes(from)) {
    return { ok: false, reason: `Sales order is ${from} and can no longer change status` };
  }

  const fromRank = salesOrderRank(from);
  const toRank = salesOrderRank(to);

  if (to === 'CANCELLED') {
    return fromRank < SHIPPING_START_RANK
      ? { ok: true }
      : { ok: false, reason: 'Goods have already been shipped; raise a return instead of cancelling' };
  }

  // Before production every design / quotation / procurement loop is allowed
  if (fromRank < PRODUCTION_START_RANK && toRank < PRODUCTION_START_RANK) return { ok: true };

  // Moving forward is always allowed
  if (toRank >= fromRank) return { ok: true };

  // Rework loop: production <-> QC <-> ready for shipment, as long as nothing has shipped
  if (fromRank < SHIPPING_START_RANK && toRank >= PRODUCTION_START_RANK) return { ok: true };

  return {
    ok: false,
    reason: `Cannot move sales order back from ${from} to ${to} once ${fromRank >= SHIPPING_START_RANK ? 'shipping' : 'production'} has started`
  };
};

const assertSalesOrderTransition = (fromStatus, toStatus) => {
  const result = canTransitionSalesOrder(fromStatus, toStatus);
  if (!result.ok) throw workflowError(result.reason);
  return normalizeSalesOrderStatus(toStatus);
};

// SQL condition for automatic (side-effect) status updates, e.g. "a PO was
// created" or "a plan was made". Such updates may only move an order forward;
// if the order is already past `toStatus` the update simply matches no row.
// Usage: `UPDATE sales_orders SET status = 'X' WHERE id = ? AND ${salesOrderAdvanceSql('X')}`
const salesOrderAdvanceSql = (toStatus, column = 'status') => {
  const target = normalizeSalesOrderStatus(toStatus);
  const targetRank = salesOrderRank(target);
  const allowedFrom = SALES_ORDER_STATUSES.filter(from => {
    if (from === target) return true;
    if (!canTransitionSalesOrder(from, target).ok) return false;
    const fromRank = salesOrderRank(from);
    return fromRank < PRODUCTION_START_RANK ? targetRank !== SALES_ORDER_STAGES.CANCELLED : targetRank >= fromRank;
  });
  return `(${column} IS NULL OR ${column} = '' OR ${column} IN (${allowedFrom.map(s => `'${s}'`).join(', ')}))`;
};

// ---------------------------------------------------------------------------
// Shipment Order
// ---------------------------------------------------------------------------
const SHIPMENT_TRANSITIONS = {
  PENDING_ACCEPTANCE: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['PLANNING', 'PLANNED', 'READY_TO_DISPATCH', 'DISPATCHED', 'CANCELLED'],
  PLANNING: ['PLANNED', 'READY_TO_DISPATCH', 'DISPATCHED', 'CANCELLED'],
  PLANNED: ['PLANNING', 'READY_TO_DISPATCH', 'DISPATCHED', 'CANCELLED'],
  READY_TO_DISPATCH: ['PLANNED', 'DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELAYED'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'DELIVERED', 'DELAYED'],
  DELAYED: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'DELAYED'],
  DELIVERED: ['CLOSED', 'RETURN_INITIATED'],
  CLOSED: ['RETURN_INITIATED'],
  RETURN_INITIATED: ['RETURN_PICKUP_ASSIGNED', 'RETURN_IN_TRANSIT', 'RETURN_RECEIVED'],
  RETURN_PICKUP_ASSIGNED: ['RETURN_IN_TRANSIT', 'RETURN_RECEIVED'],
  RETURN_IN_TRANSIT: ['RETURN_RECEIVED'],
  RETURN_RECEIVED: ['RETURN_COMPLETED'],
  RETURN_COMPLETED: [],
  REJECTED: ['PENDING_ACCEPTANCE'],
  CANCELLED: []
};

// Statuses after which stock has physically left the plant
const SHIPMENT_DISPATCHED_STATUSES = [
  'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELAYED', 'CLOSED',
  'RETURN_INITIATED', 'RETURN_PICKUP_ASSIGNED', 'RETURN_IN_TRANSIT', 'RETURN_RECEIVED', 'RETURN_COMPLETED'
];

const assertShipmentTransition = (fromStatus, toStatus) => {
  const from = normalizeStatus(fromStatus) || 'PENDING_ACCEPTANCE';
  const to = normalizeStatus(toStatus);
  if (!SHIPMENT_TRANSITIONS[to]) throw workflowError(`Unknown shipment status "${toStatus}"`, 400);
  if (from === to) return to;
  const allowed = SHIPMENT_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw workflowError(`Shipment cannot move from ${from} to ${to}`);
  }
  return to;
};

// ---------------------------------------------------------------------------
// Purchase Order
// ---------------------------------------------------------------------------
// Statuses that can only be reached through their own process (GRN, payment)
const PO_SYSTEM_ONLY_STATUSES = ['PAID', 'MERGED'];
const PO_RECEIVING_STATUSES = ['RECEIVED', 'PARTIALLY_RECEIVED', 'FULFILLED', 'COMPLETED', 'PENDING_PAYMENT', 'PAID', 'CLOSED'];
const PO_APPROVABLE_STATUSES = ['', 'DRAFT', 'PO_REQUEST', 'APPROVED'];

module.exports = {
  workflowError,
  normalizeStatus,
  SALES_ORDER_STAGES,
  SALES_ORDER_STATUSES,
  PRODUCTION_START_RANK,
  SHIPPING_START_RANK,
  normalizeSalesOrderStatus,
  salesOrderRank,
  isProductionStarted,
  canTransitionSalesOrder,
  assertSalesOrderTransition,
  salesOrderAdvanceSql,
  SHIPMENT_TRANSITIONS,
  SHIPMENT_DISPATCHED_STATUSES,
  assertShipmentTransition,
  PO_SYSTEM_ONLY_STATUSES,
  PO_RECEIVING_STATUSES,
  PO_APPROVABLE_STATUSES
};
