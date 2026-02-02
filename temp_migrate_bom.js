const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'backend',
    database: 'sales_erp'
  });

  const tables = [
    'sales_order_item_materials',
    'sales_order_item_components',
    'sales_order_item_operations',
    'sales_order_item_scrap'
  ];

  for (const table of tables) {
    try {
      console.log(`Migrating ${table}...`);
      await connection.query(`ALTER TABLE ${table} ADD COLUMN bom_type ENUM('FG', 'SUB_ASSEMBLY') DEFAULT 'FG'`);
      await connection.query(`ALTER TABLE ${table} ADD COLUMN assembly_id VARCHAR(100) NULL`);
      console.log(`Migrated ${table} successfully`);
    } catch (err) {
      if (err.code === 'ER_DUP_COLUMN_NAME') {
        console.log(`Columns already exist in ${table}`);
      } else {
        console.error(`Error migrating ${table}:`, err.message);
      }
    }
  }

  await connection.end();
}

migrate();
