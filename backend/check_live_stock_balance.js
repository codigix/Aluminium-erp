const pool = require('./src/config/db');

async function check() {
  const [rows] = await pool.query(
    `SELECT id, item_code, material_name, length, width, thickness, outer_diameter, current_balance, warehouse 
     FROM stock_balance 
     WHERE item_code IN ('RM-ALUMINUMSH-0001', 'RM-ALUMINUMSQ-0001') 
     ORDER BY item_code, length`
  );
  console.log('--- LIVE STOCK BALANCE RECORDS ---');
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

check();
