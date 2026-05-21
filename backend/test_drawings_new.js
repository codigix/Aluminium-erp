const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const pool = require('./src/config/db');

async function testQuotations() {
  try {
    const [rows] = await pool.query(
      `SELECT qr.*, c.company_name as client_name
       FROM quotation_requests qr
       LEFT JOIN companies c ON qr.company_id = c.id
       WHERE c.company_name = 'GALLARY' OR qr.status = 'COMPONENT'`
    );
    console.log('--- GALLARY Quotation Requests & Components ---');
    for (const r of rows) {
      console.log(`ID: ${r.id}, client_name: ${r.client_name}, V: ${r.version}, Status: ${r.status}, Group: ${r.item_group}, Code: ${r.item_code}, Dwg: ${r.drawing_no}, Desc: ${r.description}, BOMCost: ${r.bom_cost}, RecvAmt: ${r.received_amount}, RejectionReason: ${r.rejection_reason}, Batch: ${r.batch_id}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

testQuotations();
