const pool = require('../config/db');

const getAllDrawings = async () => {
  const [rows] = await pool.query(
    `SELECT d.*, u.full_name as uploader_name 
     FROM customer_drawings d
     LEFT JOIN users u ON d.uploaded_by = u.id
     ORDER BY d.created_at DESC`
  );
  return rows;
};

const getDrawingsByClient = async (clientName) => {
  const [rows] = await pool.query(
    'SELECT * FROM customer_drawings WHERE client_name = ? ORDER BY created_at DESC',
    [clientName]
  );
  return rows;
};

const createCustomerDrawing = async (data) => {
  const { 
    clientName, drawingNo, revision, qty, description, filePath, fileType, remarks, 
    uploadedBy, contactPerson, phoneNumber, emailAddress,
    customerType, gstin, city, state, billingAddress, shippingAddress
  } = data;
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Insert into customer_drawings
    const [result] = await connection.execute(
      `INSERT INTO customer_drawings 
        (client_name, drawing_no, revision, qty, description, file_path, file_type, remarks, 
         uploaded_by, contact_person, phone, email, 
         customer_type, gstin, city, state, billing_address, shipping_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ,
      [
        clientName || null, drawingNo, revision || null, qty || 1, description || null, filePath, fileType, remarks || null, 
        uploadedBy || 'Sales', contactPerson || null, phoneNumber || null, emailAddress || null,
        customerType || null, gstin || null, city || null, state || null, billingAddress || null, shippingAddress || null
      ]
    );
    const drawingId = result.insertId;

    // 2. Handle Company/Requirement auto-creation so it shows up in "Client Requirements"
    const [companies] = await connection.query(
      'SELECT id FROM companies WHERE company_name = ?',
      [clientName]
    );
    
    let companyId;
    if (companies.length > 0) {
      companyId = companies[0].id;
    } else {
      const [companyResult] = await connection.execute(
        'INSERT INTO companies (company_name, company_code, status, gstin, customer_type) VALUES (?, ?, ?, ?, ?)',
        [clientName, clientName.replace(/\s+/g, '_').toUpperCase(), 'ACTIVE', gstin || null, customerType || null]
      );
      companyId = companyResult.insertId;
    }

    // 3. Create Sales Order Requirement
    const [soResult] = await connection.execute(
      `INSERT INTO sales_orders (company_id, project_name, drawing_required, production_priority, status, current_department, request_accepted)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [companyId, `Design Review - Drawing ${drawingNo} for ${clientName}`, 1, 'NORMAL', 'CREATED', 'SALES', 0]
    );
    const salesOrderId = soResult.insertId;

    // 4. Create Sales Order Item
    await connection.execute(
      `INSERT INTO sales_order_items (sales_order_id, drawing_no, drawing_id, revision_no, drawing_pdf, description, quantity, unit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [salesOrderId, drawingNo, drawingId, revision || '0', filePath, description || 'Customer Drawing', qty || 1, 'NOS']
    );

    await connection.commit();
    return drawingId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const deleteDrawing = async (id) => {
  const [result] = await pool.execute('DELETE FROM customer_drawings WHERE id = ?', [id]);
  return result.affectedRows > 0;
};

module.exports = {
  getAllDrawings,
  getDrawingsByClient,
  createCustomerDrawing,
  deleteDrawing
};
