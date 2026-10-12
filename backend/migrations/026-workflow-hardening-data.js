/**
 * One-time data corrections for the workflow hardening.
 *
 *   node migrations/026-workflow-hardening-data.js          -> dry run (report only)
 *   node migrations/026-workflow-hardening-data.js --apply  -> write changes
 *
 * Run after the server has started once (it adds the new columns/tables).
 *  1. customer_ledger: receipts were written as DEBIT; they reduce the customer's
 *     balance, so they must be CREDIT.
 *  2. sales_orders.net_total: filled from top-level items where empty.
 *  3. sales_orders.paid_amount / payment_status: recalculated from confirmed receipts.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const APPLY = process.argv.includes('--apply');

const ITEMS_TOTAL = `(SELECT NULLIF(ROUND(COALESCE(SUM(COALESCE(soi.quantity, 0) * COALESCE(soi.rate, 0) + COALESCE(soi.tax_value, 0)), 0), 2), 0)
  FROM sales_order_items soi
  WHERE soi.sales_order_id = so.id AND soi.parent_bom_id IS NULL
    AND (soi.status IS NULL OR UPPER(soi.status) NOT IN ('REJECTED', 'CANCELLED')))`;

const run = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    const [cols] = await connection.query("SHOW COLUMNS FROM sales_orders LIKE 'payment_status'");
    if (cols.length === 0) {
      throw new Error('sales_orders.payment_status is missing. Start the backend once so it can add the new columns, then re-run.');
    }

    await connection.beginTransaction();

    const [[ledger]] = await connection.query(
      "SELECT COUNT(*) AS cnt FROM customer_ledger WHERE reference_doc_type = 'PAYMENT' AND transaction_type = 'DEBIT'"
    );
    console.log(`1. Customer receipts stored as DEBIT: ${ledger.cnt}`);
    await connection.query(
      "UPDATE customer_ledger SET transaction_type = 'CREDIT' WHERE reference_doc_type = 'PAYMENT' AND transaction_type = 'DEBIT'"
    );

    const [[totals]] = await connection.query(
      `SELECT COUNT(*) AS cnt FROM sales_orders so WHERE (so.net_total IS NULL OR so.net_total = 0) AND ${ITEMS_TOTAL} IS NOT NULL`
    );
    console.log(`2. Sales orders that will get net_total from their items: ${totals.cnt}`);
    await connection.query(
      `UPDATE sales_orders so SET so.net_total = ${ITEMS_TOTAL} WHERE so.net_total IS NULL OR so.net_total = 0`
    );

    await connection.query(
      `UPDATE sales_orders so
       LEFT JOIN customer_pos cp ON so.customer_po_id = cp.id
       LEFT JOIN (
         SELECT sales_order_id, SUM(payment_amount) AS paid
         FROM customer_payments
         WHERE sales_order_source = 'SALES_ORDER' AND status = 'CONFIRMED'
         GROUP BY sales_order_id
       ) p ON p.sales_order_id = so.id
       SET so.paid_amount = COALESCE(p.paid, 0),
           so.payment_status = CASE
             WHEN COALESCE(p.paid, 0) <= 0 THEN 'UNPAID'
             WHEN COALESCE(NULLIF(so.net_total, 0), NULLIF(cp.net_total, 0), 0) > 0
              AND COALESCE(p.paid, 0) + 1 >= COALESCE(NULLIF(so.net_total, 0), NULLIF(cp.net_total, 0)) THEN 'PAID'
             ELSE 'PARTIAL'
           END`
    );
    const [summary] = await connection.query('SELECT payment_status, COUNT(*) AS cnt FROM sales_orders GROUP BY payment_status');
    console.log('3. Payment status after recalculation:', summary.map(row => `${row.payment_status}=${row.cnt}`).join(', '));

    if (APPLY) {
      await connection.commit();
      console.log('\nApplied.');
    } else {
      await connection.rollback();
      console.log('\nDry run only, nothing was written. Re-run with --apply to save.');
    }
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
};

run();
