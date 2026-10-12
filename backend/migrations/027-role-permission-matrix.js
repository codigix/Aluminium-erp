/**
 * Proposed least-privilege role -> permission matrix.
 *
 * Today every role holds every permission (including USER_MANAGE and
 * PAYMENT_EDIT), so route-level checks do not separate departments.
 *
 *   node migrations/027-role-permission-matrix.js          -> show what would change
 *   node migrations/027-role-permission-matrix.js --apply  -> replace role_permissions
 *
 * Review the matrix with each department head before applying: a missing
 * permission hides screens / blocks actions for that role. SYS_ADMIN always
 * keeps every permission (and bypasses checks in authMiddleware anyway).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const APPLY = process.argv.includes('--apply');

const COMMON = ['DASHBOARD_VIEW', 'COMPANY_VIEW', 'ORDER_VIEW'];

const MATRIX = {
  SALES_MGR: [...COMMON, 'COMPANY_EDIT', 'ORDER_CREATE', 'ORDER_EDIT', 'STATUS_CHANGE',
    'PO_VIEW', 'PO_CREATE', 'PO_EDIT', 'PO_DELETE', 'QUOTATION_VIEW', 'QUOTATION_EDIT',
    'DESIGN_VIEW', 'BOM_VIEW', 'PAYMENT_VIEW', 'DATA_EXPORT'],
  DESIGN_ENG_ROLE: [...COMMON, 'STATUS_CHANGE', 'PO_VIEW', 'DESIGN_VIEW', 'DESIGN_MANAGE',
    'BOM_VIEW', 'BOM_MANAGE', 'STOCK_VIEW', 'QUOTATION_VIEW'],
  PROC_OFFICER: [...COMMON, 'PURCHASE_ORDER_VIEW', 'PURCHASE_ORDER_CREATE', 'PURCHASE_ORDER_EDIT',
    'PURCHASE_ORDER_DELETE', 'VENDOR_VIEW', 'VENDOR_EDIT', 'QUOTATION_VIEW', 'QUOTATION_EDIT',
    'GRN_VIEW', 'STOCK_VIEW', 'PROD_VIEW', 'BOM_VIEW', 'DATA_EXPORT'],
  PROD_MGR: [...COMMON, 'STATUS_CHANGE', 'PROD_VIEW', 'PROD_MANAGE', 'BOM_VIEW', 'DESIGN_VIEW',
    'STOCK_VIEW', 'QC_VIEW', 'PURCHASE_ORDER_VIEW'],
  QA_INSP: [...COMMON, 'STATUS_CHANGE', 'QC_VIEW', 'QC_CREATE', 'QC_EDIT', 'GRN_VIEW', 'GRN_EDIT',
    'PROD_VIEW', 'STOCK_VIEW', 'PURCHASE_ORDER_VIEW'],
  INV_MGR: [...COMMON, 'STOCK_VIEW', 'STOCK_MANAGE', 'GRN_VIEW', 'GRN_CREATE', 'GRN_EDIT', 'GRN_DELETE',
    'PURCHASE_ORDER_VIEW', 'PROD_VIEW', 'QC_VIEW', 'BOM_VIEW', 'DATA_EXPORT'],
  SHIP_OFFICER: [...COMMON, 'ORDER_EDIT', 'STATUS_CHANGE', 'STOCK_VIEW', 'QC_VIEW'],
  ACC_MGR: [...COMMON, 'PAYMENT_VIEW', 'PAYMENT_PROCESS', 'PAYMENT_EDIT', 'PAYMENT_SETUP',
    'PURCHASE_ORDER_VIEW', 'VENDOR_VIEW', 'GRN_VIEW', 'PO_VIEW', 'DATA_EXPORT']
};

const run = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    const [permissions] = await connection.query('SELECT id, code FROM permissions');
    const permissionIds = new Map(permissions.map(p => [p.code, p.id]));
    const [roles] = await connection.query('SELECT id, code FROM roles');

    await connection.beginTransaction();
    for (const role of roles) {
      const wanted = MATRIX[role.code];
      if (!wanted) {
        console.log(`${role.code}: unchanged (${role.code === 'SYS_ADMIN' ? 'full access' : 'not in matrix'})`);
        continue;
      }
      const unknown = wanted.filter(code => !permissionIds.has(code));
      if (unknown.length) console.warn(`  ${role.code}: unknown permission codes skipped: ${unknown.join(', ')}`);

      const [current] = await connection.query(
        'SELECT p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = ?',
        [role.id]
      );
      const currentCodes = new Set(current.map(row => row.code));
      const removed = [...currentCodes].filter(code => !wanted.includes(code)).sort();
      console.log(`${role.code}: keeps ${wanted.filter(c => currentCodes.has(c)).length}, removes ${removed.length}${removed.length ? ` (${removed.join(', ')})` : ''}`);

      await connection.query('DELETE FROM role_permissions WHERE role_id = ?', [role.id]);
      for (const code of wanted) {
        if (!permissionIds.has(code)) continue;
        await connection.query('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [role.id, permissionIds.get(code)]);
      }
    }

    if (APPLY) {
      await connection.commit();
      console.log('\nApplied. Users must log in again for menus to refresh.');
    } else {
      await connection.rollback();
      console.log('\nDry run only, nothing was written. Re-run with --apply to save.');
    }
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error('Failed:', error.message);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
};

run();
