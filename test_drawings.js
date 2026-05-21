const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

const bomService = require('./backend/src/services/bomService');

async function testDrawings() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'backend',
    database: process.env.DB_NAME || 'sales_erp'
  };

  const connection = await mysql.createConnection(config);
  try {
    const query = `
      SELECT 
        d.id as drawing_master_id,
        d.public_id,
        d.drawing_no,
        d.file_path,
        d.client_name,
        d.project_name,
        d.status as drawing_status,
        d.status as status,
        d.description as drawing_description,
        d.drawing_type,
        d.qty,
        d.revision,
        soi.id as sales_order_item_id,
        soi.bom_cost as bom_cost,
        soi.item_group as item_group,
        soi.unit as unit,
        soi.item_code as item_code
      FROM customer_drawings d
      LEFT JOIN (
        SELECT s1.*
        FROM sales_order_items s1
        INNER JOIN (
          SELECT COALESCE(drawing_id, 0) as dwg_id, drawing_no as dwg_no, MAX(id) as max_id
          FROM sales_order_items
          GROUP BY dwg_id, dwg_no
        ) s2 ON (COALESCE(s1.drawing_id, 0) = s2.dwg_id AND s1.drawing_no = s2.dwg_no AND s1.id = s2.max_id)
      ) soi ON (d.id = soi.drawing_id OR (soi.drawing_id IS NULL AND d.drawing_no = soi.drawing_no))
      WHERE d.client_name = 'GALLARY'
    `;
    const [rows] = await connection.query(query);
    console.log('--- GALLARY Drawings ---');
    for (const r of rows) {
      console.log(`Master ID: ${r.drawing_master_id}, Drawing No: ${r.drawing_no}, Group: ${r.item_group}, Cost: ${r.bom_cost}, SOI ID: ${r.sales_order_item_id}`);
      if (r.sales_order_item_id || r.item_code || r.drawing_no) {
        const components = await bomService.getItemComponents(r.sales_order_item_id, r.item_code, r.drawing_no);
        console.log(`Components count: ${components.length}`);
        for (const c of components) {
          console.log(`  Code: ${c.component_code}, Desc: ${c.description}, Group: ${c.item_group}, Rate/ValRate/Cost: ${c.rate} / ${c.valuation_rate} / ${c.bom_cost}, Qty: ${c.quantity}`);
        }
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

testDrawings();
