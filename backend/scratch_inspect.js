const pool = require('./src/config/db');

async function check() {
  try {
    const [quotes] = await pool.query(
      'SELECT id, quote_number, vendor_id, status, is_merged, merged_into_quotation_id, project_name, total_amount, created_at FROM quotations ORDER BY id DESC LIMIT 15'
    );
    console.log('Recent quotations:');
    console.table(quotes);

    const [rfqs] = await pool.query(
      'SELECT id, rfq_number, status, is_merged, merged_into_rfq_id, vendor_id, created_at FROM procurement_rfqs ORDER BY id DESC LIMIT 5'
    );
    console.log('Recent RFQs:');
    console.table(rfqs);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
