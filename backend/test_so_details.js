const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });
const productionPlanService = require('./src/services/productionPlanService');

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3307,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('=== Order 188 ===');
  const soDetails188 = await productionPlanService.getSalesOrderFullDetails(188);
  console.log('soDetails188 items count:', soDetails188.items?.length);
  const matchItem188 = soDetails188.items?.find(i => i.drawing_no === '09000693103');
  console.log('Item 09000693103 in 188:', matchItem188);

  console.log('\n=== Order 202 ===');
  const soDetails202 = await productionPlanService.getSalesOrderFullDetails(202);
  console.log('soDetails202 items count:', soDetails202.items?.length);
  const matchItem202 = soDetails202.items?.find(i => i.drawing_no === '09000693103');
  console.log('Item 09000693103 in 202:', matchItem202);

  await pool.end();
})().catch(console.error);
