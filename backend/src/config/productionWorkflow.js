// Production rules shared by the work order, job card and quality services.

const QTY_TOLERANCE = 0.001;

const productionError = (message, statusCode = 409) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = 'PRODUCTION_RULE_VIOLATION';
  return error;
};

// Rule violations carry their own HTTP status (409/404/400); anything else is a 500
const respondWithError = (res, error) => {
  const status = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  res.status(status).json({ error: error.message });
};

// Work order lifecycle. COMPLETED and CANCELLED are terminal.
const WORK_ORDER_TRANSITIONS = {
  DRAFT: ['RELEASED', 'CANCELLED'],
  RELEASED: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
  IN_PROGRESS: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
  ON_HOLD: ['RELEASED', 'IN_PROGRESS', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: []
};

const normalizeStatus = status => String(status || '').trim().toUpperCase();

const canTransitionWorkOrder = (from, to) => {
  const f = normalizeStatus(from) || 'DRAFT';
  const t = normalizeStatus(to);
  if (f === t) return true;
  return (WORK_ORDER_TRANSITIONS[f] || []).includes(t);
};

// Work orders in these states accept no shop-floor activity
const WORK_ORDER_BLOCKED_FOR_ACTIVITY = ['CANCELLED', 'ON_HOLD', 'COMPLETED'];

// Job card states in which no further production or quality entries are allowed
const JOB_CARD_CLOSED = ['COMPLETED', 'CANCELLED'];

const isShipmentOperation = (operationName, operationType = '') => {
  const name = String(operationName || '').trim().toLowerCase();
  return name === 'shipment' || name === 'dispatch' || String(operationType || '').trim().toLowerCase() === 'dispatch';
};

// A job card is subcontracted when either column says so. Older data stored
// the real type only in execution_type while execution_mode stayed "In-house".
const isSubcontractJobCard = ({ execution_mode: mode, execution_type: type } = {}) => {
  const values = [mode, type].map(v => String(v || '').trim().toLowerCase());
  return values.some(v => v === 'vendor' || /^(outsourc|sub[\s-]?contract)/.test(v));
};

module.exports = {
  QTY_TOLERANCE,
  productionError,
  respondWithError,
  WORK_ORDER_TRANSITIONS,
  canTransitionWorkOrder,
  WORK_ORDER_BLOCKED_FOR_ACTIVITY,
  JOB_CARD_CLOSED,
  isShipmentOperation,
  isSubcontractJobCard
};
