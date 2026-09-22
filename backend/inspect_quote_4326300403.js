const pool = require('./src/config/db');

async function inspect() {
  try {
    const [quotes] = await pool.query(`
      SELECT q.id, q.quote_number, q.status, q.is_merged, q.merged_into_quotation_id, q.vendor_id, v.vendor_name,
             (SELECT COUNT(*) FROM quotation_items qi WHERE qi.quotation_id = q.id) as item_count
      FROM quotations q 
      LEFT JOIN vendors v ON q.vendor_id = v.id 
      WHERE q.quote_number LIKE '%1790053070743%'
    `);
    console.log('Quote QT-1790053070743:', quotes);

    const [items] = await pool.query(`
      SELECT qi.id, qi.quotation_id, qi.drawing_no, q.quote_number, q.status, q.vendor_id, v.vendor_name, q.is_merged, q.merged_into_quotation_id
      FROM quotation_items qi 
      JOIN quotations q ON qi.quotation_id = q.id 
      LEFT JOIN vendors v ON q.vendor_id = v.id
      WHERE qi.drawing_no LIKE '%4326300403%'
    `);
    console.log('All quotes for drawing 4326300403:', items);

    const [srQuotes] = await pool.query(`
      SELECT q.id, q.quote_number, q.status, q.is_merged, q.merged_into_quotation_id
      FROM quotations q
      WHERE q.vendor_id = 69
      ORDER BY q.id DESC
      LIMIT 15
    `);
    console.log('Recent quotes for vendor 69 (S.R. ENTERPRISES):', srQuotes);

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

inspect();
