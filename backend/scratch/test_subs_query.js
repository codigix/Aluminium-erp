const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME
  });

  const [subAssemblies] = await pool.query(
    `SELECT ppsa.*, 
            COALESCE(
              MAX(soc.item_group), 
              (SELECT item_group FROM items WHERE item_code = ppsa.item_code LIMIT 1),
              ''
            ) as item_group
     FROM production_plan_sub_assemblies ppsa
     LEFT JOIN sales_order_item_components soc ON (
       (soc.component_code = ppsa.item_code OR soc.item_code = ppsa.item_code)
       AND soc.sales_order_item_id IN (SELECT sales_order_item_id FROM production_plan_items WHERE plan_id = ?)
     )
     WHERE ppsa.plan_id = ?
     GROUP BY ppsa.id`,
    [1513, 1513]
  );

  console.log('Total subAssemblies for 1513:', subAssemblies.length);
  const boList = subAssemblies.filter(sa => {
    const code = (sa.item_code || '').toUpperCase();
    const grp = (sa.item_group || '').toUpperCase();
    return code.startsWith('BO-') || grp.includes('BOUGHT');
  });
  console.log('Bought out items in 1513 subAssemblies:', boList.length);
  boList.forEach(b => console.log(`- ${b.item_code}: ${b.description} (group: ${b.item_group}, qty: ${b.required_qty})`));

  process.exit(0);
})();
