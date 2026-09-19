const pool = require('../backend/src/config/db');

async function reset() {
  await pool.query('DELETE FROM quotation_items WHERE quotation_id = 673');
  await pool.query('DELETE FROM quotations WHERE id = 673');
  await pool.query('UPDATE quotations SET status = "RECEIVED", is_merged = 0, merged_into_quotation_id = NULL WHERE id IN (671, 672)');
  console.log('Reset completed for 671 and 672. Deleted test quote 673.');
  process.exit(0);
}

reset().catch(err => {
  console.error(err);
  process.exit(1);
});
