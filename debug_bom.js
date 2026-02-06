const mysql = require('mysql2/promise');

async function debug() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'backend',
    database: 'sales_erp'
  });

  const [items] = await connection.execute('SELECT item_code, item_type FROM items');
  console.log('--- Items ---');
  items.forEach(i => console.log(`${i.item_code}: ${i.item_type}`));

  const [soMaterials] = await connection.execute('SELECT * FROM sales_order_item_materials');
  console.log('\n--- Sales Order Item Materials ---');
  soMaterials.forEach(m => console.log(`ID: ${m.id}, SO_ITEM_ID: ${m.sales_order_item_id}, Item: ${m.material_name}, Code: ${m.material_code}, Parent: ${m.parent_id}`));

  const [soComponents] = await connection.execute('SELECT * FROM sales_order_item_components');
  console.log('\n--- Sales Order Item Components ---');
  soComponents.forEach(c => console.log(`ID: ${c.id}, SO_ITEM_ID: ${c.sales_order_item_id}, Item: ${c.component_name}, Code: ${c.component_code}, Parent: ${c.parent_id}, Type: ${c.item_type}`));

  await connection.end();
}

debug();
