// Mirror of backend/src/config/workflow.js: the Sales Order lifecycle as the
// departments see it. Keep both files in sync when a status is added.

export const SALES_ORDER_STATUS = {
  CREATED: { label: 'Created', stage: 'SALES', tone: 'slate' },
  DESIGN_QUERY: { label: 'Design Query', stage: 'DESIGN', tone: 'amber' },
  DESIGN_IN_REVIEW: { label: 'Design Review', stage: 'DESIGN', tone: 'indigo' },
  DESIGN_APPROVED: { label: 'Design Approved', stage: 'DESIGN', tone: 'emerald' },
  BOM_SUBMITTED: { label: 'BOM Submitted', stage: 'DESIGN', tone: 'amber' },
  BOM_APPROVED: { label: 'BOM Approved', stage: 'DESIGN', tone: 'emerald' },
  QUOTATION_SENT: { label: 'Quotation Sent', stage: 'SALES', tone: 'indigo' },
  PROCUREMENT_IN_PROGRESS: { label: 'Procurement Active', stage: 'PROCUREMENT', tone: 'purple' },
  MATERIAL_PURCHASE_IN_PROGRESS: { label: 'Material Purchase', stage: 'PROCUREMENT', tone: 'orange' },
  MATERIAL_READY: { label: 'Material Ready', stage: 'PROCUREMENT', tone: 'cyan' },
  IN_PRODUCTION: { label: 'In Production', stage: 'PRODUCTION', tone: 'red' },
  PRODUCTION_COMPLETED: { label: 'Production Done', stage: 'QUALITY', tone: 'lime' },
  QC_IN_PROGRESS: { label: 'QC In Progress', stage: 'QUALITY', tone: 'amber' },
  QC_REJECTED: { label: 'QC Rejected', stage: 'QUALITY', tone: 'rose' },
  QC_APPROVED: { label: 'QC Approved', stage: 'QUALITY', tone: 'emerald' },
  READY_FOR_SHIPMENT: { label: 'Ready for Shipment', stage: 'SHIPMENT', tone: 'emerald' },
  PARTIALLY_SHIPPED: { label: 'Partially Shipped', stage: 'SHIPMENT', tone: 'amber' },
  SHIPPED: { label: 'Shipped', stage: 'ACCOUNTS', tone: 'emerald' },
  DELIVERED: { label: 'Delivered', stage: 'ACCOUNTS', tone: 'emerald' },
  CLOSED: { label: 'Closed', stage: 'ACCOUNTS', tone: 'slate' },
  CANCELLED: { label: 'Cancelled', stage: 'CANCELLED', tone: 'rose' }
};

// Department hand-offs, in flow order
export const FLOW_STAGES = [
  { key: 'SALES', label: 'Sales' },
  { key: 'DESIGN', label: 'Design' },
  { key: 'PROCUREMENT', label: 'Procurement' },
  { key: 'PRODUCTION', label: 'Production' },
  { key: 'QUALITY', label: 'Quality' },
  { key: 'SHIPMENT', label: 'Shipment' },
  { key: 'ACCOUNTS', label: 'Accounts' }
];

export const PAYMENT_STATUS = {
  UNPAID: { label: 'Unpaid', tone: 'rose' },
  PARTIAL: { label: 'Partly Paid', tone: 'amber' },
  PAID: { label: 'Paid', tone: 'emerald' }
};

export const TONE_CLASSES = {
  slate: 'bg-slate-50 border-slate-200 text-slate-600',
  amber: 'bg-amber-50 border-amber-200 text-amber-600',
  indigo: 'bg-indigo-50 border-indigo-200 text-indigo-600',
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-600',
  purple: 'bg-purple-50 border-purple-200 text-purple-600',
  orange: 'bg-orange-50 border-orange-200 text-orange-600',
  cyan: 'bg-cyan-50 border-cyan-200 text-cyan-600',
  red: 'bg-red-50 border-red-200 text-red-600',
  lime: 'bg-lime-50 border-lime-200 text-lime-600',
  rose: 'bg-rose-50 border-rose-200 text-rose-600'
};

export const normalizeSalesOrderStatus = status =>
  String(status || 'CREATED').trim().toUpperCase().replace(/\s+/g, '_');

export const getSalesOrderStatusInfo = status => {
  const key = normalizeSalesOrderStatus(status);
  return SALES_ORDER_STATUS[key] || { label: key.replace(/_/g, ' '), stage: 'SALES', tone: 'slate' };
};
