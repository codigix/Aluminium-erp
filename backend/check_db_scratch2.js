const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function run() {
  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3307,
    user: process.env.DB_USER || 'aluminium_user',
    password: process.env.DB_PASSWORD || 'C0digix$309',
    database: process.env.DB_NAME || 'spTech_prod'
  };

  const connection = await mysql.createConnection(config);

  try {
    console.log('--- RECENT CUSTOMER POS ---');
    const [pos] = await connection.query(`
      SELECT id, po_number, company_id, project_name, status, created_at
      FROM customer_pos
      ORDER BY id DESC
      LIMIT 5
    `);
    console.table(pos);

    console.log('--- RECENT SALES ORDERS ---');
    const [sos] = await connection.query(`
      SELECT id, project_name, customer_po_id, created_at
      FROM sales_orders
      ORDER BY id DESC
      LIMIT 10
    `);
    console.table(sos);

    console.log('--- LINKED QUOTATIONS FOR SO OF PO-2026-006 ---');
    // Find PO id for 'PO-2026-006'
    const [poRows] = await connection.query("SELECT id FROM customer_pos WHERE po_number = 'PO-2026-006'");
    if (poRows.length > 0) {
      const poId = poRows[0].id;
      console.log('PO ID for PO-2026-006 is:', poId);
      
      const [quotes] = await connection.query(
        `SELECT qr.id, qr.sales_order_id, qr.project_name, qr.client_email, qr.contact_person
         FROM sales_orders so
         JOIN quotation_requests qr ON qr.sales_order_id = so.id
         WHERE so.customer_po_id = ?`,
        [poId]
      );
      console.table(quotes);
    } else {
      console.log('PO-2026-006 not found in DB!');
    }

  } catch (error) {
    console.error('Error querying DB:', error);
  } finally {
    await connection.end();
  }
}

run();
