const pool = require('../src/config/db');

(async () => {
  try {
    console.log('\n--- stock_balance for RM-ALIUMNINUM-0001 ---');
    const [sb] = await pool.query("SELECT * FROM stock_balance WHERE item_code LIKE '%ALIUMNINUM%' OR item_code LIKE '%ALUMIN%'");
    console.log(sb);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
