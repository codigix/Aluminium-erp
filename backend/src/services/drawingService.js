const pool = require('../config/db');

const listDrawings = async (searchTerm = '') => {
  let query = `
    SELECT DISTINCT 
      drawing_no, 
      revision_no, 
      description, 
      drawing_pdf,
      item_code,
      MAX(created_at) as last_used_at,
      sales_order_id
    FROM sales_order_items
    WHERE drawing_no IS NOT NULL AND drawing_no != ''
  `;
  const params = [];

  if (searchTerm) {
    query += ' AND (drawing_no LIKE ? OR description LIKE ? OR item_code LIKE ?)';
    params.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
  }

  query += ' GROUP BY drawing_no, revision_no, description, drawing_pdf, item_code, sales_order_id ORDER BY last_used_at DESC';

  const [rows] = await pool.query(query, params);
  return rows;
};

const getDrawingRevisions = async (drawingNo) => {
  const [rows] = await pool.query(
    `SELECT 
      revision_no, 
      drawing_pdf, 
      description, 
      created_at,
      sales_order_id
     FROM sales_order_items 
     WHERE drawing_no = ? 
     ORDER BY created_at DESC`,
    [drawingNo]
  );
  return rows;
};

module.exports = {
  listDrawings,
  getDrawingRevisions
};
