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
  const { 
    clientName, drawingNo, revision, qty, description, filePath, fileType, remarks, 
    uploadedBy, contactPerson, phoneNumber, emailAddress,
    customerType, gstin, city, state, billingAddress, shippingAddress
  } = data;
  const [result] = await pool.execute(
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
    d.uploadedBy || 'Sales',
    d.contactPerson || null,
    d.phoneNumber || null,
    d.emailAddress || null,
    d.customerType || null,
    d.gstin || null,
    d.city || null,
    d.state || null,
    d.billingAddress || null,
    d.shippingAddress || null
  ]);

  const [result] = await pool.query(
    `INSERT INTO customer_drawings 
      (client_name, drawing_no, revision, qty, description, file_path, file_type, remarks, 
       uploaded_by, contact_person, phone, email,
       customer_type, gstin, city, state, billing_address, shipping_address)
     VALUES ?`,
    [values]
  );
  return result.affectedRows;
};

const deleteCustomerDrawing = async (id) => {
  await pool.execute('DELETE FROM customer_drawings WHERE id = ?', [id]);
};

const shareWithDesign = async (id) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    await connection.execute('UPDATE customer_drawings SET status = "SHARED" WHERE id = ?', [id]);
    
    const [drawings] = await connection.query('SELECT * FROM customer_drawings WHERE id = ?', [id]);
    if (!drawings.length) throw new Error('Drawing not found');
    
    const drawing = drawings[0];
    
    const [companies] = await connection.query(
      'SELECT id FROM companies WHERE company_name = ?',
      [drawing.client_name]
    );
    
    let companyId;
    if (companies.length > 0) {
      companyId = companies[0].id;
      // Sync metadata if existing company
      if (drawing.gstin || drawing.customer_type) {
        await connection.execute(
          'UPDATE companies SET gstin = COALESCE(?, gstin), customer_type = COALESCE(?, customer_type) WHERE id = ?',
          [drawing.gstin || null, drawing.customer_type || null, companyId]
        );
      }
    } else {
      const [companyResult] = await connection.execute(
        'INSERT INTO companies (company_name, company_code, status, gstin, customer_type) VALUES (?, ?, ?, ?, ?)',
        [drawing.client_name, drawing.client_name.replace(/\s+/g, '_').toUpperCase(), 'ACTIVE', drawing.gstin || null, drawing.customer_type || null]
      );
      companyId = companyResult.insertId;
    }
    
    // Sync Address (Billing)
    if (drawing.city || drawing.state || drawing.billing_address) {
      const [existingAddr] = await connection.query(
        'SELECT id FROM company_addresses WHERE company_id = ? AND address_type = "BILLING" LIMIT 1',
        [companyId]
      );
      if (existingAddr.length === 0) {
        await connection.execute(
          'INSERT INTO company_addresses (company_id, address_type, line1, city, state) VALUES (?, ?, ?, ?, ?)',
          [companyId, 'BILLING', drawing.billing_address || 'Reference Address', drawing.city || 'NA', drawing.state || 'NA']
        );
      }
    }
    
    // Sync Address (Shipping)
    if (drawing.shipping_address) {
      const [existingAddr] = await connection.query(
        'SELECT id FROM company_addresses WHERE company_id = ? AND address_type = "SHIPPING" LIMIT 1',
        [companyId]
      );
      if (existingAddr.length === 0) {
        await connection.execute(
          'INSERT INTO company_addresses (company_id, address_type, line1, city, state) VALUES (?, ?, ?, ?, ?)',
          [companyId, 'SHIPPING', drawing.shipping_address, drawing.city || 'NA', drawing.state || 'NA']
        );
      }
    }
    
    if (drawing.email || drawing.phone || drawing.contact_person) {
      const [existingContact] = await connection.query(
        'SELECT id FROM contacts WHERE company_id = ? AND contact_type = "PRIMARY" LIMIT 1',
        [companyId]
      );
      
      if (existingContact.length === 0) {
        await connection.execute(
          'INSERT INTO contacts (company_id, name, email, phone, contact_type, status) VALUES (?, ?, ?, ?, ?, ?)',
          [companyId, drawing.contact_person || drawing.client_name, drawing.email || null, drawing.phone || null, 'PRIMARY', 'ACTIVE']
        );
      }
    }

    // 5. Create Sales Order for Design Review
    const [soResult] = await connection.execute(
      `INSERT INTO sales_orders (customer_po_id, company_id, project_name, drawing_required, production_priority, status, current_department, request_accepted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [null, companyId, `Design Review - Drawing ${drawing.drawing_no} for ${drawing.client_name}`, 1, 'NORMAL', 'CREATED', 'DESIGN_ENG', 0]
    );
    const salesOrderId = soResult.insertId;

    // 6. Create Sales Order Item
    await connection.execute(
      `INSERT INTO sales_order_items (sales_order_id, drawing_no, drawing_id, revision_no, drawing_pdf, description, quantity, unit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [salesOrderId, drawing.drawing_no, drawing.id, drawing.revision || '0', drawing.file_path, drawing.description || 'Customer Drawing', drawing.qty || 1, 'NOS']
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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

const updateDrawing = async (id, data) => {
  const { 
    description, 
    revisionNo, 
    drawingPdf,
    clientName,
    contactPerson,
    phoneNumber,
    emailAddress,
    qty,
    remarks,
    drawingNo,
    customerType,
    gstin,
    city,
    state,
    billingAddress,
    shippingAddress
  } = data;

  // 1. Update customer_drawings
  let query = 'UPDATE customer_drawings SET ';
  const params = [];
  const updates = [];

  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (revisionNo !== undefined) { updates.push('revision = ?'); params.push(revisionNo); }
  if (drawingPdf !== undefined && drawingPdf !== null) { updates.push('file_path = ?'); params.push(drawingPdf); }
  if (clientName !== undefined) { updates.push('client_name = ?'); params.push(clientName); }
  if (contactPerson !== undefined) { updates.push('contact_person = ?'); params.push(contactPerson); }
  if (phoneNumber !== undefined) { updates.push('phone = ?'); params.push(phoneNumber); }
  if (emailAddress !== undefined) { updates.push('email = ?'); params.push(emailAddress); }
  if (qty !== undefined) { updates.push('qty = ?'); params.push(qty); }
  if (remarks !== undefined) { updates.push('remarks = ?'); params.push(remarks); }
  if (drawingNo !== undefined) { updates.push('drawing_no = ?'); params.push(drawingNo); }
  if (customerType !== undefined) { updates.push('customer_type = ?'); params.push(customerType); }
  if (gstin !== undefined) { updates.push('gstin = ?'); params.push(gstin); }
  if (city !== undefined) { updates.push('city = ?'); params.push(city); }
  if (state !== undefined) { updates.push('state = ?'); params.push(state); }
  if (billingAddress !== undefined) { updates.push('billing_address = ?'); params.push(billingAddress); }
  if (shippingAddress !== undefined) { updates.push('shipping_address = ?'); params.push(shippingAddress); }

  if (updates.length === 0) return;

  query += updates.join(', ');
  query += ' WHERE id = ?';
  params.push(id);

  await pool.execute(query, params);

  // 2. Sync with sales_order_items if they exist
  let soiQuery = 'UPDATE sales_order_items SET updated_at = CURRENT_TIMESTAMP';
  const soiParams = [];
  const soiUpdates = [];
  
  if (description !== undefined) { soiUpdates.push('description = ?'); soiParams.push(description); }
  if (revisionNo !== undefined) { soiUpdates.push('revision_no = ?'); soiParams.push(revisionNo); }
  if (drawingPdf !== undefined && drawingPdf !== null) { soiUpdates.push('drawing_pdf = ?'); soiParams.push(drawingPdf); }
  if (drawingNo !== undefined) { soiUpdates.push('drawing_no = ?'); soiParams.push(drawingNo); }
  if (qty !== undefined) { soiUpdates.push('quantity = ?'); soiParams.push(qty); }

  if (soiUpdates.length > 0) {
    soiQuery = 'UPDATE sales_order_items SET ' + soiUpdates.join(', ') + ' WHERE drawing_id = ?';
    soiParams.push(id);
    await pool.execute(soiQuery, soiParams);
  }
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

const shareDrawingsBulk = async (ids) => {
  if (!ids || ids.length === 0) return;
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // 1. Mark all drawings as SHARED
    const placeholders = ids.map(() => '?').join(',');
    await connection.execute(`UPDATE customer_drawings SET status = "SHARED" WHERE id IN (${placeholders})`, ids);
    
    // 2. Fetch all drawing details
    const [drawings] = await connection.query(`SELECT * FROM customer_drawings WHERE id IN (${placeholders})`, ids);
    if (!drawings.length) throw new Error('Drawings not found');
    
    // Group drawings by client (just in case they are from different clients, though usually they won't be)
    const drawingsByClient = drawings.reduce((acc, d) => {
      if (!acc[d.client_name]) acc[d.client_name] = [];
      acc[d.client_name].push(d);
      return acc;
    }, {});

    for (const [clientName, clientDrawings] of Object.entries(drawingsByClient)) {
      // 3. Handle Company
      const [companies] = await connection.query(
        'SELECT id FROM companies WHERE company_name = ?',
        [clientName]
      );
      
      let companyId;
      if (companies.length > 0) {
        companyId = companies[0].id;
        // Sync metadata if existing company from first drawing that has it
        const withMeta = clientDrawings.find(d => d.gstin || d.customer_type);
        if (withMeta) {
          await connection.execute(
            'UPDATE companies SET gstin = COALESCE(?, gstin), customer_type = COALESCE(?, customer_type) WHERE id = ?',
            [withMeta.gstin || null, withMeta.customer_type || null, companyId]
          );
        }
      } else {
        const withMeta = clientDrawings.find(d => d.gstin || d.customer_type) || clientDrawings[0];
        const [companyResult] = await connection.execute(
          'INSERT INTO companies (company_name, company_code, status, gstin, customer_type) VALUES (?, ?, ?, ?, ?)',
          [clientName, clientName.replace(/\s+/g, '_').toUpperCase(), 'ACTIVE', withMeta.gstin || null, withMeta.customer_type || null]
        );
        companyId = companyResult.insertId;
      }
      
      // Sync Address (Billing) from first drawing that has it
      const withBilling = clientDrawings.find(d => d.city || d.state || d.billing_address);
      if (withBilling) {
        const [existingAddr] = await connection.query(
          'SELECT id FROM company_addresses WHERE company_id = ? AND address_type = "BILLING" LIMIT 1',
          [companyId]
        );
        if (existingAddr.length === 0) {
          await connection.execute(
            'INSERT INTO company_addresses (company_id, address_type, line1, city, state) VALUES (?, ?, ?, ?, ?)',
            [companyId, 'BILLING', withBilling.billing_address || 'Reference Address', withBilling.city || 'NA', withBilling.state || 'NA']
          );
        }
      }
      
      // Sync Address (Shipping)
      const withShipping = clientDrawings.find(d => d.shipping_address);
      if (withShipping) {
        const [existingAddr] = await connection.query(
          'SELECT id FROM company_addresses WHERE company_id = ? AND address_type = "SHIPPING" LIMIT 1',
          [companyId]
        );
        if (existingAddr.length === 0) {
          await connection.execute(
            'INSERT INTO company_addresses (company_id, address_type, line1, city, state) VALUES (?, ?, ?, ?, ?)',
            [companyId, 'SHIPPING', withShipping.shipping_address, withShipping.city || 'NA', withShipping.state || 'NA']
          );
        }
      }
      
      // 4. Handle primary contact from first drawing that has contact info
      const firstWithContact = clientDrawings.find(d => d.email || d.phone || d.contact_person) || clientDrawings[0];
      if (firstWithContact.email || firstWithContact.phone || firstWithContact.contact_person) {
        const [existingContact] = await connection.query(
          'SELECT id FROM contacts WHERE company_id = ? AND contact_type = "PRIMARY" LIMIT 1',
          [companyId]
        );
        
        if (existingContact.length === 0) {
          await connection.execute(
            'INSERT INTO contacts (company_id, name, email, phone, contact_type, status) VALUES (?, ?, ?, ?, ?, ?)',
            [companyId, firstWithContact.contact_person || clientName, firstWithContact.email || null, firstWithContact.phone || null, 'PRIMARY', 'ACTIVE']
          );
        }
      }

      // 5. Create Sales Order for Design Review (Bulk)
      const [soResult] = await connection.execute(
        `INSERT INTO sales_orders (customer_po_id, company_id, project_name, drawing_required, production_priority, status, current_department, request_accepted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [null, companyId, `Design Review - ${clientDrawings.length} Drawings for ${clientName}`, 1, 'NORMAL', 'CREATED', 'DESIGN_ENG', 0]
      );
      const salesOrderId = soResult.insertId;

      // 6. Create Sales Order Items
      for (const drawing of clientDrawings) {
        await connection.execute(
          `INSERT INTO sales_order_items (sales_order_id, drawing_no, drawing_id, revision_no, drawing_pdf, description, quantity, unit)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [salesOrderId, drawing.drawing_no, drawing.id, drawing.revision || '0', drawing.file_path, drawing.description || 'Customer Drawing', drawing.qty || 1, 'NOS']
        );
      }
    }
    
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  listDrawings,
  getDrawingRevisions,
  updateDrawing,
  updateItemDrawing,
  createCustomerDrawing,
  createBatchCustomerDrawings,
  deleteCustomerDrawing,
  shareWithDesign,
  shareDrawingsBulk
};
