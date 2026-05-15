const pool = require('../src/config/db');

async function check() {
  try {
    const [bom] = await pool.query('SELECT * FROM bom WHERE item_code = "SA-ALUMINUMAS-0001" OR drawing_no = "9000011064"');
    console.log('Master BOM:');
    console.table(bom);
    if (bom.length > 0) {
        const [items] = await pool.query('SELECT * FROM bom_items WHERE bom_id = ?', [bom[0].id]);
        console.log('Master BOM Items:');
        console.table(items);
    }
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

check();
