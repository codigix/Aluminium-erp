const pool = require('../config/db');
const bomService = require('./bomService');

const getAllDrawings = async () => {
  const [rows] = await pool.query(
    `SELECT d.*, d.uploaded_by as uploader_name 
     FROM customer_drawings d
     ORDER BY d.updated_at DESC, d.created_at DESC`
  );
  return rows;
};

const listDrawings = async (search = '', onlyShared = false, clientName = null) => {
  let query = `
    SELECT 
      MAX(d.id) as drawing_master_id,
      d.drawing_no,
      MAX(d.file_path) as file_path,
      d.client_name,
      MAX(d.project_name) as project_name,
      MAX(d.status) as status,
      MAX(d.status) as drawing_status,
      MAX(d.description) as drawing_description,
      MAX(d.uploaded_by) as uploader_name,
      MAX(d.created_at) as updated_at,
      MAX(d.qty) as qty,
      d.revision,
      MAX(d.remarks) as remarks,
      MAX(d.contact_person) as contact_person,
      MAX(d.phone) as phone,
      MAX(d.email) as email,
      MAX(d.customer_type) as customer_type,
      MAX(d.gstin) as gstin,
      MAX(d.city) as city,
      MAX(d.state) as state,
      MAX(d.billing_address) as billing_address,
      MAX(d.shipping_address) as shipping_address,
      MAX(d.excel_path) as excel_path,
      MAX(d.zip_path) as zip_path,
      MAX(soi.id) as sales_order_item_id,
      MAX(soi.status) as item_status,
      MAX(soi.sales_order_id) as sales_order_id,
      MAX(soi.description) as item_description,
      MAX(soi.bom_cost) as bom_cost,
      MAX(soi.item_group) as item_group,
      MAX(soi.unit) as unit,
      MAX(soi.item_code) as item_code
    FROM customer_drawings d
    LEFT JOIN (
      SELECT s1.id, s1.drawing_no, s1.status, s1.sales_order_id, s1.description, s1.bom_cost, s1.item_group, s1.unit, s1.drawing_id, s1.item_code
      FROM sales_order_items s1
      INNER JOIN (
        SELECT COALESCE(drawing_id, drawing_no) as identifier, MAX(id) as max_id
        FROM sales_order_items
        GROUP BY identifier
      ) s2 ON s1.id = s2.max_id
    ) soi ON (d.id = soi.drawing_id OR (soi.drawing_id IS NULL AND d.drawing_no = soi.drawing_no))
    WHERE 1=1
  `;
  const params = [];

  if (onlyShared) {
    // Show drawings that are either explicitly SHARED or have an associated sales order item (meaning they are in progress)
    // DESIGN_IN_REVIEW is the status when sales sends to design
    query += ` AND (d.status IN ('SHARED', 'APPROVED', 'DESIGN_IN_REVIEW') OR soi.id IS NOT NULL OR soi.status IN ('SHARED', 'APPROVED', 'DESIGN_IN_REVIEW'))`;
  }

  if (clientName) {
    query += ` AND d.client_name = ?`;
    params.push(clientName);
  }

  if (search) {
    query += ` AND (d.client_name LIKE ? OR d.drawing_no LIKE ? OR d.description LIKE ?)`;
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  query += ` GROUP BY d.client_name, d.drawing_no, d.revision ORDER BY MAX(d.created_at) DESC, (MAX(soi.item_group) LIKE '%FG%' OR MAX(soi.item_group) LIKE '%FINISHED%') DESC, (MAX(soi.bom_cost) > 0) DESC, MAX(soi.id) DESC`;
  const [rows] = await pool.query(query, params);
  
  // Enrich with sub-assemblies for items with BOM structure
  const enrichedRows = await Promise.all(rows.map(async (row) => {
    // We attempt to fetch components if we have an item ID OR identifying info for fallback (FG or SA)
    if (row.sales_order_item_id || row.item_code || row.drawing_no) {
      try {
        const components = await bomService.getItemComponents(row.sales_order_item_id, row.item_code, row.drawing_no);
        const sub_assemblies = components.filter(c => {
          const code = (c.item_code || c.component_code || '').toUpperCase();
          const group = (c.item_group || '').toUpperCase();
          const desc = (c.description || '').toUpperCase();
          return (code.startsWith('SA-') || code.startsWith('SFG-') || 
                  group.includes('SA') || group.includes('SUB') || group.includes('ASSEMBLY') ||
                  desc.includes('ASSEMBLY') || desc.includes('UNIT')) &&
                 !group.includes('FG');
        });
        return { ...row, sub_assemblies };
      } catch (err) {
        console.error(`Error fetching components for item ${row.sales_order_item_id}:`, err);
        return { ...row, sub_assemblies: [] };
      }
    }
    return { ...row, sub_assemblies: [] };
  }));

  // Ensure each row has a unique id for DataTable and matching compatibility
  return enrichedRows.map(row => ({
    ...row,
    // If we have a sales_order_item_id, use it to make the ID unique for that specific item version
    // Otherwise fallback to drawing_master_id
    id: row.sales_order_item_id ? `soi_${row.sales_order_item_id}` : row.drawing_master_id
  }));
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
    description, revisionNo, drawingPdf, clientName, projectName, contactPerson, 
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
  if (projectName !== undefined) { updates.push('project_name = ?'); params.push(projectName); }
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

  updates.push('updated_at = NOW()');

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
    'SELECT * FROM customer_drawings WHERE client_name = ? ORDER BY updated_at DESC, created_at DESC',
    [clientName]
  );
  return rows;
};

const createCustomerDrawing = async (data) => {
  const { 
    clientName, projectName, drawingNo, revision, qty, description, filePath, fileType, remarks, 
    uploadedBy, contactPerson, phoneNumber, emailAddress,
    customerType, gstin, city, state, billingAddress, shippingAddress
  } = data;
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Insert into customer_drawings
    const [result] = await connection.execute(
      `INSERT INTO customer_drawings 
        (client_name, project_name, drawing_no, revision, qty, description, file_path, file_type, remarks, 
         uploaded_by, contact_person, phone, email, 
         customer_type, gstin, city, state, billing_address, shipping_address, excel_path, zip_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ,
      [
        clientName || null, projectName || null, drawingNo, revision || null, qty || 1, description || null, filePath, fileType, remarks || null, 
        uploadedBy || 'Sales', contactPerson || null, phoneNumber || null, emailAddress || null,
        customerType || null, gstin || null, city || null, state || null, billingAddress || null, shippingAddress || null,
        fileType === 'XLSX' || fileType === 'XLS' ? filePath : null,
        null
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
      } else {
        // Update existing contact if new info is provided
        await connection.execute(
          'UPDATE contacts SET name = COALESCE(?, name), email = COALESCE(?, email), phone = COALESCE(?, phone) WHERE id = ?',
          [contactPerson || null, emailAddress || null, phoneNumber || null, contacts[0].id]
        );
      }
    }

    // 3. Create Sales Order Requirement
    const [soResult] = await connection.execute(
      `INSERT INTO sales_orders (company_id, project_name, drawing_required, production_priority, status, current_department, request_accepted, billing_address, shipping_address, city, state, gstin, customer_type, excel_path, zip_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId, 
        projectName || `Design Review - Drawing ${drawingNo} for ${clientName}`, 
        1, 
        'NORMAL', 
        'CREATED', 
        'SALES', 
        0,
        billingAddress || null,
        shippingAddress || null,
        city || null,
        state || null,
        gstin || null,
        customerType || null,
        fileType === 'XLSX' || fileType === 'XLS' ? filePath : null,
        null // zip_path handled in batch
      ]
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

const createBatchCustomerDrawings = async (batchData, batchInfo = {}) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let count = 0;

    for (const data of batchData) {
      const { 
        clientName, projectName, drawingNo, revision, qty, description, filePath, fileType, remarks, 
        uploadedBy, contactPerson, phoneNumber, emailAddress,
        customerType, gstin, city, state, billingAddress, shippingAddress
      } = data;

      // 1. Insert into customer_drawings
      const [result] = await connection.execute(
        `INSERT INTO customer_drawings 
          (client_name, project_name, drawing_no, revision, qty, description, file_path, file_type, remarks, 
           uploaded_by, contact_person, phone, email, 
           customer_type, gstin, city, state, billing_address, shipping_address, excel_path, zip_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ,
        [
          clientName || null, projectName || null, drawingNo, revision || null, qty || 1, description || null, filePath, fileType, remarks || null, 
          uploadedBy || 'Sales', contactPerson || null, phoneNumber || null, emailAddress || null,
          customerType || null, gstin || null, city || null, state || null, billingAddress || null, shippingAddress || null,
          batchInfo.excelPath || null,
          batchInfo.zipPath || null
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
        `INSERT INTO sales_orders (company_id, project_name, drawing_required, production_priority, status, current_department, request_accepted, billing_address, shipping_address, city, state, gstin, customer_type, excel_path, zip_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          companyId, 
          projectName || `Design Review - Drawing ${drawingNo} for ${clientName}`, 
          1, 
          'NORMAL', 
          'CREATED', 
          'SALES', 
          0,
          billingAddress || null,
          shippingAddress || null,
          city || null,
          state || null,
          gstin || null,
          customerType || null,
          batchInfo.excelPath || null,
          batchInfo.zipPath || null
        ]
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
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await internalDeleteDrawing(connection, id);
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    console.error('Error in deleteCustomerDrawing:', error);
    throw error;
  } finally {
    connection.release();
  }
};

const deleteDrawingsBulk = async (ids) => {
  if (!ids || ids.length === 0) return;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const id of ids) {
      await internalDeleteDrawing(connection, id);
    }
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    console.error('Error in deleteDrawingsBulk:', error);
    throw error;
  } finally {
    connection.release();
  }
};

const deleteClientDrawings = async (clientName, connection) => {
  const [drawings] = await connection.query('SELECT id FROM customer_drawings WHERE client_name = ?', [clientName]);
  for (const drawing of drawings) {
    await internalDeleteDrawing(connection, drawing.id);
  }
};

const internalDeleteDrawing = async (connection, id) => {
  // 1. Get all sales_order_item_ids linked to this drawing
  const [soItems] = await connection.query(
    'SELECT id, sales_order_id FROM sales_order_items WHERE drawing_id = ?',
    [id]
  );
  const soItemIds = soItems.map(item => item.id);
  const soIds = [...new Set(soItems.map(item => item.sales_order_id).filter(id => id))];

  // 2. Delete from tables that don't have ON DELETE CASCADE for sales_order_item_id
  if (soItemIds.length > 0) {
    const placeholders = soItemIds.map(() => '?').join(',');
    
    // Delete from quotation_requests
    await connection.query(
      `DELETE FROM quotation_requests WHERE sales_order_item_id IN (${placeholders})`,
      soItemIds
    );

    // Delete from production_plan_items
    await connection.query(
      `DELETE FROM production_plan_items WHERE sales_order_item_id IN (${placeholders})`,
      soItemIds
    );

    // Delete from work_orders
    await connection.query(
      `DELETE FROM work_orders WHERE sales_order_item_id IN (${placeholders})`,
      soItemIds
    );

    // Delete from BOM tables
    await connection.query(
      `DELETE FROM sales_order_item_materials WHERE sales_order_item_id IN (${placeholders})`,
      soItemIds
    );
    await connection.query(
      `DELETE FROM sales_order_item_components WHERE sales_order_item_id IN (${placeholders})`,
      soItemIds
    );
    await connection.query(
      `DELETE FROM sales_order_item_operations WHERE sales_order_item_id IN (${placeholders})`,
      soItemIds
    );
    await connection.query(
      `DELETE FROM sales_order_item_scrap WHERE sales_order_item_id IN (${placeholders})`,
      soItemIds
    );
  }

  // 3. Delete from quotation_requests by drawing_id directly (in case they aren't linked via sales_order_item_id)
  await connection.query(
    'DELETE FROM quotation_requests WHERE drawing_id = ?',
    [id]
  );

  // 4. Delete sales_order_items (This will cascade to sales_order_item_materials, operations, components, scrap)
  if (soItemIds.length > 0) {
    const placeholders = soItemIds.map(() => '?').join(',');
    await connection.query(
      `DELETE FROM sales_order_items WHERE id IN (${placeholders})`,
      soItemIds
    );
  }

  // 5. Cleanup empty sales orders
  if (soIds.length > 0) {
    for (const soId of soIds) {
      const [remainingItems] = await connection.query(
        'SELECT id FROM sales_order_items WHERE sales_order_id = ?',
        [soId]
      );
      if (remainingItems.length === 0) {
        // This will also delete design_orders due to ON DELETE CASCADE
        await connection.query('DELETE FROM sales_orders WHERE id = ?', [soId]);
      }
    }
  }

  // 6. Finally delete the drawing itself
  await connection.execute('DELETE FROM customer_drawings WHERE id = ?', [id]);
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
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // 1. Update customer_drawings status
    await connection.execute(
      `UPDATE customer_drawings SET status = 'SHARED', shared_with_design = 1, shared_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
      ids
    );
    
    // 2. Update linked sales_order_items status to 'SHARED' (or DESIGN_IN_REVIEW)
    // First find the drawing_nos for these IDs
    const [drawings] = await connection.query(`SELECT drawing_no FROM customer_drawings WHERE id IN (${placeholders})`, ids);
    const drawingNos = drawings.map(d => d.drawing_no);
    
    if (drawingNos.length > 0) {
      const dwgPlaceholders = drawingNos.map(() => "?").join(",");
      await connection.execute(
        `UPDATE sales_order_items SET status = 'SHARED' WHERE drawing_no IN (${dwgPlaceholders}) AND (status IS NULL OR status = 'PENDING')`,
        drawingNos
      );
    }
    
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getApprovedDrawings = async () => {
  const [rows] = await pool.query(
    `SELECT 
       MAX(d.id) as drawing_master_id,
       d.drawing_no,
       d.client_name,
       MAX(d.file_path) as file_path,
       MAX(d.description) as drawing_description,
       MAX(latest_bom.id) as id,
       MAX(latest_bom.bom_cost) as bom_cost, 
       MAX(latest_bom.item_group) as item_group, 
       MAX(latest_bom.unit) as unit,
       MAX(latest_bom.description) as description,
       MAX(latest_bom.item_code) as item_code
     FROM customer_drawings d
     INNER JOIN (
       SELECT 
         id,
         drawing_no, 
         bom_cost, 
         item_group,
         item_type,
         unit,
         description,
         item_code,
         drawing_id
       FROM sales_order_items 
       WHERE id IN (
         SELECT MAX(id) 
         FROM sales_order_items 
         WHERE bom_cost > 0
         GROUP BY COALESCE(drawing_id, drawing_no)
       )
     ) latest_bom ON (d.id = latest_bom.drawing_id OR (latest_bom.drawing_id IS NULL AND d.drawing_no = latest_bom.drawing_no))
     WHERE d.status = 'APPROVED' OR d.shared_with_design = 1
     GROUP BY d.client_name, d.drawing_no
     ORDER BY MAX(d.created_at) DESC`
  );

  // Enrich with sub-assemblies for FG items
  const enrichedRows = await Promise.all(rows.map(async (row) => {
    const isFG = (row.item_group || '').toUpperCase().includes('FG');
    if (isFG && row.id) {
      try {
        const components = await bomService.getItemComponents(row.id);
        const sub_assemblies = components.filter(c => {
          const code = (c.item_code || '').toUpperCase();
          const group = (c.item_group || '').toUpperCase();
          return (code.startsWith('SA-') || code.startsWith('SFG-') || 
                  group.includes('SA') || group.includes('SUB') || group.includes('ASSEMBLY')) &&
                 !group.includes('FG');
        });
        return { ...row, sub_assemblies };
      } catch (err) {
        console.error(`Error fetching components for item ${row.id}:`, err);
        return { ...row, sub_assemblies: [] };
      }
    }
    return { ...row, sub_assemblies: [] };
  }));

  return enrichedRows;
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
  deleteDrawingsBulk,
  shareWithDesign,
  shareDrawingsBulk,
  getApprovedDrawings
};
