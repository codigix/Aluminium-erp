const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function main() {
  console.log('Replicating production data to spTech_dev...');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // Clear existing data
    await connection.query('TRUNCATE TABLE role_permissions');
    await connection.query('TRUNCATE TABLE users');
    await connection.query('TRUNCATE TABLE roles');
    await connection.query('TRUNCATE TABLE departments');
    await connection.query('TRUNCATE TABLE permissions');

    // 1. Departments (Exact IDs and Codes from screenshot)
    const departments = [
      [1, 'Sales', 'SALES', 'Sales department - Manages customer POs and orders'],
      [2, 'Design Engineering', 'DESIGN_ENG', 'Design Engineering department - Handles design work'],
      [3, 'Procurement', 'PROCUREMENT', 'Procurement department - Manages procurement'],
      [4, 'Production', 'PRODUCTION', 'Production department - Manages manufacturing'],
      [5, 'Quality', 'QUALITY', 'Quality department - Quality assurance'],
      [6, 'Shipment', 'SHIPMENT', 'Shipment department - Manages dispatch and delivery'],
      [7, 'Accounts', 'ACCOUNTS', 'Accounts department - Handles billing and payments'],
      [8, 'Inventory', 'INVENTORY', 'Inventory department - Manages stock and inventory'],
      [9, 'Admin', 'ADMIN', 'Admin department - System administration']
    ];

    for (const d of departments) {
      await connection.query(
        'INSERT INTO departments (id, name, code, description, status) VALUES (?, ?, ?, ?, "ACTIVE")',
        d
      );
    }

    // 2. Roles (Exact IDs and Codes from screenshot)
    const roles = [
      [1, 'Sales Manager', 'SALES_MGR', 'Manages sales and customer orders', 1],
      [2, 'Design Engineer', 'DESIGN_ENG_ROLE', 'Handles design and engineering', 2],
      [3, 'Procurement Officer', 'PROC_OFFICER', 'Manages procurement', 3],
      [4, 'Production Manager', 'PROD_MGR', 'Manages production', 4],
      [5, 'QA Inspector', 'QA_INSP', 'Quality assurance', 5],
      [6, 'Shipment Officer', 'SHIP_OFFICER', 'Manages shipment', 6],
      [7, 'Accounts Manager', 'ACC_MGR', 'Manages billing', 7],
      [8, 'Inventory Manager', 'INV_MGR', 'Manages inventory', 8],
      [9, 'System Admin', 'SYS_ADMIN', 'System administration', 9]
    ];

    for (const r of roles) {
      await connection.query(
        'INSERT INTO roles (id, name, code, description, department_id, status) VALUES (?, ?, ?, ?, ?, "ACTIVE")',
        r
      );
    }

    // 3. Permissions (All 41 from screenshot)
    const perms = [
      [1, 'View POs', 'PO_VIEW', 'View customer purchase orders', 'customer_pos', 'read'],
      [2, 'Create PO', 'PO_CREATE', 'Create new customer POs', 'customer_pos', 'create'],
      [3, 'Edit PO', 'PO_EDIT', 'Edit customer POs', 'customer_pos', 'update'],
      [4, 'Delete PO', 'PO_DELETE', 'Delete customer POs', 'customer_pos', 'delete'],
      [5, 'View Orders', 'ORDER_VIEW', 'View sales orders', 'sales_orders', 'read'],
      [6, 'Create Orders', 'ORDER_CREATE', 'Create sales orders', 'sales_orders', 'create'],
      [7, 'Edit Orders', 'ORDER_EDIT', 'Edit sales orders', 'sales_orders', 'update'],
      [8, 'View Companies', 'COMPANY_VIEW', 'View company data', 'companies', 'read'],
      [9, 'Edit Companies', 'COMPANY_EDIT', 'Edit company data', 'companies', 'update'],
      [10, 'Manage Users', 'USER_MANAGE', 'Manage users and permissions', 'users', 'all'],
      [11, 'Manage Departments', 'DEPT_MANAGE', 'Manage departments', 'departments', 'all'],
      [12, 'Export Data', 'DATA_EXPORT', 'Export data and reports', 'reports', 'read'],
      [13, 'View Dashboard', 'DASHBOARD_VIEW', 'View dashboard', 'dashboard', 'read'],
      [14, 'Change Order Status', 'STATUS_CHANGE', 'Change order status', 'sales_orders', 'update_status'],
      [15, 'View Vendors', 'VENDOR_VIEW', 'View vendor data', 'vendors', 'read'],
      [16, 'Edit Vendors', 'VENDOR_EDIT', 'Edit vendor data', 'vendors', 'update'],
      [17, 'View Quotations', 'QUOTATION_VIEW', 'View vendor quotations', 'quotations', 'read'],
      [18, 'Edit Quotations', 'QUOTATION_EDIT', 'Edit vendor quotations', 'quotations', 'update'],
      [19, 'View Purchase Orders', 'PURCHASE_ORDER_VIEW', 'View purchase orders', 'purchase_orders', 'read'],
      [20, 'Create Purchase Order', 'PURCHASE_ORDER_CREATE', 'Create purchase orders', 'purchase_orders', 'create'],
      [21, 'Edit Purchase Order', 'PURCHASE_ORDER_EDIT', 'Edit purchase orders', 'purchase_orders', 'update'],
      [22, 'Delete Purchase Order', 'PURCHASE_ORDER_DELETE', 'Delete purchase orders', 'purchase_orders', 'delete'],
      [23, 'View GRNs', 'GRN_VIEW', 'View GRNs', 'grns', 'read'],
      [24, 'Create GRN', 'GRN_CREATE', 'Create GRNs', 'grns', 'create'],
      [25, 'Edit GRN', 'GRN_EDIT', 'Edit GRNs', 'grns', 'update'],
      [26, 'Delete GRN', 'GRN_DELETE', 'Delete GRNs', 'grns', 'delete'],
      [27, 'View Stock', 'STOCK_VIEW', 'View stock balances and ledger', 'stock', 'read'],
      [28, 'Manage Stock', 'STOCK_MANAGE', 'Manage stock entries and adjustments', 'stock', 'all'],
      [29, 'View QC', 'QC_VIEW', 'View QC inspections', 'qc_inspections', 'read'],
      [30, 'Create QC', 'QC_CREATE', 'Create QC inspections', 'qc_inspections', 'create'],
      [31, 'Edit QC', 'QC_EDIT', 'Edit QC inspections', 'qc_inspections', 'update'],
      [32, 'View BOM', 'BOM_VIEW', 'View Bill of Materials', 'bom', 'read'],
      [33, 'Manage BOM', 'BOM_MANAGE', 'Create and edit Bill of Materials', 'bom', 'all'],
      [34, 'View Production', 'PROD_VIEW', 'View production plans and job cards', 'production', 'read'],
      [35, 'Manage Production', 'PROD_MANAGE', 'Manage production processes', 'production', 'all'],
      [36, 'View Design', 'DESIGN_VIEW', 'View designs and drawings', 'design', 'read'],
      [37, 'Manage Design', 'DESIGN_MANAGE', 'Create and edit designs and drawings', 'design', 'all'],
      [165391, 'View Payments', 'PAYMENT_VIEW', 'View payment records and history', 'payments', 'read'],
      [165392, 'Process Payments', 'PAYMENT_PROCESS', 'Process and create new payments', 'payments', 'create'],
      [165393, 'Edit Payments', 'PAYMENT_EDIT', 'Edit payment details and status', 'payments', 'update'],
      [165394, 'Setup Bank Accounts', 'PAYMENT_SETUP', 'Configure bank accounts for payments', 'bank_accounts', 'write']
    ];

    for (const p of perms) {
      await connection.query(
        'INSERT INTO permissions (id, name, code, description, resource, action, status) VALUES (?, ?, ?, ?, ?, ?, "ACTIVE")',
        p
      );
    }

    // Link all permissions to all roles for full access in development
    const [allRoles] = await connection.query('SELECT id FROM roles');
    const [allPerms] = await connection.query('SELECT id FROM permissions');
    for (const r of allRoles) {
      for (const p of allPerms) {
        await connection.query('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [r.id, p.id]);
      }
    }

    // 4. Users (Exact IDs and Passwords/Hashes from screenshot)
    const adminPass = '$2b$10$At2V0Wv/6hawr6cW1mz1tuUBx4DfwmlGPZfMIGP8CgxMuf/XEhyne';
    const salesPass = '$2b$10$v2YA5t2PqZNe6csq/rkrAOPI7BZzpkdND63rXZuRofMZ9U.G9u74m';
    const designPass = '$2b$10$dsPfpQqx8MpQowpuW2DK2OkrGEA.lNC8a9ZYHBMyZU9Jlgq5K8KjO';
    const procPass = '$2b$10$yN2XuYZDGkoIWjYPH5KhyuI2yzT/nmLutG49upXy3BcmYqVhdbXme';
    const prodPass = '$2b$10$EGrdpxeUE1B6vG.2twdhR.Qaw9aQdIgZyS83cAnA5EEd6q6zoyaPi';
    const qualityPass = '$2b$10$64UEWRob8HVVxzpOawApAuV0OK8ZWk2Hr5SwZzuEu.1GnHl/Yk53W';
    const shipmentPass = '$2b$10$jvU4.XbaSOp6AEg6wFcP9.H.Pxe0qcCgBJFM1Ji90HsmgOTNNYPYe';
    const accountsPass = '$2b$10$ajUngaAntRFxS6B5DxqMZ.C6BBcnQ0lYg8wRuAZSumHvpoNyTdO9u';
    const inventoryPass = '$2b$10$bFS87LUkVk/BkHUSj.31GuoS5Nzf7Vny6OPdEUBUgwACZuFK/g7O2';

    // Functional hashes for literal passwords in screenshot
    const sales123 = await bcrypt.hash('sales123', 10);
    const design123 = await bcrypt.hash('design123', 10);
    const inventory123 = await bcrypt.hash('inventory123', 10);
    const prod123 = await bcrypt.hash('prod123', 10);
    const quality123 = await bcrypt.hash('quality123', 10);

    const users = [
      [1, 'admin', 'admin@company.com', adminPass, 'Admin', 'User', 9, 9, '9999999999'],
      [2, 'sales1', 'sales@erp.com', sales123, 'Sales', 'Executive', 1, 2, '8888888888'],
      [3, 'design1', 'design@erp.com', design123, 'Design', 'Engineer', 2, 2, '7777777777'],
      [4, 'inventory1', 'inventory@erp.com', inventory123, 'Store', 'Manager', 8, 2, '6666666666'],
      [5, 'production1', 'production@erp.com', prod123, 'Production', 'Manager', 4, 2, '5555555555'],
      [6, 'quality1', 'quality@erp.com', quality123, 'Quality', 'Inspector', 5, 2, '4444444444'],
      [8, 'sales', 'sales@company.com', salesPass, 'Sales', '', 1, 1, null],
      [9, 'design', 'design@company.com', designPass, 'Design', '', 2, 2, null],
      [10, 'procurement', 'procurement@company.com', procPass, 'Procurement', '', 3, 3, null],
      [11, 'production', 'production@company.com', prodPass, 'Production', '', 4, 4, null],
      [12, 'quality', 'quality@company.com', qualityPass, 'Quality', '', 5, 5, null],
      [13, 'shipment', 'shipment@company.com', shipmentPass, 'Shipment', '', 6, 6, null],
      [14, 'accounts', 'accounts@company.com', accountsPass, 'Accounts', '', 7, 7, null],
      [15, 'inventory', 'inventory@company.com', inventoryPass, 'Inventory', '', 8, 8, null]
    ];

    for (const u of users) {
      await connection.query(
        'INSERT INTO users (id, username, email, password, first_name, last_name, department_id, role_id, status, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "ACTIVE", ?)',
        u
      );
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Database synchronization completed successfully!');
  } catch (error) {
    console.error('Synchronization failed:', error);
  } finally {
    await connection.end();
  }
}

main();
