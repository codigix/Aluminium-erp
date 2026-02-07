const mysql = require('mysql2/promise');
async function run() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'backend',
    database: 'sales_erp'
  });
  const [rows] = await connection.query('DESCRIBE production_plan_items');
  console.log('production_plan_items:', rows.map(r => ({Field: r.Field, Null: r.Null})));
  const [rows2] = await connection.query('DESCRIBE production_plan_sub_assemblies');
  console.log('production_plan_sub_assemblies:', rows2.map(r => ({Field: r.Field, Null: r.Null})));
  const [rows3] = await connection.query('DESCRIBE production_plan_operations');
  console.log('production_plan_operations:', rows3.map(r => ({Field: r.Field, Null: r.Null})));
  process.exit(0);
}
run().catch(err => {
  console.error(err);
  process.exit(1);
});
