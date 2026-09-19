const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });
const productionPlanService = require('./src/services/productionPlanService');

(async () => {
  const ready = await productionPlanService.getReadySalesOrderItems();
  const ready188 = ready.filter(r => r.sales_order_id === 188 || r.order_no === 'ORD26-07-2026-003');
  console.log('ready188 items:', ready188);

  const ready202 = ready.filter(r => r.sales_order_id === 202 || r.order_no === 'ORD14-09-2026-001');
  console.log('ready202 items matching 09000693103:', ready202.filter(r => r.drawing_no === '09000693103'));

  await pool.end();
})().catch(console.error);
