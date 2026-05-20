const crypto = require('crypto');
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
      d.uploaded_by as uploader_name,
      d.created_at as updated_at,
      d.qty,
      d.revision,
      d.remarks,
      d.contact_person,
      d.phone,
      d.email,
      d.customer_type,
      d.gstin,
      d.city,
      d.state,
      d.billing_address,
      d.shipping_address,
      d.excel_path,
      d.zip_path,
      d.hsn_code,
      d.delivery_date,
      soi.id as sales_order_item_id,
      soi.status as item_status,
      soi.sales_order_id as sales_order_id,
      soi.description as item_description,
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
    WHERE 1=1
  `;
  const params = [];

  if (onlyShared) {
    query += ` AND (d.status IN ('SHARED', 'APPROVED', 'DESIGN_IN_REVIEW') OR soi.status IN ('SHARED', 'APPROVED', 'DESIGN_IN_REVIEW'))`;
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

  query += ` ORDER BY d.id DESC, (soi.item_group LIKE '%FG%' OR soi.item_group LIKE '%FINISHED%') DESC, (soi.bom_cost > 0) DESC, soi.id DESC`;
  const [rows] = await pool.query(query, params);

  // Enrich with sub-assemblies for items with BOM structure
  const enrichedRows = await Promise.all(rows.map(async (row) => {
    // We attempt to fetch components if we have an item ID OR identifying info for fallback (FG or SA)
    if (row.sales_order_item_id || row.item_code || row.drawing_no) {
      try {
        const components = await bomService.getItemComponents(row.sales_order_item_id, row.item_code, row.drawing_no);
        const g = (row.item_group || '').toUpperCase();
        const isDrawingOrSA = g.includes('SA') || g.includes('SUB') || g.includes('ASSEMBLY') || g.includes('PART') || (row.drawing_no && row.drawing_no !== '—');
        const sub_assemblies = isDrawingOrSA ? components : components.filter(c => {
          const code = (c.item_code || c.component_code || '').toUpperCase();
          const group = (c.item_group || '').toUpperCase();
          const desc = (c.description || '').toUpperCase();
          return (code.startsWith('SA-') || code.startsWith('SFG-') || code.startsWith('PART-') ||
            group.includes('SA') || group.includes('SUB') || group.includes('ASSEMBLY') ||
            desc.includes('ASSEMBLY') || desc.includes('UNIT') ||
            group.includes('PART') || (c.drawing_no && c.drawing_no !== '—'));
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

const getDrawingById = async (id) => {
  const [rows] = await pool.query(
    `SELECT 
      d.id as drawing_master_id,
      d.public_id,
      d.drawing_no,
      d.file_path,
      d.client_name,
      d.project_name,
      d.status,
      d.status as drawing_status,
      d.description as drawing_description,
      d.drawing_type,
      d.uploaded_by as uploader_name,
      d.created_at as updated_at,
      d.qty,
      d.revision,
      d.remarks,
      d.contact_person,
      d.phone,
      d.email,
      d.customer_type,
      d.gstin,
      d.city,
      d.state,
      d.billing_address,
      d.shipping_address,
      d.excel_path,
      d.zip_path,
      d.hsn_code,
      d.delivery_date,
      soi.id as sales_order_item_id,
      soi.status as item_status,
      soi.sales_order_id as sales_order_id,
      soi.description as item_description,
      soi.bom_cost as bom_cost,
      soi.item_group as item_group,
      soi.unit as unit,
      soi.item_code as item_code
    FROM customer_drawings d
    LEFT JOIN (
      SELECT 
        s1.id, 
        s1.drawing_no, 
        s1.status, 
        s1.sales_order_id, 
        s1.description, 
        s1.bom_cost, 
        s1.item_group, 
        s1.unit, 
        s1.drawing_id, 
        s1.item_code
      FROM sales_order_items s1
      JOIN (
        SELECT COALESCE(drawing_id, 0) as dwg_id, drawing_no as dwg_no, MAX(id) as max_id
        FROM sales_order_items
        GROUP BY dwg_id, dwg_no
      ) s2 ON (s1.drawing_id = s2.dwg_id AND s1.drawing_no = s2.dwg_no AND s1.id = s2.max_id)
         OR (s1.drawing_id IS NULL AND s1.drawing_no = s2.dwg_no AND s1.id = s2.max_id)
    ) soi ON (d.id = soi.drawing_id OR (d.drawing_no = soi.drawing_no AND (soi.drawing_id IS NULL OR soi.drawing_id = d.id)))
    WHERE d.id = ? OR d.public_id = ?
    LIMIT 1`,
    [id, id]
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  if (row.sales_order_item_id || row.item_code || row.drawing_no) {
    try {
      const components = await bomService.getItemComponents(row.sales_order_item_id, row.item_code, row.drawing_no);
      const g = (row.item_group || '').toUpperCase();
      const isDrawingOrSA = g.includes('SA') || g.includes('SUB') || g.includes('ASSEMBLY') || g.includes('PART') || (row.drawing_no && row.drawing_no !== '—');
      const sub_assemblies = isDrawingOrSA ? components : components.filter(c => {
        const code = (c.item_code || c.component_code || "").toUpperCase();
        const group = (c.item_group || "").toUpperCase();
        const desc = (c.description || "").toUpperCase();
        return (code.startsWith("SA-") || code.startsWith("SFG-") || code.startsWith('PART-') ||
          group.includes("SA") || group.includes("SUB") || group.includes("ASSEMBLY") ||
          desc.includes("ASSEMBLY") || desc.includes("UNIT") ||
          group.includes('PART') || (c.drawing_no && c.drawing_no !== '—'));
      });
      row.sub_assemblies = sub_assemblies;
    } catch (err) {
      console.error(`Error fetching components for drawing ${id}:`, err);
      row.sub_assemblies = [];
    }
  } else {
    row.sub_assemblies = [];
  }

  return {
    ...row,
    id: row.sales_order_item_id ? `soi_${row.sales_order_item_id}` : row.drawing_master_id
  };
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
    billingAddress, shippingAddress, qty, remarks, drawingNo, drawing_type, hsnCode, deliveryDate
  } = data;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // If id is a UUID, find the internal ID first
    let internalId = id;
    if (isNaN(id)) {
      const [rows] = await connection.query('SELECT id FROM customer_drawings WHERE public_id = ?', [id]);
      if (rows.length === 0) throw new Error('Drawing not found');
      internalId = rows[0].id;
    }

    // 1. Update customer_drawings
    let query = 'UPDATE customer_drawings SET ';
    const updates = [];
    const params = [];

    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (revisionNo !== undefined) { updates.push('revision = ?'); params.push(revisionNo); }
    if (drawing_type !== undefined) { updates.push('drawing_type = ?'); params.push(drawing_type); }
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
    if (hsnCode !== undefined) { updates.push('hsn_code = ?'); params.push(hsnCode); }
    if (deliveryDate !== undefined) { updates.push('delivery_date = ?'); params.push(deliveryDate || null); }

    if (!id || id === 'undefined') {
      throw new Error('Drawing ID is required for update');
    }

    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      const drawingQuery = query + updates.join(', ') + ' WHERE id = ?';
      const drawingParams = [...params, internalId];
      await connection.execute(drawingQuery, drawingParams);
    }

    // 2. Sync with sales_order_items and sales_orders
    const [items] = await connection.query(
      'SELECT sales_order_id, id as item_id FROM sales_order_items WHERE drawing_id = ?',
      [internalId]
    );

    if (items.length > 0) {
      for (const item of items) {
        // Update sales_order_items
        const itemUpdates = [];
        const itemParams = [];
        if (drawingNo !== undefined) { itemUpdates.push('drawing_no = ?'); itemParams.push(drawingNo); }
        if (revisionNo !== undefined) { itemUpdates.push('revision_no = ?'); itemParams.push(revisionNo); }
        if (description !== undefined) { itemUpdates.push('description = ?'); itemParams.push(description); }
        if (drawing_type !== undefined) { itemUpdates.push('drawing_type = ?'); itemParams.push(drawing_type); }
        if (drawingPdf !== undefined && drawingPdf !== null) { itemUpdates.push('drawing_pdf = ?'); itemParams.push(drawingPdf); }
        if (qty !== undefined) { itemUpdates.push('quantity = ?'); itemParams.push(qty); }
        if (deliveryDate !== undefined) { itemUpdates.push('delivery_date = ?'); itemParams.push(deliveryDate || null); }

        if (itemUpdates.length > 0) {
          await connection.execute(
            `UPDATE sales_order_items SET ${itemUpdates.join(', ')} WHERE id = ?`,
            [...itemParams, item.item_id]
          );
        }

        // Update sales_orders
        const soUpdates = [];
        const soParams = [];
        if (projectName !== undefined) { soUpdates.push('project_name = ?'); soParams.push(projectName); }
        if (billingAddress !== undefined) { soUpdates.push('billing_address = ?'); soParams.push(billingAddress); }
        if (shippingAddress !== undefined) { soUpdates.push('shipping_address = ?'); soParams.push(shippingAddress); }
        if (city !== undefined) { soUpdates.push('city = ?'); soParams.push(city); }
        if (state !== undefined) { soUpdates.push('state = ?'); soParams.push(state); }
        if (gstin !== undefined) { soUpdates.push('gstin = ?'); soParams.push(gstin); }
        if (customerType !== undefined) { soUpdates.push('customer_type = ?'); soParams.push(customerType); }
        if (deliveryDate !== undefined) { soUpdates.push('target_dispatch_date = ?'); soParams.push(deliveryDate || null); }

        if (soUpdates.length > 0) {
          await connection.execute(
            `UPDATE sales_orders SET ${soUpdates.join(', ')} WHERE id = ?`,
            [...soParams, item.sales_order_id]
          );
        }

        // Update Company
        if (gstin !== undefined || customerType !== undefined) {
          const [so] = await connection.query('SELECT company_id FROM sales_orders WHERE id = ?', [item.sales_order_id]);
          if (so.length > 0) {
            const companyId = so[0].company_id;
            const companyUpdates = [];
            const companyParams = [];
            if (gstin !== undefined) { companyUpdates.push('gstin = ?'); companyParams.push(gstin); }
            if (customerType !== undefined) { companyUpdates.push('customer_type = ?'); companyParams.push(customerType); }

            if (companyUpdates.length > 0) {
              await connection.execute(
                `UPDATE companies SET ${companyUpdates.join(', ')} WHERE id = ?`,
                [...companyParams, companyId]
              );
            }
          }
        }

        // Update Contact
        if (contactPerson !== undefined || phoneNumber !== undefined || emailAddress !== undefined) {
          const [so] = await connection.query('SELECT company_id FROM sales_orders WHERE id = ?', [item.sales_order_id]);
          if (so.length > 0) {
            const companyId = so[0].company_id;
            const [contacts] = await connection.query(
              'SELECT id FROM contacts WHERE company_id = ? AND contact_type = "PRIMARY"',
              [companyId]
            );
            if (contacts.length > 0) {
              const contactUpdates = [];
              const contactParams = [];
              if (contactPerson !== undefined) { contactUpdates.push('name = ?'); contactParams.push(contactPerson); }
              if (emailAddress !== undefined) { contactUpdates.push('email = ?'); contactParams.push(emailAddress); }
              if (phoneNumber !== undefined) { contactUpdates.push('phone = ?'); contactParams.push(phoneNumber); }

              if (contactUpdates.length > 0) {
                await connection.execute(
                  `UPDATE contacts SET ${contactUpdates.join(', ')} WHERE id = ?`,
                  [...contactParams, contacts[0].id]
                );
              }
            }
          }
        }
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

const updateItemDrawing = async (itemId, data) => {
  const { drawingNo, revisionNo, description, drawingPdf, drawing_type } = data;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const updates = [];
    const params = [];

    if (drawingNo !== undefined) { updates.push('drawing_no = ?'); params.push(drawingNo); }
    if (revisionNo !== undefined) { updates.push('revision_no = ?'); params.push(revisionNo); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (drawing_type !== undefined) { updates.push('drawing_type = ?'); params.push(drawing_type); }
    if (drawingPdf !== undefined && drawingPdf !== null) { updates.push('drawing_pdf = ?'); params.push(drawingPdf); }

    if (updates.length > 0) {
      const query = `UPDATE sales_order_items SET ${updates.join(', ')} WHERE id = ?`;
      params.push(itemId);
      await connection.execute(query, params);
    }

    // Sync back to customer_drawings
    const [item] = await connection.query('SELECT drawing_id FROM sales_order_items WHERE id = ?', [itemId]);
    if (item.length > 0 && item[0].drawing_id) {
      const drawingId = item[0].drawing_id;
      const dUpdates = [];
      const dParams = [];
      if (drawingNo !== undefined) { dUpdates.push('drawing_no = ?'); dParams.push(drawingNo); }
      if (revisionNo !== undefined) { dUpdates.push('revision = ?'); dParams.push(revisionNo); }
      if (description !== undefined) { dUpdates.push('description = ?'); dParams.push(description); }
      if (drawing_type !== undefined) { dUpdates.push('drawing_type = ?'); dParams.push(drawing_type); }
      if (drawingPdf !== undefined && drawingPdf !== null) { dUpdates.push('file_path = ?'); dParams.push(drawingPdf); }

      if (dUpdates.length > 0) {
        dUpdates.push('updated_at = NOW()');
        await connection.execute(
          `UPDATE customer_drawings SET ${dUpdates.join(', ')} WHERE id = ?`,
          [...dParams, drawingId]
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
    customerType, gstin, city, state, billingAddress, shippingAddress,
    drawing_type, hsnCode, deliveryDate, salesOrderId: providedSalesOrderId
  } = data;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const drawingPublicId = crypto.randomUUID();
    let salesOrderId = providedSalesOrderId;
    let salesOrderPublicId = null;

    // 1. Insert into customer_drawings
    const [result] = await connection.execute(
      `INSERT INTO customer_drawings 
        (public_id, client_name, project_name, drawing_no, revision, qty, description, drawing_type, hsn_code, delivery_date, file_path, file_type, remarks, 
         uploaded_by, contact_person, phone, email, 
         customer_type, gstin, city, state, billing_address, shipping_address, excel_path, zip_path, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`
      ,
      [
        drawingPublicId,
        clientName || null, projectName || null, drawingNo, revision || null, qty || 1, description || null, drawing_type || 'Part', hsnCode || null, deliveryDate || null, filePath, fileType, remarks || null,
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

    // 3. Create Sales Order Requirement ONLY IF not provided
    if (!salesOrderId) {
      salesOrderPublicId = crypto.randomUUID();
      const [soResult] = await connection.execute(
        `INSERT INTO sales_orders (public_id, company_id, project_name, drawing_required, production_priority, target_dispatch_date, status, current_department, request_accepted, billing_address, shipping_address, city, state, gstin, customer_type, excel_path, zip_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          salesOrderPublicId,
          companyId,
          projectName || `Design Review - Drawing ${drawingNo} for ${clientName}`,
          1,
          'NORMAL',
          deliveryDate || null,
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
      salesOrderId = soResult.insertId;
    }

    // 4. Create Sales Order Item
    await connection.execute(
      `INSERT INTO sales_order_items (sales_order_id, drawing_no, drawing_id, revision_no, drawing_pdf, description, drawing_type, quantity, unit, delivery_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [salesOrderId, drawingNo, drawingId, revision || '0', filePath, description || 'Customer Drawing', drawing_type || 'Part', qty || 1, 'NOS', deliveryDate || null]
    );

    await connection.commit();
    return { drawingId, salesOrderId };
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
    let salesOrderId = batchInfo.salesOrderId || null;

    for (const data of batchData) {
      const {
        clientName, projectName, drawingNo, revision, qty, description, filePath, fileType, remarks,
        uploadedBy, contactPerson, phoneNumber, emailAddress,
        customerType, gstin, city, state, billingAddress, shippingAddress,
        drawing_type, hsnCode, deliveryDate
      } = data;

      const drawingPublicId = crypto.randomUUID();

      // 1. Insert into customer_drawings
      const [result] = await connection.execute(
        `INSERT INTO customer_drawings 
          (public_id, client_name, project_name, drawing_no, revision, qty, description, drawing_type, hsn_code, delivery_date, file_path, file_type, remarks, 
           uploaded_by, contact_person, phone, email, 
           customer_type, gstin, city, state, billing_address, shipping_address, excel_path, zip_path, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`
        ,
        [
          drawingPublicId,
          clientName || null, projectName || null, drawingNo, revision || null, qty || 1, description || null, drawing_type || 'Part', hsnCode || null, deliveryDate || null, filePath, fileType, remarks || null,
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

      // 3. Create Sales Order Requirement ONLY ONCE per batch
      if (!salesOrderId) {
        const salesOrderPublicId = crypto.randomUUID();
        const [soResult] = await connection.execute(
          `INSERT INTO sales_orders (public_id, company_id, project_name, drawing_required, production_priority, target_dispatch_date, status, current_department, request_accepted, billing_address, shipping_address, city, state, gstin, customer_type, excel_path, zip_path)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            salesOrderPublicId,
            companyId,
            projectName || `Design Review - Batch Upload for ${clientName}`,
            1,
            'NORMAL',
            deliveryDate || null,
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
        salesOrderId = soResult.insertId;
      }

      // 4. Create Sales Order Item
      await connection.execute(
        `INSERT INTO sales_order_items (sales_order_id, drawing_no, drawing_id, revision_no, drawing_pdf, description, drawing_type, quantity, unit, delivery_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        [salesOrderId, drawingNo, drawingId, revision || null, filePath, description || null, drawing_type || 'Part', qty || 1, 'NOS', deliveryDate || null]
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
       MAX(d.hsn_code) as hsn_code,
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
         SELECT MAX(soi2.id) 
         FROM sales_order_items soi2
         JOIN sales_orders so ON so.id = soi2.sales_order_id
         WHERE soi2.bom_cost > 0 AND so.quotation_id IS NULL
         GROUP BY COALESCE(soi2.drawing_id, soi2.drawing_no)
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
        const g = (row.item_group || '').toUpperCase();
        const isDrawingOrSA = g.includes('SA') || g.includes('SUB') || g.includes('ASSEMBLY') || g.includes('PART') || (row.drawing_no && row.drawing_no !== '—');
        const sub_assemblies = isDrawingOrSA ? components : components.filter(c => {
          const code = (c.item_code || c.component_code || '').toUpperCase();
          const group = (c.item_group || '').toUpperCase();
          const desc = (c.description || '').toUpperCase();
          return (code.startsWith('SA-') || code.startsWith('SFG-') || code.startsWith('PART-') ||
            group.includes('SA') || group.includes('SUB') || group.includes('ASSEMBLY') ||
            desc.includes('ASSEMBLY') || desc.includes('UNIT') ||
            group.includes('PART') || (c.drawing_no && c.drawing_no !== '—'));
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
  getDrawingById,
  getDrawingRevisions,
  updateDrawing,
  updateItemDrawing,
  getDrawingsByClient,
  createCustomerDrawing,
  createBatchCustomerDrawings,
  deleteCustomerDrawing,
  deleteDrawingsBulk,
  deleteClientDrawings,
  shareWithDesign,
  shareDrawingsBulk,
  getApprovedDrawings
};
