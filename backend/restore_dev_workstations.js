const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function restoreSelectedWorkstationsInDevDb() {
  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'aluminium_user',
    password: process.env.DB_PASSWORD || 'C0digix$309',
    port: Number(process.env.DB_PORT || 3307),
    database: 'spTech_dev'
  };
  const conn = await mysql.createConnection(config);

  console.log('--- RESTORING BOM SPECIFIC WORKSTATIONS IN DEV DB FROM PROD DB ---');

  // Copy sales_order_item_operations workstation column values directly from spTech_prod
  const [prodBomOps] = await conn.query('SELECT id, workstation FROM `spTech_prod`.`sales_order_item_operations`');
  console.log('Found ' + prodBomOps.length + ' BOM operations in spTech_prod');

  for (const op of prodBomOps) {
    if (op.workstation) {
      await conn.query('UPDATE `spTech_dev`.`sales_order_item_operations` SET workstation = ? WHERE id = ?', [op.workstation, op.id]);
    }
  }

  // Copy production_plan_operations workstation column values directly from spTech_prod
  const [prodPlanOps] = await conn.query('SELECT id, workstation FROM `spTech_prod`.`production_plan_operations`');
  console.log('Found ' + prodPlanOps.length + ' plan operations in spTech_prod');

  for (const op of prodPlanOps) {
    if (op.workstation) {
      await conn.query('UPDATE `spTech_dev`.`production_plan_operations` SET workstation = ? WHERE id = ?', [op.workstation, op.id]);
    }
  }

  console.log('--- RESTORE COMPLETE ---');
  await conn.end();
}

restoreSelectedWorkstationsInDevDb().catch(err => console.error(err));
