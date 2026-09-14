const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3307,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  const [oi557] = await pool.query('SELECT * FROM order_items WHERE id = 557');
  console.log('order_items id 557:', oi557);

  const [oi296] = await pool.query('SELECT * FROM order_items WHERE id = 296');
  console.log('order_items id 296:', oi296);

  // Check what getItemBOMDetails(557) does!
  // In productionPlanService:
  // getItemBOMDetails takes (salesOrderItemId)
  const pps = require('./src/services/productionPlanService');
  console.log('Calling getItemBOMDetails(296)...');
  const bom296 = await pps.getItemBOMDetails(296);
  console.log('BOM details for 296:', JSON.stringify(bom296, null, 2));

  console.log('Calling getItemBOMDetails(557)...');
  const bom557 = await pps.getItemBOMDetails(557);
  console.log('BOM details for 557:', JSON.stringify(bom557, null, 2));

  await pool.end();
})().catch(console.error);
