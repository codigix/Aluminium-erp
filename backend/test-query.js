const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'backend/.env' });

async function check() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
  });

  try {
    const onlyShared = true;
    let query = `
      SELECT 
        d.id,
        d.id as drawing_master_id,
        d.drawing_no,
        d.file_path,
        d.client_name,
        d.status as drawing_status,
        d.description as drawing_description,
        d.uploaded_by as uploader_name,
        d.created_at as updated_at,
        soi.id as id,
        soi.id as sales_order_item_id,
        soi.status as item_status,
        soi.sales_order_id,
        soi.description as item_description,
        soi.bom_cost,
        soi.item_group,
        soi.unit
      FROM customer_drawings d
      LEFT JOIN (
        SELECT s1.id, s1.drawing_no, s1.status, s1.sales_order_id, s1.description, s1.bom_cost, s1.item_group, s1.unit
        FROM sales_order_items s1
        INNER JOIN (
          SELECT drawing_no, MAX(id) as max_id
          FROM sales_order_items
          GROUP BY drawing_no
        ) s2 ON s1.id = s2.max_id
      ) soi ON d.drawing_no = soi.drawing_no
      WHERE 1=1
    `;
    if (onlyShared) {
      query += " AND d.status = 'SHARED'";
    }
    
    const [rows] = await connection.query(query);
    console.log('Result length:', rows.length);
    console.log('Results:', JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

check();
