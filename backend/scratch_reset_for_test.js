const pool = require('./src/config/db');

async function resetClean() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Reset source quotations 670 and 671
    await conn.query(
      "UPDATE quotations SET status = 'RECEIVED', is_merged = 0, merged_into_quotation_id = NULL WHERE id IN (670, 671)"
    );

    // 2. Delete test merged quote items and quote 674
    await conn.query('DELETE FROM quotation_items WHERE quotation_id = 674');
    await conn.query('DELETE FROM quotations WHERE id = 674');

    await conn.commit();
    console.log('Successfully reset 670 and 671 to RECEIVED (is_merged = 0) and removed test quote 674.');

    // Check status
    const [rows] = await conn.query(
      'SELECT id, quote_number, vendor_id, status, is_merged, merged_into_quotation_id FROM quotations WHERE id IN (670, 671)'
    );
    console.table(rows);
    process.exit(0);
  } catch (err) {
    await conn.rollback();
    console.error(err);
    process.exit(1);
  } finally {
    conn.release();
  }
}
resetClean();
