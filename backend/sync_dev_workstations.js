const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function syncWorkstationsInDevDb() {
  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'aluminium_user',
    password: process.env.DB_PASSWORD || 'C0digix$309',
    port: Number(process.env.DB_PORT || 3307),
    database: 'spTech_dev'
  };
  const conn = await mysql.createConnection(config);

  console.log('--- STARTING WORKSTATION UPDATE FOR EXISTING BOM OPERATIONS IN DEV DB ---');

  // Alter column length on sales_order_item_operations and production_plan_operations if needed
  try {
    await conn.query('ALTER TABLE `sales_order_item_operations` MODIFY COLUMN `workstation` VARCHAR(500)');
    await conn.query('ALTER TABLE `production_plan_operations` MODIFY COLUMN `workstation` VARCHAR(500)');
    console.log('Successfully expanded workstation column size to VARCHAR(500) in dev DB');
  } catch(e) {
    console.log('Column alter note:', e.message);
  }

  // Fetch all master operation -> workstations mapping
  const [masterMap] = await conn.query(`
    SELECT o.operation_name, GROUP_CONCAT(w.workstation_name SEPARATOR ', ') as ws_names, GROUP_CONCAT(w.workstation_code SEPARATOR ', ') as ws_codes
    FROM operations o
    JOIN operation_workstations ow ON o.id = ow.operation_id
    JOIN workstations w ON ow.workstation_id = w.id
    GROUP BY o.id
  `);

  for (const mapping of masterMap) {
    const opName = mapping.operation_name.trim();
    const wsDisplay = mapping.ws_names || mapping.ws_codes;

    if (!wsDisplay) continue;

    // Update sales_order_item_operations
    const [res1] = await conn.query(
      `UPDATE sales_order_item_operations 
       SET workstation = ? 
       WHERE LOWER(TRIM(operation_name)) = LOWER(?)`,
      [wsDisplay, opName]
    );
    console.log(`Updated sales_order_item_operations for operation "${opName}" -> "${wsDisplay}": ${res1.affectedRows} rows updated`);

    // Update production_plan_operations
    const [res2] = await conn.query(
      `UPDATE production_plan_operations 
       SET workstation = ? 
       WHERE LOWER(TRIM(operation_name)) = LOWER(?)`,
      [wsDisplay, opName]
    );
    console.log(`Updated production_plan_operations for operation "${opName}" -> "${wsDisplay}": ${res2.affectedRows} rows updated`);
  }

  console.log('--- WORKSTATION SYNC COMPLETE ---');
  await conn.end();
}

syncWorkstationsInDevDb().catch(err => console.error(err));
