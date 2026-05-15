const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function main() {
  console.log('Starting comprehensive seed v3 using mysql2...');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

  try {
    // 1. Departments
    const departmentsData = [
      { name: 'Administration', code: 'ADMIN' },
      { name: 'Sales & Marketing', code: 'SALES' },
      { name: 'Design & Engineering', code: 'DESIGN_ENG' },
      { name: 'Procurement', code: 'PROCUREMENT' },
      { name: 'Production', code: 'PRODUCTION' },
      { name: 'Quality Control', code: 'QUALITY' },
      { name: 'Shipment & Logistics', code: 'SHIPMENT' },
      { name: 'Accounts & Finance', code: 'ACCOUNTS' },
      { name: 'Inventory & Store', code: 'INVENTORY' },
    ];

    console.log('Seeding departments...');
    const departments = {};
    for (const dept of departmentsData) {
      await connection.query(
        'INSERT INTO departments (name, code, status) VALUES (?, ?, "ACTIVE") ON DUPLICATE KEY UPDATE name=name',
        [dept.name, dept.code]
      );
      const [result] = await connection.query('SELECT id FROM departments WHERE code = ?', [dept.code]);
      departments[dept.code] = result[0].id;
    }

    // 2. Permissions (All 41 identified)
    const permissionsData = [
      { name: 'View POs', code: 'PO_VIEW', resource: 'customer_pos', action: 'read' },
      { name: 'Create PO', code: 'PO_CREATE', resource: 'customer_pos', action: 'create' },
      { name: 'Edit PO', code: 'PO_EDIT', resource: 'customer_pos', action: 'update' },
      { name: 'Delete PO', code: 'PO_DELETE', resource: 'customer_pos', action: 'delete' },
      { name: 'View Orders', code: 'ORDER_VIEW', resource: 'sales_orders', action: 'read' },
      { name: 'Create Orders', code: 'ORDER_CREATE', resource: 'sales_orders', action: 'create' },
      { name: 'Edit Orders', code: 'ORDER_EDIT', resource: 'sales_orders', action: 'update' },
      { name: 'View Companies', code: 'COMPANY_VIEW', resource: 'companies', action: 'read' },
      { name: 'Edit Companies', code: 'COMPANY_EDIT', resource: 'companies', action: 'update' },
      { name: 'Manage Users', code: 'USER_MANAGE', resource: 'users', action: 'all' },
      { name: 'Manage Departments', code: 'DEPT_MANAGE', resource: 'departments', action: 'all' },
      { name: 'Export Data', code: 'DATA_EXPORT', resource: 'reports', action: 'read' },
      { name: 'View Dashboard', code: 'DASHBOARD_VIEW', resource: 'dashboard', action: 'read' },
      { name: 'Change Order Status', code: 'STATUS_CHANGE', resource: 'sales_orders', action: 'update_status' },
      { name: 'View Vendors', code: 'VENDOR_VIEW', resource: 'vendors', action: 'read' },
      { name: 'Edit Vendors', code: 'VENDOR_EDIT', resource: 'vendors', action: 'update' },
      { name: 'View Quotations', code: 'QUOTATION_VIEW', resource: 'quotations', action: 'read' },
      { name: 'Edit Quotations', code: 'QUOTATION_EDIT', resource: 'quotations', action: 'update' },
      { name: 'View Purchase Orders', code: 'PURCHASE_ORDER_VIEW', resource: 'purchase_orders', action: 'read' },
      { name: 'Create Purchase Order', code: 'PURCHASE_ORDER_CREATE', resource: 'purchase_orders', action: 'create' },
      { name: 'Edit Purchase Order', code: 'PURCHASE_ORDER_EDIT', resource: 'purchase_orders', action: 'update' },
      { name: 'Delete Purchase Order', code: 'PURCHASE_ORDER_DELETE', resource: 'purchase_orders', action: 'delete' },
      { name: 'View GRNs', code: 'GRN_VIEW', resource: 'grns', action: 'read' },
      { name: 'Create GRN', code: 'GRN_CREATE', resource: 'grns', action: 'create' },
      { name: 'Edit GRN', code: 'GRN_EDIT', resource: 'grns', action: 'update' },
      { name: 'Delete GRN', code: 'GRN_DELETE', resource: 'grns', action: 'delete' },
      { name: 'View Stock', code: 'STOCK_VIEW', resource: 'stock', action: 'read' },
      { name: 'Manage Stock', code: 'STOCK_MANAGE', resource: 'stock', action: 'all' },
      { name: 'View QC', code: 'QC_VIEW', resource: 'qc_inspections', action: 'read' },
      { name: 'Create QC', code: 'QC_CREATE', resource: 'qc_inspections', action: 'create' },
      { name: 'Edit QC', code: 'QC_EDIT', resource: 'qc_inspections', action: 'update' },
      { name: 'View BOM', code: 'BOM_VIEW', resource: 'bom', action: 'read' },
      { name: 'Manage BOM', code: 'BOM_MANAGE', resource: 'bom', action: 'all' },
      { name: 'View Production', code: 'PROD_VIEW', resource: 'production', action: 'read' },
      { name: 'Manage Production', code: 'PROD_MANAGE', resource: 'production', action: 'all' },
      { name: 'View Design', code: 'DESIGN_VIEW', resource: 'design', action: 'read' },
      { name: 'Manage Design', code: 'DESIGN_MANAGE', resource: 'design', action: 'all' },
      { name: 'View Payments', code: 'PAYMENT_VIEW', resource: 'payments', action: 'read' },
      { name: 'Process Payments', code: 'PAYMENT_PROCESS', resource: 'payments', action: 'create' },
      { name: 'Edit Payments', code: 'PAYMENT_EDIT', resource: 'payments', action: 'update' },
      { name: 'Setup Bank Accounts', code: 'PAYMENT_SETUP', resource: 'bank_accounts', action: 'write' },
    ];

    console.log('Seeding permissions...');
    const permissionIds = [];
    for (const perm of permissionsData) {
      await connection.query(
        'INSERT INTO permissions (name, code, resource, action, status) VALUES (?, ?, ?, ?, "ACTIVE") ON DUPLICATE KEY UPDATE name=name',
        [perm.name, perm.code, perm.resource, perm.action]
      );
      const [result] = await connection.query('SELECT id FROM permissions WHERE code = ?', [perm.code]);
      permissionIds.push(result[0].id);
    }

    // 3. Roles
    const rolesData = [
      { name: 'System Admin', code: 'SYS_ADMIN', deptCode: 'ADMIN' },
      { name: 'Sales Manager', code: 'SALES_MGR', deptCode: 'SALES' },
      { name: 'Design Engineer', code: 'DESIGN_ENG_ROLE', deptCode: 'DESIGN_ENG' },
      { name: 'Procurement Officer', code: 'PROC_OFFICER', deptCode: 'PROCUREMENT' },
      { name: 'Production Manager', code: 'PROD_MGR', deptCode: 'PRODUCTION' },
      { name: 'Quality Inspector', code: 'QA_INSP', deptCode: 'QUALITY' },
      { name: 'Shipment Officer', code: 'SHIP_OFFICER', deptCode: 'SHIPMENT' },
      { name: 'Accounts Manager', code: 'ACC_MGR', deptCode: 'ACCOUNTS' },
      { name: 'Inventory Manager', code: 'INV_MGR', deptCode: 'INVENTORY' },
    ];

    console.log('Seeding roles and linking ALL permissions...');
    const roles = {};
    for (const role of rolesData) {
      await connection.query(
        'INSERT INTO roles (name, code, department_id, status) VALUES (?, ?, ?, "ACTIVE") ON DUPLICATE KEY UPDATE name=name',
        [role.name, role.code, departments[role.deptCode]]
      );
      const [result] = await connection.query('SELECT id FROM roles WHERE code = ?', [role.code]);
      const roleId = result[0].id;
      roles[role.code] = roleId;

      // Link ALL permissions to this role
      for (const permId of permissionIds) {
        await connection.query(
          'INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
          [roleId, permId]
        );
      }
    }

    // 4. Users
    const password = await bcrypt.hash('password123', 10);
    const usersData = [
      { username: 'admin', email: 'admin@company.com', firstName: 'Admin', lastName: 'User', roleCode: 'SYS_ADMIN', deptCode: 'ADMIN' },
      { username: 'sales', email: 'sales@company.com', firstName: 'John', lastName: 'Sales', roleCode: 'SALES_MGR', deptCode: 'SALES' },
      { username: 'design', email: 'design@company.com', firstName: 'Jane', lastName: 'Design', roleCode: 'DESIGN_ENG_ROLE', deptCode: 'DESIGN_ENG' },
      { username: 'procurement', email: 'procurement@company.com', firstName: 'Robert', lastName: 'Procurement', roleCode: 'PROC_OFFICER', deptCode: 'PROCUREMENT' },
      { username: 'production', email: 'production@company.com', firstName: 'Mike', lastName: 'Production', roleCode: 'PROD_MGR', deptCode: 'PRODUCTION' },
      { username: 'quality', email: 'quality@company.com', firstName: 'Alice', lastName: 'Quality', roleCode: 'QA_INSP', deptCode: 'QUALITY' },
      { username: 'shipment', email: 'shipment@company.com', firstName: 'David', lastName: 'Shipment', roleCode: 'SHIP_OFFICER', deptCode: 'SHIPMENT' },
      { username: 'accounts', email: 'accounts@company.com', firstName: 'Sarah', lastName: 'Accounts', roleCode: 'ACC_MGR', deptCode: 'ACCOUNTS' },
      { username: 'inventory', email: 'inventory@company.com', firstName: 'Bob', lastName: 'Inventory', roleCode: 'INV_MGR', deptCode: 'INVENTORY' },
    ];

    console.log('Seeding users...');
    for (const user of usersData) {
      await connection.query(
        `INSERT INTO users (username, email, password, first_name, last_name, department_id, role_id, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
         ON DUPLICATE KEY UPDATE password=VALUES(password), department_id=VALUES(department_id), role_id=VALUES(role_id), username=VALUES(username)`,
        [user.username, user.email, password, user.firstName, user.lastName, departments[user.deptCode], roles[user.roleCode]]
      );
    }

    console.log('Seed completed successfully!');
  } catch (error) {
    console.error('Seed failed:', error);
  } finally {
    await connection.end();
  }
}

main();
