const pool = require('../config/db');

const listDrawings = async (searchTerm = '') => {
  let query = `
    SELECT * FROM customer_drawings WHERE 1=1
  `;
  const params = [];

  if (searchTerm) {
    query += ' AND (drawing_no LIKE ? OR description LIKE ? OR remarks LIKE ? OR client_name LIKE ?)';
    params.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
  }

  query += ' ORDER BY created_at DESC';

  const [rows] = await pool.query(query, params);
  return rows;
};

const createCustomerDrawing = async (data) => {
  const { clientName, drawingNo, revision, qty, description, filePath, fileType, remarks, uploadedBy } = data;
  const [result] = await pool.execute(
    `INSERT INTO customer_drawings 
      (client_name, drawing_no, revision, qty, description, file_path, file_type, remarks, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ,
    [clientName || null, drawingNo, revision || null, qty || 1, description || null, filePath, fileType, remarks || null, uploadedBy || 'Sales']
  );
  return result.insertId;
};

const createBatchCustomerDrawings = async (drawings) => {
  if (!drawings || drawings.length === 0) return 0;
  
  const values = drawings.map(d => [
    d.clientName || null,
    d.drawingNo, 
    d.revision || null, 
    d.qty || 1,
    d.description || null, 
    d.filePath, 
    d.fileType, 
    d.remarks || null, 
    d.uploadedBy || 'Sales'
  ]);

  const [result] = await pool.query(
    `INSERT INTO customer_drawings 
      (client_name, drawing_no, revision, qty, description, file_path, file_type, remarks, uploaded_by)
     VALUES ?`,
    [values]
  );
  return result.affectedRows;
};

const deleteCustomerDrawing = async (id) => {
  await pool.execute('DELETE FROM customer_drawings WHERE id = ?', [id]);
};

const shareWithDesign = async (id) => {
  await pool.execute('UPDATE customer_drawings SET status = "SHARED" WHERE id = ?', [id]);
};

const getDrawingRevisions = async (drawingNo) => {
  const [rows] = await pool.query(
    `SELECT 
      soi.revision_no, 
      soi.drawing_pdf, 
      soi.description, 
      soi.created_at,
      soi.sales_order_id,
      cp.po_number
     FROM sales_order_items soi
     LEFT JOIN sales_orders so ON so.id = soi.sales_order_id
     LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
     WHERE soi.drawing_no = ? 
     ORDER BY soi.created_at DESC`,
    [drawingNo]
  );
  return rows;
};

const updateDrawing = async (drawingNo, data) => {
  const { description, revisionNo, drawingPdf } = data;
  let query = 'UPDATE sales_order_items SET updated_at = CURRENT_TIMESTAMP';
  const params = [];

  if (description) {
    query += ', description = ?';
    params.push(description);
  }
  if (revisionNo) {
    query += ', revision_no = ?';
    params.push(revisionNo);
  }
  if (drawingPdf) {
    query += ', drawing_pdf = ?';
    params.push(drawingPdf);
  }

  query += ' WHERE drawing_no = ?';
  params.push(drawingNo);

  await pool.execute(query, params);
};

const updateItemDrawing = async (itemId, data) => {
  const { drawingNo, revisionNo, description, drawingPdf } = data;
  let query = 'UPDATE sales_order_items SET updated_at = CURRENT_TIMESTAMP';
  const params = [];

  if (drawingNo !== undefined) {
    query += ', drawing_no = ?';
    params.push(drawingNo);
  }
  if (revisionNo !== undefined) {
    query += ', revision_no = ?';
    params.push(revisionNo);
  }
  if (description !== undefined) {
    query += ', description = ?';
    params.push(description);
  }
  if (drawingPdf) {
    query += ', drawing_pdf = ?';
    params.push(drawingPdf);
  }

  query += ' WHERE id = ?';
  params.push(itemId);

  await pool.execute(query, params);
};

module.exports = {
  listDrawings,
  getDrawingRevisions,
  updateDrawing,
  updateItemDrawing,
  createCustomerDrawing,
  createBatchCustomerDrawings,
  deleteCustomerDrawing,
  shareWithDesign
};
