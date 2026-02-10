
const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'backend',
    database: 'sales_erp'
  });

  try {
    const [columns] = await connection.query('DESC sales_order_item_materials');
    console.log('Columns in sales_order_item_materials:', columns.map(c => c.Field));

    const [rows] = await connection.query('SELECT * FROM sales_order_item_materials LIMIT 5');
    console.log('Sample rows:', JSON.stringify(rows, null, 2));
    
    const [planMaterials] = await connection.query('SELECT * FROM production_plan_materials LIMIT 5');
    console.log('Sample production_plan_materials:', JSON.stringify(planMaterials, null, 2));

  } catch (error) {
    console.error(error);
  } finally {
    await connection.end();
  }
}

main();
