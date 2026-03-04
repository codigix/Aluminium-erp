const mysql = require('./backend/node_modules/mysql2/promise');
(async () => {
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'backend',
      database: 'sales_erp'
    });
    
    const [columns] = await conn.query('DESCRIBE sales_order_item_materials');
    console.log('\n--- SCHEMA (sales_order_item_materials) ---');
    columns.forEach(c => console.log(`${c.Field}: ${c.Type}`));

    const [plans] = await conn.query('SELECT * FROM production_plans ORDER BY id DESC LIMIT 1');
    if (plans.length > 0) {
      const plan = plans[0];
      console.log('\n--- PLAN ---');
      console.log('ID:', plan.id, 'CODE:', plan.plan_code);
      
      const [materials] = await conn.query('SELECT * FROM production_plan_materials WHERE plan_id = ?', [plan.id]);
      console.log('\n--- MATERIALS (production_plan_materials) ---');
      materials.forEach(m => console.log(`Code: ${m.item_code}, Name: ${m.material_name}, Qty: ${m.required_qty}, Cat: ${m.material_category}`));
      
      const [rawMaterials] = await conn.query('SELECT * FROM sales_order_item_materials LIMIT 5');
      console.log('\n--- DATA (sales_order_item_materials sample) ---');
      rawMaterials.forEach(m => console.log(JSON.stringify(m)));
      
    } else {
      console.log('No plans found');
    }
    await conn.end();
  } catch (err) {
    console.error(err);
  }
})();
