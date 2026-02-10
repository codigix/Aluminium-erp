const DEPARTMENT_CODES = {
  SALES: 1,
  DESIGN_ENG: 2,
  PROCUREMENT: 3,
  PRODUCTION: 4,
  QUALITY: 5,
  SHIPMENT: 6,
  ACCOUNTS: 7,
  INVENTORY: 8,
  ADMIN: 9
};

const DOCUMENT_STATUS_FLOW = {
  DRAFT: 0,
  DESIGN: 1,
  PRODUCTION: 2,
  DISPATCH_PENDING: 3,
  PAYMENT_PENDING: 4,
  CLOSED: 5
};

const DEPARTMENT_ACCESS_RULES = {
  SALES: {
    name: 'Sales Department',
    description: 'Handles customer POs and order creation',
    canAccessStatuses: [DOCUMENT_STATUS_FLOW.DRAFT],
    canCreateDocuments: ['customer_pos', 'sales_orders'],
    canViewDocuments: ['customer_pos', 'sales_orders', 'companies'],
    canEditDocuments: ['customer_pos', 'sales_orders'],
    canChangeStatusTo: [DOCUMENT_STATUS_FLOW.DESIGN],
    allowedModules: ['customer-po', 'sales-order', 'customer-drawing', 'client-quotations'],
    permissions: [
      'PO_VIEW', 'PO_CREATE', 'PO_EDIT',
      'ORDER_VIEW', 'ORDER_CREATE', 'ORDER_EDIT',
      'COMPANY_VIEW',
      'DASHBOARD_VIEW',
      'STATUS_CHANGE'
    ]
  },

  DESIGN_ENG: {
    name: 'Design Engineering Department',
    description: 'Handles design and engineering work',
    canAccessStatuses: [DOCUMENT_STATUS_FLOW.DESIGN],
    canCreateDocuments: [],
    canViewDocuments: ['sales_orders', 'customer_pos', 'companies'],
    canEditDocuments: ['sales_orders'],
    canChangeStatusTo: [DOCUMENT_STATUS_FLOW.PRODUCTION],
    allowedModules: ['design-orders', 'drawing-master', 'bom-creation', 'bom-approval', 'bom-form'],
    permissions: [
      'ORDER_VIEW', 'ORDER_EDIT',
      'PO_VIEW',
      'COMPANY_VIEW',
      'DASHBOARD_VIEW',
      'STATUS_CHANGE'
    ]
  },

  PROCUREMENT: {
    name: 'Procurement Department',
    description: 'Manages procurement and sourcing',
    canAccessStatuses: [DOCUMENT_STATUS_FLOW.DRAFT, DOCUMENT_STATUS_FLOW.DESIGN],
    canCreateDocuments: [],
    canViewDocuments: ['customer_pos', 'sales_orders', 'companies'],
    canEditDocuments: [],
    canChangeStatusTo: [],
    allowedModules: ['suppliers', 'quotations', 'purchase-orders', 'po-receipts', 'incoming-orders'],
    permissions: [
      'PO_VIEW',
      'ORDER_VIEW',
      'COMPANY_VIEW',
      'DASHBOARD_VIEW',
      'VENDOR_VIEW',
      'VENDOR_EDIT',
      'QUOTATION_VIEW',
      'QUOTATION_EDIT',
      'PURCHASE_ORDER_VIEW',
      'PURCHASE_ORDER_CREATE',
      'PURCHASE_ORDER_EDIT',
      'STOCK_VIEW',
      'STOCK_MANAGE',
      'GRN_VIEW',
      'GRN_CREATE',
      'GRN_EDIT',
      'GRN_DELETE'
    ]
  },

  PRODUCTION: {
    name: 'Production Department',
    description: 'Manages manufacturing and production',
    canAccessStatuses: [DOCUMENT_STATUS_FLOW.PRODUCTION],
    canCreateDocuments: [],
    canViewDocuments: ['sales_orders', 'customer_pos', 'companies'],
    canEditDocuments: ['sales_orders'],
    canChangeStatusTo: [DOCUMENT_STATUS_FLOW.DISPATCH_PENDING],
    allowedModules: ['incoming-orders', 'operation-master', 'workstation-master', 'project-requests', 'material-requirements', 'production-plan', 'work-order', 'job-card'],
    permissions: [
      'ORDER_VIEW', 'ORDER_EDIT',
      'PO_VIEW',
      'COMPANY_VIEW',
      'DASHBOARD_VIEW',
      'STATUS_CHANGE'
    ]
  },

  QUALITY: {
    name: 'Quality Department',
    description: 'Handles quality assurance and inspection',
    canAccessStatuses: [DOCUMENT_STATUS_FLOW.PRODUCTION, DOCUMENT_STATUS_FLOW.DISPATCH_PENDING],
    canCreateDocuments: [],
    canViewDocuments: ['sales_orders', 'customer_pos', 'companies'],
    canEditDocuments: [],
    canChangeStatusTo: [],
    allowedModules: ['quality-dashboard', 'incoming-qc', 'in-process-qc', 'final-qc', 'quality-rejections', 'quality-reports', 'qc-inspections'],
    permissions: [
      'ORDER_VIEW',
      'PO_VIEW',
      'COMPANY_VIEW',
      'DASHBOARD_VIEW'
    ]
  },

  SHIPMENT: {
    name: 'Shipment Department',
    description: 'Manages dispatch and delivery',
    canAccessStatuses: [DOCUMENT_STATUS_FLOW.DISPATCH_PENDING],
    canCreateDocuments: [],
    canViewDocuments: ['sales_orders', 'customer_pos', 'companies'],
    canEditDocuments: ['sales_orders'],
    canChangeStatusTo: [DOCUMENT_STATUS_FLOW.PAYMENT_PENDING],
    allowedModules: ['incoming-orders'],
    permissions: [
      'ORDER_VIEW', 'ORDER_EDIT',
      'PO_VIEW',
      'COMPANY_VIEW',
      'DASHBOARD_VIEW',
      'STATUS_CHANGE',
      'DATA_EXPORT'
    ]
  },

  ACCOUNTS: {
    name: 'Accounts Department',
    description: 'Handles billing and payments',
    canAccessStatuses: [DOCUMENT_STATUS_FLOW.PAYMENT_PENDING, DOCUMENT_STATUS_FLOW.CLOSED],
    canCreateDocuments: [],
    canViewDocuments: ['sales_orders', 'customer_pos', 'companies'],
    canEditDocuments: [],
    canChangeStatusTo: [DOCUMENT_STATUS_FLOW.CLOSED],
    allowedModules: [],
    permissions: [
      'ORDER_VIEW',
      'PO_VIEW',
      'COMPANY_VIEW',
      'DASHBOARD_VIEW',
      'STATUS_CHANGE',
      'DATA_EXPORT'
    ]
  },

  INVENTORY: {
    name: 'Inventory Department',
    description: 'Manages stock and inventory',
    canAccessStatuses: [DOCUMENT_STATUS_FLOW.DESIGN, DOCUMENT_STATUS_FLOW.PRODUCTION],
    canCreateDocuments: [],
    canViewDocuments: ['sales_orders', 'customer_pos', 'companies'],
    canEditDocuments: [],
    canChangeStatusTo: [],
    allowedModules: ['inventory-dashboard', 'po-material-request', 'grn', 'stock-entries', 'stock-ledger', 'stock-balance', 'warehouses', 'suppliers'],
    permissions: [
      'ORDER_VIEW',
      'PO_VIEW',
      'COMPANY_VIEW',
      'DASHBOARD_VIEW',
      'VENDOR_VIEW',
      'VENDOR_EDIT',
      'STOCK_VIEW',
      'STOCK_MANAGE',
      'GRN_VIEW',
      'GRN_CREATE',
      'GRN_EDIT',
      'GRN_DELETE'
    ]
  },

  ADMIN: {
    name: 'Admin Department',
    description: 'System administration and user management',
    canAccessStatuses: Object.values(DOCUMENT_STATUS_FLOW),
    canCreateDocuments: ['customer_pos', 'sales_orders'],
    canViewDocuments: ['customer_pos', 'sales_orders', 'companies'],
    canEditDocuments: ['customer_pos', 'sales_orders'],
    canChangeStatusTo: Object.values(DOCUMENT_STATUS_FLOW),
    allowedModules: ['customer-po', 'sales-order', 'customer-drawing', 'po-material-request', 'design-orders', 'drawing-master', 'bom-creation', 'bom-approval', 'client-quotations', 'bom-form', 'project-requests', 'material-requirements', 'production-plan', 'work-order', 'job-card', 'suppliers', 'quotations', 'purchase-orders', 'po-receipts', 'inventory-dashboard', 'quality-dashboard', 'grn', 'stock-entries', 'stock-ledger', 'stock-balance', 'warehouses'],
    permissions: [
      'PO_VIEW', 'PO_CREATE', 'PO_EDIT', 'PO_DELETE',
      'ORDER_VIEW', 'ORDER_CREATE', 'ORDER_EDIT',
      'COMPANY_VIEW', 'COMPANY_EDIT',
      'USER_MANAGE',
      'DEPT_MANAGE',
      'DASHBOARD_VIEW',
      'DATA_EXPORT',
      'STATUS_CHANGE',
      'VENDOR_VIEW',
      'VENDOR_EDIT',
      'GRN_VIEW',
      'GRN_CREATE',
      'GRN_EDIT',
      'GRN_DELETE',
      'STOCK_VIEW',
      'STOCK_MANAGE'
    ]
  }
};

const DOCUMENT_WORKFLOW = {
  'sales_orders': [
    { status: 'DRAFT', department: 'SALES', description: 'Order created by Sales' },
    { status: 'DESIGN', department: 'DESIGN_ENG', description: 'Design Engineering phase' },
    { status: 'PRODUCTION', department: 'PRODUCTION', description: 'Manufacturing phase' },
    { status: 'DISPATCH_PENDING', department: 'SHIPMENT', description: 'Ready for dispatch' },
    { status: 'PAYMENT_PENDING', department: 'ACCOUNTS', description: 'Awaiting payment' },
    { status: 'CLOSED', department: 'ACCOUNTS', description: 'Order completed' }
  ],
  'customer_pos': [
    { status: 'DRAFT', department: 'SALES', description: 'PO received and processing' },
    { status: 'APPROVED', department: 'SALES', description: 'PO approved' }
  ]
};

module.exports = {
  DEPARTMENT_CODES,
  DOCUMENT_STATUS_FLOW,
  DEPARTMENT_ACCESS_RULES,
  DOCUMENT_WORKFLOW
};
