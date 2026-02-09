-- Role permissions seeding
INSERT IGNORE INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.code = 'SALES_MGR' AND p.code IN (
  'PO_VIEW', 'PO_CREATE', 'PO_EDIT',
  'ORDER_VIEW', 'ORDER_CREATE', 'ORDER_EDIT',
  'COMPANY_VIEW',
  'DASHBOARD_VIEW',
  'STATUS_CHANGE',
  'DESIGN_VIEW', 'DESIGN_MANAGE'
);

INSERT IGNORE INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.code = 'DESIGN_ENG_ROLE' AND p.code IN (
  'ORDER_VIEW', 'ORDER_EDIT',
  'PO_VIEW',
  'COMPANY_VIEW',
  'DASHBOARD_VIEW',
  'STATUS_CHANGE',
  'BOM_VIEW', 'BOM_MANAGE',
  'DESIGN_VIEW', 'DESIGN_MANAGE'
);

INSERT IGNORE INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.code = 'PROD_MGR' AND p.code IN (
  'ORDER_VIEW', 'ORDER_EDIT',
  'PO_VIEW',
  'COMPANY_VIEW',
  'DASHBOARD_VIEW',
  'STATUS_CHANGE',
  'PROD_VIEW', 'PROD_MANAGE', 'BOM_VIEW'
);

INSERT IGNORE INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.code = 'SHIP_OFFICER' AND p.code IN (
  'ORDER_VIEW', 'ORDER_EDIT',
  'PO_VIEW',
  'COMPANY_VIEW',
  'DASHBOARD_VIEW',
  'STATUS_CHANGE',
  'DATA_EXPORT'
);

INSERT IGNORE INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.code = 'ACC_MGR' AND p.code IN (
  'ORDER_VIEW',
  'PO_VIEW',
  'COMPANY_VIEW',
  'DASHBOARD_VIEW',
  'STATUS_CHANGE',
  'DATA_EXPORT'
);

INSERT IGNORE INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.code = 'SYS_ADMIN' AND p.code IN (
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
  'PURCHASE_ORDER_VIEW',
  'PURCHASE_ORDER_CREATE',
  'PURCHASE_ORDER_EDIT',
  'PURCHASE_ORDER_DELETE',
  'GRN_VIEW', 'GRN_CREATE', 'GRN_EDIT', 'GRN_DELETE',
  'STOCK_VIEW', 'STOCK_MANAGE',
  'QC_VIEW', 'QC_CREATE', 'QC_EDIT',
  'BOM_VIEW', 'BOM_MANAGE',
  'PROD_VIEW', 'PROD_MANAGE',
  'DESIGN_VIEW', 'DESIGN_MANAGE',
  'QUOTATION_VIEW', 'QUOTATION_EDIT'
);

INSERT IGNORE INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.code = 'PROC_OFFICER' AND p.code IN (
  'PO_VIEW',
  'ORDER_VIEW',
  'COMPANY_VIEW',
  'DASHBOARD_VIEW',
  'VENDOR_VIEW',
  'VENDOR_EDIT',
  'PURCHASE_ORDER_VIEW',
  'PURCHASE_ORDER_CREATE',
  'PURCHASE_ORDER_EDIT',
  'GRN_VIEW', 'GRN_CREATE', 'GRN_EDIT',
  'QUOTATION_VIEW', 'QUOTATION_EDIT'
);

INSERT IGNORE INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.code = 'QA_INSP' AND p.code IN (
  'ORDER_VIEW',
  'PO_VIEW',
  'COMPANY_VIEW',
  'DASHBOARD_VIEW',
  'QC_VIEW', 'QC_CREATE', 'QC_EDIT', 'GRN_VIEW'
);

INSERT IGNORE INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.code = 'INV_MGR' AND p.code IN (
  'ORDER_VIEW',
  'PO_VIEW',
  'COMPANY_VIEW',
  'DASHBOARD_VIEW',
  'STOCK_VIEW', 'STOCK_MANAGE', 'GRN_VIEW',
  'VENDOR_VIEW', 'VENDOR_EDIT'
);
