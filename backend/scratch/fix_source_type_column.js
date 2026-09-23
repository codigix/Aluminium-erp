const pool = require('../src/config/db');

async function fix() {
  const dbs = ['spTech_prod', 'spTech_dev', 'sales_erp', 'shadow_db'];
  for (const db of dbs) {
    try {
      await pool.query(`ALTER TABLE ${db}.work_orders MODIFY COLUMN source_type VARCHAR(50) DEFAULT 'FG'`);
      console.log('Successfully altered ' + db + '.work_orders');
    } catch (e) {
      console.error('Error on ' + db, e.message);
    }
  }
  process.exit(0);
}

fix();
