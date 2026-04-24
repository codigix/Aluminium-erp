const pool = require('../config/db');

const getAllDrawings = async () => {
  const [rows] = await pool.query(
    `SELECT d.*, d.uploaded_by as uploader_name 
     FROM customer_drawings d
     ORDER BY d.created_at DESC`
  );
  return rows;
};

const listDrawings = async (search = '', onlyShared = false) => {
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
  const params = [];

  if (onlyShared) {
    query += ` AND d.status = 'SHARED'`;
  }

  if (search) {
    query += ` AND (d.client_name LIKE ? OR d.drawing_no LIKE ? OR d.description LIKE ?)`;
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  query += ` ORDER BY d.created_at DESC`;
  const [rows] = await pool.query(query, params);
  return rows;
};

const getDrawingRevisions = async (drawingNo) => {
  const [rows] = await pool.query(
    'SELECT * FROM customer_drawings WHERE drawing_no = ? ORDER BY revision DESC',
    [drawingNo]
  );
  return rows;
};

const updateDrawing = async (id, data) => {
  const { 
    description, revisionNo, drawingPdf, clientName, contactPerson, 
    phoneNumber, emailAddress, customerType, gstin, city, state, 
    billingAddress, shippingAddress, qty, remarks, drawingNo 
  } = data;

  let query = 'UPDATE customer_drawings SET ';
  const updates = [];
  const params = [];

  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (revisionNo !== undefined) { updates.push('revision = ?'); params.push(revisionNo); }
  if (drawingPdf !== undefined && drawingPdf !== null) { updates.push('file_path = ?'); params.push(drawingPdf); }
  if (clientName !== undefined) { updates.push('client_name = ?'); params.push(clientName); }
  if (contactPerson !== undefined) { updates.push('contact_person = ?'); params.push(contactPerson); }
  if (phoneNumber !== undefined) { updates.push('phone = ?'); params.push(phoneNumber); }
  if (emailAddress !== undefined) { updates.push('email = ?'); params.push(emailAddress); }
  if (customerType !== undefined) { updates.push('customer_type = ?'); params.push(customerType); }
  if (gstin !== undefined) { updates.push('gstin = ?'); params.push(gstin); }
  if (city !== undefined) { updates.push('city = ?'); params.push(city); }
  if (state !== undefined) { updates.push('state = ?'); params.push(state); }
  if (billingAddress !== undefined) { updates.push('billing_address = ?'); params.push(billingAddress); }
  if (shippingAddress !== undefined) { updates.push('shipping_address = ?'); params.push(shippingAddress); }
  if (qty !== undefined) { updates.push('qty = ?'); params.push(qty); }
  if (remarks !== undefined) { updates.push('remarks = ?'); params.push(remarks); }
  if (drawingNo !== undefined) { updates.push('drawing_no = ?'); params.push(drawingNo); }

  if (updates.length === 0) return;

  if (!id || id === 'undefined') {
    throw new Error('Drawing ID is required for update');
  }

  query += updates.join(', ') + ' WHERE id = ?';
  params.push(id);

  await pool.execute(query, params);
};

const updateItemDrawing = async (itemId, data) => {
  const { drawingNo, revisionNo, description, drawingPdf } = data;
  
  const updates = [];
  const params = [];

  if (drawingNo !== undefined) { updates.push('drawing_no = ?'); params.push(drawingNo); }
  if (revisionNo !== undefined) { updates.push('revision_no = ?'); params.push(revisionNo); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (drawingPdf !== undefined && drawingPdf !== null) { updates.push('drawing_pdf = ?'); params.push(drawingPdf); }

  if (updates.length === 0) return;

  const query = `UPDATE sales_order_items SET ${updates.join(', ')} WHERE id = ?`;
  params.push(itemId);

  await pool.execute(query, params);
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

    // 2. Handle Company/Requirement/Contact auto-creation
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

    // 2b. Create/Update Primary Contact
    if (contactPerson || phoneNumber || emailAddress) {
      const [contacts] = await connection.query(
        'SELECT id FROM contacts WHERE company_id = ? AND contact_type = "PRIMARY"',
        [companyId]
      );

      if (contacts.length === 0) {
        await connection.execute(
          'INSERT INTO contacts (company_id, name, email, phone, contact_type, status) VALUES (?, ?, ?, ?, "PRIMARY", "ACTIVE")',
          [companyId, contactPerson || 'Primary Contact', emailAddress || null, phoneNumber || null]
        );
      }
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

const createBatchCustomerDrawings = async (batchData) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let count = 0;

    for (const data of batchData) {
      const { 
        clientName, drawingNo, revision, qty, description, filePath, fileType, remarks, 
        uploadedBy, contactPerson, phoneNumber, emailAddress,
        customerType, gstin, city, state, billingAddress, shippingAddress
      } = data;

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

      // 2. Handle Company/Requirement/Contact auto-creation
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

      // 2b. Create/Update Primary Contact
      if (contactPerson || phoneNumber || emailAddress) {
        const [contacts] = await connection.query(
          'SELECT id FROM contacts WHERE company_id = ? AND contact_type = "PRIMARY"',
          [companyId]
        );

        if (contacts.length === 0) {
          await connection.execute(
            'INSERT INTO contacts (company_id, name, email, phone, contact_type, status) VALUES (?, ?, ?, ?, "PRIMARY", "ACTIVE")',
            [companyId, contactPerson || 'Primary Contact', emailAddress || null, phoneNumber || null]
          );
        }
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
      
      count++;
    }

    await connection.commit();
    return count;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const deleteCustomerDrawing = async (id) => {
  const [result] = await pool.execute('DELETE FROM customer_drawings WHERE id = ?', [id]);
  return result.affectedRows > 0;
};

const shareWithDesign = async (id) => {
  await pool.execute(
    "UPDATE customer_drawings SET status = 'SHARED', shared_with_design = 1, shared_at = CURRENT_TIMESTAMP WHERE id = ?",
    [id]
  );
};

const shareDrawingsBulk = async (ids) => {
  if (!ids || ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(",");
  await pool.execute(
    `UPDATE customer_drawings SET status = 'SHARED', shared_with_design = 1, shared_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
    ids
  );
};

const getApprovedDrawings = async () => {
  const [rows] = await pool.query(
    `SELECT 
       d.id as drawing_master_id,
       d.drawing_no,
       d.file_path,
       d.description as drawing_description,
       latest_bom.id as id,
       latest_bom.bom_cost, 
       latest_bom.item_group, 
       latest_bom.unit,
       latest_bom.description,
       latest_bom.item_code
     FROM customer_drawings d
     INNER JOIN (
       SELECT 
         id,
         drawing_no, 
         bom_cost, 
         item_group,
         unit,
         description,
         item_code
       FROM sales_order_items 
       WHERE id IN (
         SELECT MAX(id) 
         FROM sales_order_items 
         WHERE bom_cost > 0
         GROUP BY drawing_no, item_code
       )
     ) latest_bom ON d.drawing_no = latest_bom.drawing_no
     WHERE d.status = 'APPROVED' OR d.shared_with_design = 1
     ORDER BY d.created_at DESC`
  );
  return rows;
};

module.exports = {
  getAllDrawings,
  listDrawings,
  getDrawingRevisions,
  updateDrawing,
  updateItemDrawing,
  getDrawingsByClient,
  createCustomerDrawing,
  createBatchCustomerDrawings,
  deleteCustomerDrawing,
  shareWithDesign,
  shareDrawingsBulk,
  getApprovedDrawings
};
