CREATE DATABASE IF NOT EXISTS sales_erp;
USE sales_erp;

CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  company_code VARCHAR(32) NOT NULL UNIQUE,
  customer_type ENUM('REGULAR', 'OEM', 'PROJECT') DEFAULT 'REGULAR',
  status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  gstin VARCHAR(20),
  cin VARCHAR(40),
  pan VARCHAR(20),
  payment_terms VARCHAR(255),
  credit_days INT,
  currency VARCHAR(10) DEFAULT 'INR',
  freight_terms VARCHAR(255),
  packing_forwarding VARCHAR(255),
  insurance_terms VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_addresses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  address_type ENUM('BILLING', 'SHIPPING') NOT NULL,
  line1 VARCHAR(255) NOT NULL,
  line2 VARCHAR(255),
  city VARCHAR(120),
  state VARCHAR(120),
  pincode VARCHAR(20),
  country VARCHAR(120) DEFAULT 'India',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  name VARCHAR(120),
  email VARCHAR(255),
  phone VARCHAR(30),
  designation VARCHAR(120),
  contact_type ENUM('PRIMARY', 'PURCHASE', 'ACCOUNTS', 'TECHNICAL', 'OTHER') DEFAULT 'PRIMARY',
  status ENUM('DRAFT', 'ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

ALTER TABLE contacts MODIFY name VARCHAR(120) NULL;

CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_pos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  po_number VARCHAR(100),
  po_date DATE,
  po_version VARCHAR(20),
  order_type VARCHAR(40),
  plant VARCHAR(120),
  currency VARCHAR(10) DEFAULT 'INR',
  payment_terms VARCHAR(255),
  credit_days INT,
  freight_terms VARCHAR(255),
  packing_forwarding VARCHAR(255),
  insurance_terms VARCHAR(255),
  delivery_terms VARCHAR(255),
  status ENUM('DRAFT', 'APPROVED', 'REJECTED') DEFAULT 'DRAFT',
  pdf_path VARCHAR(500),
  subtotal DECIMAL(14, 2) DEFAULT 0,
  tax_total DECIMAL(14, 2) DEFAULT 0,
  net_total DECIMAL(14, 2) DEFAULT 0,
  remarks TEXT,
  terms_and_conditions TEXT,
  special_notes TEXT,
  inspection_clause VARCHAR(50),
  test_certificate VARCHAR(50),
  requesting_department_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (requesting_department_id) REFERENCES departments(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS customer_po_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_po_id INT NOT NULL,
  item_code VARCHAR(120),
  description TEXT NOT NULL,
  hsn_code VARCHAR(50),
  drawing_no VARCHAR(120),
  revision_no VARCHAR(50),
  quantity DECIMAL(12, 3) DEFAULT 0,
  unit VARCHAR(20) DEFAULT 'NOS',
  rate DECIMAL(12, 2) DEFAULT 0,
  basic_amount DECIMAL(14, 2) DEFAULT 0,
  discount DECIMAL(12, 2) DEFAULT 0,
  cgst_percent DECIMAL(5, 2) DEFAULT 0,
  cgst_amount DECIMAL(12, 2) DEFAULT 0,
  sgst_percent DECIMAL(5, 2) DEFAULT 0,
  sgst_amount DECIMAL(12, 2) DEFAULT 0,
  igst_percent DECIMAL(5, 2) DEFAULT 0,
  igst_amount DECIMAL(12, 2) DEFAULT 0,
  delivery_date DATE,
  purchase_req_no VARCHAR(120),
  customer_reference VARCHAR(120),
  FOREIGN KEY (customer_po_id) REFERENCES customer_pos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sales_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_po_id INT NOT NULL,
  company_id INT NOT NULL,
  project_name VARCHAR(255),
  drawing_required TINYINT(1) DEFAULT 0,
  production_priority ENUM('LOW', 'NORMAL', 'HIGH') DEFAULT 'NORMAL',
  target_dispatch_date DATE,
  status ENUM('CREATED', 'DESIGN_IN_REVIEW', 'DESIGN_APPROVED', 'DESIGN_QUERY', 'BOM_SUBMITTED', 'BOM_APPROVED', 'PROCUREMENT_IN_PROGRESS', 'MATERIAL_PURCHASE_IN_PROGRESS', 'MATERIAL_READY', 'IN_PRODUCTION', 'PRODUCTION_COMPLETED', 'CLOSED') DEFAULT 'CREATED',
  current_department VARCHAR(50) DEFAULT 'SALES',
  request_accepted TINYINT(1) DEFAULT 0,
  material_available TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_po_id) REFERENCES customer_pos(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  INDEX idx_current_department (current_department),
  INDEX idx_status (status)
);

CREATE TABLE IF NOT EXISTS sales_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sales_order_id INT NOT NULL,
  item_code VARCHAR(120),
  drawing_no VARCHAR(120),
  revision_no VARCHAR(50),
  drawing_pdf VARCHAR(500),
  description TEXT NOT NULL,
  quantity DECIMAL(12, 3) DEFAULT 0,
  unit VARCHAR(20) DEFAULT 'NOS',
  rate DECIMAL(12, 2) DEFAULT 0,
  delivery_date DATE,
  tax_value DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  department_id INT NOT NULL,
  status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  resource VARCHAR(120),
  action VARCHAR(50),
  status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_role_permission (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(120) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  first_name VARCHAR(120),
  last_name VARCHAR(120),
  department_id INT NOT NULL,
  role_id INT NOT NULL,
  status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS document_access_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  document_type VARCHAR(50),
  document_id INT,
  action VARCHAR(50),
  status VARCHAR(50),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vendors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_name VARCHAR(255) NOT NULL,
  vendor_code VARCHAR(50) UNIQUE,
  category VARCHAR(120),
  email VARCHAR(255),
  phone VARCHAR(30),
  location VARCHAR(255),
  rating DECIMAL(3, 1) DEFAULT 0,
  status ENUM('ACTIVE', 'INACTIVE', 'BLOCKED') DEFAULT 'ACTIVE',
  total_orders INT DEFAULT 0,
  total_value DECIMAL(14, 2) DEFAULT 0,
  last_order_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_category (category)
);

CREATE TABLE IF NOT EXISTS quotations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  quote_number VARCHAR(100) UNIQUE NOT NULL,
  sales_order_id INT,
  vendor_id INT NOT NULL,
  status ENUM('DRAFT', 'SENT', 'RECEIVED', 'REVIEWED', 'CLOSED', 'PENDING') DEFAULT 'DRAFT',
  valid_until DATE,
  total_amount DECIMAL(14, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE SET NULL,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
  INDEX idx_status (status),
  INDEX idx_vendor_id (vendor_id),
  INDEX idx_sales_order_id (sales_order_id)
);

CREATE TABLE IF NOT EXISTS quotation_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  quotation_id INT NOT NULL,
  item_code VARCHAR(120),
  description TEXT,
  quantity DECIMAL(12, 3) DEFAULT 0,
  unit VARCHAR(20) DEFAULT 'NOS',
  unit_rate DECIMAL(12, 2) DEFAULT 0,
  amount DECIMAL(14, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
  INDEX idx_quotation_id (quotation_id)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  po_number VARCHAR(100) UNIQUE NOT NULL,
  quotation_id INT NOT NULL,
  vendor_id INT NOT NULL,
  sales_order_id INT,
  status ENUM('DRAFT', 'ORDERED', 'SENT', 'ACKNOWLEDGED', 'RECEIVED', 'PARTIALLY_RECEIVED', 'CLOSED', 'COMPLETED') DEFAULT 'ORDERED',
  total_amount DECIMAL(14, 2) DEFAULT 0,
  expected_delivery_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE RESTRICT,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
  FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE SET NULL,
  INDEX idx_status (status),
  INDEX idx_vendor_id (vendor_id),
  INDEX idx_quotation_id (quotation_id)
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id INT NOT NULL,
  item_code VARCHAR(120),
  description TEXT,
  quantity DECIMAL(12, 3) DEFAULT 0,
  unit VARCHAR(20) DEFAULT 'NOS',
  unit_rate DECIMAL(12, 2) DEFAULT 0,
  amount DECIMAL(14, 2) DEFAULT 0,
  cgst_percent DECIMAL(5, 2) DEFAULT 0,
  cgst_amount DECIMAL(12, 2) DEFAULT 0,
  sgst_percent DECIMAL(5, 2) DEFAULT 0,
  sgst_amount DECIMAL(12, 2) DEFAULT 0,
  total_amount DECIMAL(14, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  INDEX idx_purchase_order_id (purchase_order_id)
);

CREATE TABLE IF NOT EXISTS grns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  po_number VARCHAR(100) NOT NULL,
  grn_date DATE NOT NULL,
  received_quantity DECIMAL(12, 3) DEFAULT 0,
  status ENUM('PENDING', 'RECEIVED', 'INSPECTED', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_po_number (po_number),
  INDEX idx_status (status)
);

CREATE TABLE IF NOT EXISTS qc_inspections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grn_id INT NOT NULL,
  inspection_date DATE NOT NULL,
  pass_quantity DECIMAL(12, 3) DEFAULT 0,
  fail_quantity DECIMAL(12, 3) DEFAULT 0,
  status ENUM('PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED', 'SHORTAGE', 'ACCEPTED') DEFAULT 'PENDING',
  defects TEXT,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (grn_id) REFERENCES grns(id) ON DELETE CASCADE,
  INDEX idx_grn_id (grn_id),
  INDEX idx_status (status)
);

INSERT IGNORE INTO departments (name, code, description) VALUES
('Sales', 'SALES', 'Sales department - Manages customer POs and orders'),
('Design Engineering', 'DESIGN_ENG', 'Design Engineering department - Handles design work'),
('Procurement', 'PROCUREMENT', 'Procurement department - Manages procurement'),
('Production', 'PRODUCTION', 'Production department - Manages manufacturing'),
('Quality', 'QUALITY', 'Quality department - Quality assurance'),
('Shipment', 'SHIPMENT', 'Shipment department - Manages dispatch and delivery'),
('Accounts', 'ACCOUNTS', 'Accounts department - Handles billing and payments'),
('Inventory', 'INVENTORY', 'Inventory department - Manages stock and inventory'),
('Admin', 'ADMIN', 'Admin department - System administration');

INSERT IGNORE INTO permissions (name, code, resource, action, description) VALUES
('View POs', 'PO_VIEW', 'customer_pos', 'read', 'View customer purchase orders'),
('Create PO', 'PO_CREATE', 'customer_pos', 'create', 'Create new customer POs'),
('Edit PO', 'PO_EDIT', 'customer_pos', 'update', 'Edit customer POs'),
('Delete PO', 'PO_DELETE', 'customer_pos', 'delete', 'Delete customer POs'),
('View Orders', 'ORDER_VIEW', 'sales_orders', 'read', 'View sales orders'),
('Create Orders', 'ORDER_CREATE', 'sales_orders', 'create', 'Create sales orders'),
('Edit Orders', 'ORDER_EDIT', 'sales_orders', 'update', 'Edit sales orders'),
('View Companies', 'COMPANY_VIEW', 'companies', 'read', 'View company data'),
('Edit Companies', 'COMPANY_EDIT', 'companies', 'update', 'Edit company data'),
('Manage Users', 'USER_MANAGE', 'users', 'all', 'Manage users and permissions'),
('Manage Departments', 'DEPT_MANAGE', 'departments', 'all', 'Manage departments'),
('Export Data', 'DATA_EXPORT', 'reports', 'read', 'Export data and reports'),
('View Dashboard', 'DASHBOARD_VIEW', 'dashboard', 'read', 'View dashboard'),
('Change Order Status', 'STATUS_CHANGE', 'sales_orders', 'update_status', 'Change order status');

INSERT IGNORE INTO roles (name, code, department_id, description) VALUES
('Sales Manager', 'SALES_MGR', (SELECT id FROM departments WHERE code='SALES'), 'Manages sales and customer orders'),
('Design Engineer', 'DESIGN_ENG_ROLE', (SELECT id FROM departments WHERE code='DESIGN_ENG'), 'Handles design and engineering'),
('Procurement Officer', 'PROC_OFFICER', (SELECT id FROM departments WHERE code='PROCUREMENT'), 'Manages procurement'),
('Production Manager', 'PROD_MGR', (SELECT id FROM departments WHERE code='PRODUCTION'), 'Manages production'),
('QA Inspector', 'QA_INSP', (SELECT id FROM departments WHERE code='QUALITY'), 'Quality assurance'),
('Shipment Officer', 'SHIP_OFFICER', (SELECT id FROM departments WHERE code='SHIPMENT'), 'Manages shipment'),
('Accounts Manager', 'ACC_MGR', (SELECT id FROM departments WHERE code='ACCOUNTS'), 'Manages billing'),
('Inventory Manager', 'INV_MGR', (SELECT id FROM departments WHERE code='INVENTORY'), 'Manages inventory'),
('System Admin', 'SYS_ADMIN', (SELECT id FROM departments WHERE code='ADMIN'), 'System administration');

CREATE TABLE IF NOT EXISTS stock_ledger (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_code VARCHAR(100) NOT NULL,
  transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  transaction_type ENUM('IN', 'OUT', 'ADJUSTMENT', 'RETURN', 'GRN_IN') NOT NULL,
  quantity DECIMAL(12, 3) NOT NULL,
  reference_doc_type VARCHAR(50),
  reference_doc_id INT,
  reference_doc_number VARCHAR(100),
  qc_id INT,
  grn_item_id INT,
  balance_after DECIMAL(12, 3),
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT,
  INDEX idx_item_code (item_code),
  INDEX idx_transaction_date (transaction_date),
  INDEX idx_transaction_type (transaction_type),
  INDEX idx_qc_id (qc_id),
  UNIQUE KEY unique_grn_ledger (reference_doc_id, grn_item_id, transaction_type),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS stock_balance (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_code VARCHAR(100) NOT NULL UNIQUE,
  item_description TEXT,
  po_qty DECIMAL(12, 3) DEFAULT 0,
  received_qty DECIMAL(12, 3) DEFAULT 0,
  accepted_qty DECIMAL(12, 3) DEFAULT 0,
  issued_qty DECIMAL(12, 3) DEFAULT 0,
  current_balance DECIMAL(12, 3) DEFAULT 0,
  unit VARCHAR(20),
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_item_code (item_code)
);

CREATE TABLE IF NOT EXISTS workstations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  workstation_code VARCHAR(50) UNIQUE NOT NULL,
  workstation_name VARCHAR(100) NOT NULL,
  workstation_type VARCHAR(50),
  department VARCHAR(50),
  capacity_type VARCHAR(50),
  hourly_rate DECIMAL(10, 2) DEFAULT 0.00,
  status VARCHAR(20) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS po_receipts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  po_number VARCHAR(100),
  receipt_date DATE,
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS po_receipt_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  receipt_id INT NOT NULL,
  po_item_id INT NOT NULL,
  received_quantity DECIMAL(12, 3) DEFAULT 0,
  FOREIGN KEY (receipt_id) REFERENCES po_receipts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS grn_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grn_id INT NOT NULL,
  po_item_id INT NOT NULL,
  po_qty DECIMAL(12, 3) DEFAULT 0,
  received_qty DECIMAL(12, 3) DEFAULT 0,
  accepted_qty DECIMAL(12, 3) DEFAULT 0,
  rejected_qty DECIMAL(12, 3) DEFAULT 0,
  shortage_qty DECIMAL(12, 3) DEFAULT 0,
  overage_qty DECIMAL(12, 3) DEFAULT 0,
  status VARCHAR(50),
  remarks TEXT,
  is_approved TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (grn_id) REFERENCES grns(id) ON DELETE CASCADE
);
