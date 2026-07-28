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

const listDrawings = async (search = '', onlyShared = false, clientName = null, summary = false) => {
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
    ) soi ON (
      (d.id = soi.drawing_id OR (soi.drawing_id IS NULL AND d.drawing_no = soi.drawing_no))
      AND (soi.drawing_no IS NULL OR soi.drawing_no = '' OR d.drawing_no = soi.drawing_no)
    )
    WHERE 1=1
  `;
  const params = [];

  if (onlyShared) {
    query += ` AND (TRIM(d.status) IN ('SHARED', 'APPROVED', 'DESIGN_IN_REVIEW', 'REJECTED') OR TRIM(soi.status) IN ('SHARED', 'APPROVED', 'DESIGN_IN_REVIEW', 'REJECTED'))`;
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

  query += ` ORDER BY 
    CASE 
      WHEN (
        COALESCE(soi.status, '') NOT IN ('APPROVED', 'REJECTED') 
        AND COALESCE(d.status, '') NOT IN ('APPROVED', 'REJECTED') 
        AND (soi.id IS NOT NULL OR COALESCE(d.status, '') IN ('SHARED', 'PENDING'))
      ) THEN 1 
      ELSE 2 
    END ASC, 
    d.id DESC, 
    (soi.item_group LIKE '%FG%' OR soi.item_group LIKE '%FINISHED%') DESC, 
    (soi.bom_cost > 0) DESC, 
    soi.id DESC`;
  const [rows] = await pool.query(query, params);

  if (summary) {
    return rows.map(row => ({
      ...row,
      sub_assemblies: [],
      id: row.sales_order_item_id ? `soi_${row.sales_order_item_id}` : row.drawing_master_id
    }));
  }

  // Batch fetch components for non-summary requests
  const allItemIds = rows.map(row => row.sales_order_item_id).filter(Boolean);
  let batchComponents = [];
  if (allItemIds.length > 0) {
    const [compRows] = await pool.query(
      `SELECT c.*, 
              COALESCE(i.drawing_no, soi.drawing_no) as drawing_no,
              COALESCE(soi.description, c.description) as description,
              COALESCE(c.component_code, c.item_code) as item_code,
              i.selling_rate as latest_selling_rate, i.valuation_rate as latest_valuation_rate, i.weight_per_unit as latest_weight_per_unit,
              COALESCE(i.current_balance, 0) as available_stock
       FROM sales_order_item_components c
       LEFT JOIN (
         SELECT item_code, drawing_no, description
         FROM sales_order_items 
         WHERE id IN (
           SELECT MAX(id) 
           FROM sales_order_items 
           WHERE sales_order_id IS NULL
           GROUP BY item_code
         )
       ) soi ON LOWER(TRIM(COALESCE(c.component_code, c.item_code))) = LOWER(TRIM(soi.item_code))
       LEFT JOIN (
         SELECT item_code, MAX(selling_rate) as selling_rate, MAX(valuation_rate) as valuation_rate, MAX(weight_per_unit) as weight_per_unit, MAX(drawing_no) as drawing_no, SUM(current_balance) as current_balance
         FROM stock_balance 
         GROUP BY item_code
       ) i ON LOWER(TRIM(COALESCE(c.component_code, c.item_code))) = LOWER(TRIM(i.item_code))
       WHERE c.sales_order_item_id IN (?) 
       ORDER BY c.created_at ASC`,
      [allItemIds]
    );
    batchComponents = compRows;
  }

  const componentsMap = {};
  for (const row of batchComponents) {
    if (!componentsMap[row.sales_order_item_id]) {
      componentsMap[row.sales_order_item_id] = [];
    }
    componentsMap[row.sales_order_item_id].push({
      ...row,
      qty: row.quantity || row.qty,
      quantity: row.quantity || row.qty,
      rate: parseFloat(row.rate || 0),
      bom_cost: parseFloat(row.bom_cost || 0),
      pending_bom_cost: row.pending_bom_cost ? parseFloat(row.pending_bom_cost) : null,
      is_cost_frozen: true,
      available_stock: parseFloat(row.available_stock || 0)
    });
  }

  // Enrich with sub-assemblies for items with BOM structure
  const enrichedRows = await Promise.all(rows.map(async (row) => {
    // We attempt to fetch components if we have an item ID OR identifying info for fallback (FG or SA)
    if (row.sales_order_item_id || row.item_code || row.drawing_no) {
      try {
        const components = componentsMap[row.sales_order_item_id] !== undefined
          ? componentsMap[row.sales_order_item_id]
          : await bomService.getItemComponents(row.sales_order_item_id, row.item_code, row.drawing_no);

        const g = (row.item_group || '').toUpperCase();
        const isAssembly = g.includes('ASSEMBLY');
        const sub_assemblies = isAssembly
          ? components.filter(c => {
            const group = (c.item_group || '').toUpperCase();
            return group.includes('PART');
          })
          : [];
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
    ) soi ON (
      (d.id = soi.drawing_id OR (d.drawing_no = soi.drawing_no AND (soi.drawing_id IS NULL OR soi.drawing_id = d.id)))
      AND (soi.drawing_no IS NULL OR soi.drawing_no = '' OR d.drawing_no = soi.drawing_no)
    )
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

const performCascadingDrawingTypeSync = async (connection, { drawingId, drawingNo, drawing_type, description }) => {
  if (drawing_type === undefined || drawing_type === null) return;

  const isAssembly = String(drawing_type).trim().toLowerCase().includes('assembly');
  const targetType = isAssembly ? 'Assembly' : 'Part';
  const targetGroup = isAssembly ? 'assembly' : 'part';

  let targetDrawingNo = drawingNo;
  let targetDesc = description;

  if (!targetDrawingNo && drawingId) {
    const [dwgRows] = await connection.query('SELECT drawing_no, description FROM customer_drawings WHERE id = ?', [drawingId]);
    if (dwgRows.length > 0) {
      targetDrawingNo = dwgRows[0].drawing_no;
      targetDesc = dwgRows[0].description;
    } else {
      const [soiRows] = await connection.query('SELECT drawing_no, description FROM sales_order_items WHERE id = ?', [drawingId]);
      if (soiRows.length > 0) {
        targetDrawingNo = soiRows[0].drawing_no;
        targetDesc = soiRows[0].description;
      }
    }
  }

  if (!targetDrawingNo) return;

  // 1. Update customer_drawings (all instances of this drawing_no or drawingId)
  await connection.execute(
    'UPDATE customer_drawings SET drawing_type = ?, updated_at = NOW() WHERE drawing_no = ? OR (id = ? AND ? > 0)',
    [targetType, targetDrawingNo, drawingId || 0, drawingId || 0]
  );

  // 2. Update sales_order_items
  await connection.execute(
    'UPDATE sales_order_items SET drawing_type = ?, item_type = ?, item_group = ? WHERE drawing_no = ? OR (drawing_id = ? AND ? > 0)',
    [targetType, targetType, targetGroup, targetDrawingNo, drawingId || 0, drawingId || 0]
  );

  // 3. Update bom table
  await connection.execute(
    'UPDATE bom SET item_group = ? WHERE drawing_no = ?',
    [targetGroup, targetDrawingNo]
  );

  // 4. Update stock_balance (Items Master) & regenerate Item Code
  const [stockRows] = await connection.query(
    'SELECT id, item_code, material_name, item_description FROM stock_balance WHERE drawing_no = ?',
    [targetDrawingNo]
  );

  const stockService = require('./stockService');

  for (const stockRow of stockRows) {
    const itemName = stockRow.material_name || stockRow.item_description || targetDesc || targetDrawingNo;
    const newItemCode = await stockService.generateItemCode(itemName, targetGroup);

    await connection.execute(
      'UPDATE stock_balance SET material_type = ?, item_code = ? WHERE id = ?',
      [targetGroup, newItemCode, stockRow.id]
    );

    // If item_code changed, cascade to sales_order_items, bom, and bom_items
    if (stockRow.item_code && newItemCode && stockRow.item_code !== newItemCode) {
      await connection.execute(
        'UPDATE sales_order_items SET item_code = ? WHERE item_code = ? OR drawing_no = ?',
        [newItemCode, stockRow.item_code, targetDrawingNo]
      );
      await connection.execute(
        'UPDATE bom SET item_code = ? WHERE item_code = ? OR drawing_no = ?',
        [newItemCode, stockRow.item_code, targetDrawingNo]
      );
      await connection.execute(
        'UPDATE bom_items SET component_code = ? WHERE component_code = ?',
        [newItemCode, stockRow.item_code]
      );
    }
  }
};

const checkDuplicateApprovedDrawing = async (connection, drawingNo, excludeDrawingId = null, excludeSalesOrderItemId = null) => {
  if (!drawingNo) return;
  const cleanDwgNo = String(drawingNo).trim();

  // 1. Check customer_drawings — Approved drawings only
  let cdQuery = `
    SELECT id, drawing_no
    FROM customer_drawings
    WHERE TRIM(drawing_no) = ?
      AND UPPER(TRIM(status)) IN ('APPROVED', 'DESIGN_APPROVED')
  `;
  const cdParams = [cleanDwgNo];
  if (excludeDrawingId) {
    cdQuery += ` AND id <> ?`;
    cdParams.push(excludeDrawingId);
  }
  const [cdDupes] = await connection.query(cdQuery, cdParams);
  if (cdDupes.length > 0) {
    const error = new Error(
      `Approval Failed\n\nDrawing Number "${cleanDwgNo}" already exists as an Approved Drawing.\n\nPlease change the Drawing Number before saving.`
    );
    error.statusCode = 400;
    error.validationFailed = true;
    throw error;
  }

  // 2. Check sales_order_items — Approved active items only
  let soiQuery = `
    SELECT id
    FROM sales_order_items
    WHERE TRIM(drawing_no) = ?
      AND UPPER(TRIM(status)) IN ('APPROVED', 'DESIGN_APPROVED')
      AND is_active = 1
  `;
  const soiParams = [cleanDwgNo];
  if (excludeSalesOrderItemId) {
    soiQuery += ` AND id <> ?`;
    soiParams.push(excludeSalesOrderItemId);
  }
  if (excludeDrawingId) {
    soiQuery += ` AND (drawing_id IS NULL OR drawing_id <> ?)`;
    soiParams.push(excludeDrawingId);
  }
  const [soiDupes] = await connection.query(soiQuery, soiParams);
  if (soiDupes.length > 0) {
    const error = new Error(
      `Approval Failed\n\nDrawing Number "${cleanDwgNo}" already exists as an Approved Drawing.\n\nPlease change the Drawing Number before saving.`
    );
    error.statusCode = 400;
    error.validationFailed = true;
    throw error;
  }
};

const updateDrawing = async (id, data) => {
  const {
    description, revisionNo, drawingPdf, clientName, projectName, contactPerson,
    phoneNumber, emailAddress, customerType, gstin, city, state,
    billingAddress, shippingAddress, qty, remarks, drawingNo, drawing_type, hsnCode, deliveryDate,
    fileType
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

    // Only validate duplicate approved drawing number if the drawing_no is actually being changed.
    // Existing locked/approved drawings that have not had their number changed are skipped entirely.
    const [currentDwg] = await connection.query('SELECT drawing_no, status FROM customer_drawings WHERE id = ?', [internalId]);
    const currentDrawingNo = currentDwg[0]?.drawing_no || '';
    const currentStatus = (currentDwg[0]?.status || '').toUpperCase().trim();
    const isDrawingNoChanging = drawingNo !== undefined && String(drawingNo).trim() !== String(currentDrawingNo).trim();

    if (isDrawingNoChanging) {
      // The drawing number is changing — check that the new number isn't already taken
      await checkDuplicateApprovedDrawing(connection, drawingNo, internalId);
    }
    // If drawing_no is NOT changing (e.g. updating file, notes, delivery date on approved drawing),
    // skip the duplicate check entirely — the drawing already belongs to this requirement.

    // Check if drawing is linked to any sales order that is QUOTATION_SENT or BOM_SUBMITTED
    const [orders] = await connection.query(
      `SELECT so.status 
       FROM sales_order_items soi
       JOIN sales_orders so ON soi.sales_order_id = so.id
       WHERE soi.drawing_id = ?`,
      [internalId]
    );
    const isOnlyFilesUpdate = 
      description === undefined &&
      revisionNo === undefined &&
      clientName === undefined &&
      projectName === undefined &&
      contactPerson === undefined &&
      phoneNumber === undefined &&
      emailAddress === undefined &&
      customerType === undefined &&
      gstin === undefined &&
      city === undefined &&
      state === undefined &&
      billingAddress === undefined &&
      shippingAddress === undefined &&
      qty === undefined &&
      remarks === undefined &&
      drawingNo === undefined &&
      drawing_type === undefined &&
      hsnCode === undefined &&
      deliveryDate === undefined;

    if (!isOnlyFilesUpdate) {
      for (const order of orders) {
        const statusUpper = (order.status || '').toUpperCase().replace(/_/g, ' ').trim();
        // QUOTATION SENT: updates are allowed
        if (statusUpper === 'BOM SUBMITTED') {
          throw new Error('bom allready sent now cant update requirement');
        }
      }
    }

    // Check if drawing is linked to any sales order that is DESIGN_IN_REVIEW and is approved (soi.status = 'APPROVED')
    const [approvedItems] = await connection.query(
      `SELECT soi.status as item_status, so.status as order_status 
       FROM sales_order_items soi
       JOIN sales_orders so ON soi.sales_order_id = so.id
       WHERE soi.drawing_id = ?`,
      [internalId]
    );

    for (const item of approvedItems) {
      const orderStatusUpper = (item.order_status || '').toUpperCase().replace(/_/g, ' ').trim();
      const itemStatusUpper = (item.item_status || '').toUpperCase().trim();
      if (orderStatusUpper === 'DESIGN IN REVIEW' && itemStatusUpper === 'APPROVED') {
        if (
          description !== undefined ||
          revisionNo !== undefined ||
          drawing_type !== undefined ||
          drawingPdf !== undefined ||
          qty !== undefined ||
          drawingNo !== undefined ||
          hsnCode !== undefined ||
          deliveryDate !== undefined ||
          remarks !== undefined
        ) {
          const [currentDwg] = await connection.query(
            'SELECT drawing_no, revision, qty, description, drawing_type, file_path, hsn_code, delivery_date, remarks FROM customer_drawings WHERE id = ?',
            [internalId]
          );
          if (currentDwg.length > 0) {
            const dwg = currentDwg[0];
            const currentDelDate = dwg.delivery_date ? new Date(dwg.delivery_date).toISOString().split('T')[0] : null;
            const newDelDate = deliveryDate ? new Date(deliveryDate).toISOString().split('T')[0] : null;
            const isDiff =
              (drawingNo !== undefined && String(drawingNo).trim() !== String(dwg.drawing_no || '').trim()) ||
              (description !== undefined && String(description).trim() !== String(dwg.description || '').trim()) ||
              (revisionNo !== undefined && String(revisionNo).trim() !== String(dwg.revision || '').trim()) ||
              (qty !== undefined && Number(qty) !== Number(dwg.qty || 0)) ||
              (drawing_type !== undefined && String(drawing_type).trim() !== String(dwg.drawing_type || '').trim());

            if (isDiff) {
              throw new Error('Approved drawing cannot be edited.');
            }
          }
        }
      }
    }

    // 1. Update customer_drawings
    let query = 'UPDATE customer_drawings SET ';
    const updates = [];
    const params = [];

    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (revisionNo !== undefined) { updates.push('revision = ?'); params.push(revisionNo); }
    if (drawing_type !== undefined) { updates.push('drawing_type = ?'); params.push(drawing_type); }
    if (drawingPdf !== undefined) { updates.push('file_path = ?'); params.push(drawingPdf); }
    if (fileType !== undefined) { updates.push('file_type = ?'); params.push(fileType); }
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
      'SELECT sales_order_id, id as item_id, bom_id, parent_bom_id FROM sales_order_items WHERE drawing_id = ?',
      [internalId]
    );

    if (items.length > 0) {
      for (const item of items) {
        // Skip syncing drawing updates to child BOM items (nested parts/sub-assemblies)
        if (item.bom_id !== null && item.parent_bom_id !== null) {
          continue;
        }

        // Update sales_order_items
        const itemUpdates = [];
        const itemParams = [];
        if (drawingNo !== undefined) { itemUpdates.push('drawing_no = ?'); itemParams.push(drawingNo); }
        if (revisionNo !== undefined) { itemUpdates.push('revision_no = ?'); itemParams.push(revisionNo); }
        if (description !== undefined && item.bom_id === null) { itemUpdates.push('description = ?'); itemParams.push(description); }
        if (drawing_type !== undefined) { itemUpdates.push('drawing_type = ?'); itemParams.push(drawing_type); }
        if (drawingPdf !== undefined && drawingPdf !== null) { itemUpdates.push('drawing_pdf = ?'); itemParams.push(drawingPdf); }
        if (qty !== undefined && item.bom_id === null) { itemUpdates.push('quantity = ?'); itemParams.push(qty); }
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


      }
    }

    if (drawing_type !== undefined) {
      await performCascadingDrawingTypeSync(connection, {
        drawingId: internalId,
        drawingNo,
        drawing_type,
        description
      });
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

    // Check parent sales order status first
    const [itemOrder] = await connection.query(
      `SELECT so.status, soi.status as item_status 
       FROM sales_order_items soi
       JOIN sales_orders so ON soi.sales_order_id = so.id
       WHERE soi.id = ?`,
      [itemId]
    );
    if (itemOrder.length > 0) {
      const statusUpper = (itemOrder[0].status || '').toUpperCase().replace(/_/g, ' ').trim();
      const itemStatusUpper = (itemOrder[0].item_status || '').toUpperCase().trim();
      // QUOTATION SENT: updates are allowed
      if (statusUpper === 'BOM SUBMITTED') {
        throw new Error('bom allready sent now cant update requirement');
      }
      if (statusUpper === 'DESIGN IN REVIEW' && itemStatusUpper === 'APPROVED') {
        const [currentSOI] = await connection.query(
          'SELECT drawing_no, revision_no, description, drawing_pdf, drawing_type FROM sales_order_items WHERE id = ?',
          [itemId]
        );
        if (currentSOI.length > 0) {
          const soi = currentSOI[0];
          const isDiff =
            (drawingNo !== undefined && String(drawingNo).trim() !== String(soi.drawing_no || '').trim()) ||
            (description !== undefined && String(description).trim() !== String(soi.description || '').trim()) ||
            (revisionNo !== undefined && String(revisionNo).trim() !== String(soi.revision_no || '').trim()) ||
            (drawing_type !== undefined && String(drawing_type).trim() !== String(soi.drawing_type || '').trim());

          if (isDiff) {
            throw new Error('Approved drawing cannot be edited.');
          }
        }
      }
    }

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

    // Check if the drawing number already exists as an approved drawing
    await checkDuplicateApprovedDrawing(connection, drawingNo);

    if (providedSalesOrderId) {
      const [order] = await connection.query('SELECT status FROM sales_orders WHERE id = ?', [providedSalesOrderId]);
      if (order.length > 0) {
        const statusUpper = (order[0].status || '').toUpperCase().replace(/_/g, ' ').trim();
        // QUOTATION SENT: updates are allowed
        if (statusUpper === 'BOM SUBMITTED') {
          throw new Error('bom allready sent now cant update requirement');
        }
      }
    }

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
        clientName || null, projectName || null, drawingNo, revision || null, qty || 1, description || null, drawing_type || 'Part', hsnCode || null, deliveryDate || null, filePath || '', fileType || null, remarks || null,
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

    if (salesOrderId) {
      const [order] = await connection.query('SELECT status FROM sales_orders WHERE id = ?', [salesOrderId]);
      if (order.length > 0) {
        const statusUpper = (order[0].status || '').toUpperCase().replace(/_/g, ' ').trim();
        // QUOTATION SENT: updates are allowed
        if (statusUpper === 'BOM SUBMITTED') {
          throw new Error('bom allready sent now cant update requirement');
        }
      }
    }

    for (const data of batchData) {
      const {
        clientName, projectName, drawingNo, revision, qty, description, filePath, fileType, remarks,
        uploadedBy, contactPerson, phoneNumber, emailAddress,
        customerType, gstin, city, state, billingAddress, shippingAddress,
        drawing_type, hsnCode, deliveryDate
      } = data;

      // Check if the drawing number already exists as an approved drawing
      await checkDuplicateApprovedDrawing(connection, drawingNo);

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
          clientName || null, projectName || null, drawingNo, revision || null, qty || 1, description || null, drawing_type || 'Part', hsnCode || null, deliveryDate || null, filePath || '', fileType || null, remarks || null,
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
  // Check if drawing is linked to any sales order that is QUOTATION_SENT or BOM_SUBMITTED
  const [orders] = await connection.query(
    `SELECT so.status 
     FROM sales_order_items soi
     JOIN sales_orders so ON soi.sales_order_id = so.id
     WHERE soi.drawing_id = ?`,
    [id]
  );
  for (const order of orders) {
    const statusUpper = (order.status || '').toUpperCase().replace(/_/g, ' ').trim();
    // QUOTATION SENT: updates are allowed
    if (statusUpper === 'BOM SUBMITTED') {
      throw new Error('bom allready sent now cant update requirement');
    }
  }

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
       MAX(d.delivery_date) as delivery_date,
       MAX(d.drawing_type) as drawing_type,
       MAX(d.qty) as qty,
       MAX(latest_bom.id) as id,
       MAX(latest_bom.bom_cost) as bom_cost, 
       MAX(latest_bom.item_group) as item_group, 
       MAX(latest_bom.unit) as unit,
       MAX(latest_bom.description) as description,
       MAX(latest_bom.item_code) as item_code
     FROM customer_drawings d
     LEFT JOIN (
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
         SELECT id FROM (
           SELECT 
             id,
             ROW_NUMBER() OVER (
               PARTITION BY COALESCE(drawing_id, drawing_no) 
               ORDER BY 
                 CASE 
                   WHEN item_group = 'Assembly' OR item_code LIKE 'SA-%' OR item_code LIKE 'SFG-%' THEN 1
                   WHEN item_type = 'FG' THEN 2
                   ELSE 3
                 END ASC,
                 id DESC
             ) as rn
           FROM sales_order_items
           WHERE bom_cost > 0
         ) t
         WHERE rn = 1
       )
     ) latest_bom ON (d.id = latest_bom.drawing_id OR (latest_bom.drawing_id IS NULL AND d.drawing_no = latest_bom.drawing_no))
     WHERE d.status IN ('APPROVED', 'SHARED', 'PENDING') OR d.shared_with_design = 1
     GROUP BY d.client_name, d.drawing_no
     ORDER BY MAX(d.created_at) DESC`
  );

  // Enrich with sub-assemblies for approved drawings
  const enrichedRows = await Promise.all(rows.map(async (row) => {
    try {
      let components = [];
      if (row.id) {
        components = await bomService.getItemComponents(row.id);
      } else if (row.drawing_no && row.drawing_no !== '—') {
        components = await bomService.getItemComponents(null, null, row.drawing_no);
      }

      if (components && components.length > 0) {
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
      }
    } catch (err) {
      console.error(`Error fetching components for item ${row.id || row.drawing_no}:`, err);
    }
    return { ...row, sub_assemblies: [] };
  }));

  return enrichedRows;
};

const getDrawingAutofetchDetails = async (id) => {
  const [drawingRows] = await pool.query(
    'SELECT * FROM customer_drawings WHERE id = ?',
    [id]
  );
  if (drawingRows.length === 0) return null;
  const drawing = drawingRows[0];

  // Find matched company
  let companyId = null;
  if (drawing.client_name) {
    const [companyRows] = await pool.query(
      'SELECT id FROM companies WHERE TRIM(UPPER(company_name)) = TRIM(UPPER(?)) LIMIT 1',
      [drawing.client_name]
    );
    if (companyRows.length > 0) {
      companyId = companyRows[0].id;
    }
  }

  // Find matched customer PO
  let poId = null;
  let poNumber = '';
  let projectName = drawing.project_name || '';
  let hostCompanyId = null;

  if (drawing.drawing_no) {
    let [poRows] = await pool.query(
      `SELECT cp.id, cp.po_number, cp.project_name, cp.host_company_id
       FROM customer_po_items cpi
       JOIN customer_pos cp ON cpi.customer_po_id = cp.id
       WHERE TRIM(UPPER(cpi.drawing_no)) = TRIM(UPPER(?)) OR TRIM(UPPER(cpi.item_code)) = TRIM(UPPER(?))
       ORDER BY cp.id DESC LIMIT 1`,
      [drawing.drawing_no, drawing.drawing_no]
    );

    if (poRows.length === 0) {
      [poRows] = await pool.query(
        `SELECT cp.id, cp.po_number, cp.project_name, cp.host_company_id
         FROM customer_po_item_subassemblies cpis
         JOIN customer_po_items cpi ON cpis.po_item_id = cpi.id
         JOIN customer_pos cp ON cpi.customer_po_id = cp.id
         WHERE TRIM(UPPER(cpis.drawing_no)) = TRIM(UPPER(?))
         ORDER BY cp.id DESC LIMIT 1`,
        [drawing.drawing_no]
      );
    }

    if (poRows.length > 0) {
      poId = poRows[0].id;
      poNumber = poRows[0].po_number;
      projectName = poRows[0].project_name || projectName;
      hostCompanyId = poRows[0].host_company_id || null;
    }
  }

  // Retrieve customer contact details
  let contactPerson = drawing.contact_person || '';
  let email = drawing.email || '';
  let phone = drawing.phone || '';
  let customerType = drawing.customer_type || '';
  let gstin = drawing.gstin || '';
  let city = drawing.city || '';
  let state = drawing.state || '';
  let billingAddress = drawing.billing_address || '';
  let shippingAddress = drawing.shipping_address || '';

  // If drawing doesn't have these details, load them from company if companyId exists
  if (companyId && (!contactPerson || !email || !phone || !billingAddress)) {
    const [companyDetails] = await pool.query(
      'SELECT * FROM companies WHERE id = ?',
      [companyId]
    );
    if (companyDetails.length > 0) {
      const company = companyDetails[0];
      customerType = customerType || company.customer_type || 'REGULAR';
      gstin = gstin || company.gstin || '';
      email = email || company.contact_email || '';
      phone = phone || company.contact_mobile || '';
      contactPerson = contactPerson || company.contact_person || '';

      const [contacts] = await pool.query('SELECT * FROM contacts WHERE company_id = ?', [companyId]);
      const primaryContact = contacts.find(ct => ct.contact_type === 'PRIMARY') || contacts[0];
      if (primaryContact) {
        contactPerson = contactPerson || primaryContact.name || '';
        email = email || primaryContact.email || '';
        phone = phone || primaryContact.phone || '';
      }

      const [addresses] = await pool.query('SELECT * FROM company_addresses WHERE company_id = ?', [companyId]);
      const billing = addresses.find(addr => addr.address_type === 'BILLING') || {};
      const shipping = addresses.find(addr => addr.address_type === 'SHIPPING') || {};

      const billingAddressStr = [billing.line1, billing.line2, billing.city, billing.state, billing.pincode].filter(Boolean).join(', ');
      const shippingAddressStr = [shipping.line1, shipping.line2, shipping.city, shipping.state, shipping.pincode].filter(Boolean).join(', ');

      billingAddress = billingAddress || billingAddressStr || '';
      shippingAddress = shippingAddress || shippingAddressStr || '';
      city = city || billing.city || '';
      state = state || billing.state || '';
    }
  }

  // Get items
  let items = [];
  let rate = 0;
  let sub_assemblies = [];
  let cgst_percent = 9;
  let sgst_percent = 9;
  let igst_percent = 0;
  let hsn_code = drawing.hsn_code || '';
  let delivery_date = drawing.delivery_date ? (drawing.delivery_date instanceof Date ? drawing.delivery_date.toISOString().split('T')[0] : drawing.delivery_date) : '';
  let bomId = null;

  const [bomRows] = await pool.query(
    `SELECT id FROM bom 
     WHERE TRIM(UPPER(drawing_no)) = TRIM(UPPER(?)) 
     ORDER BY id DESC LIMIT 1`,
    [drawing.drawing_no]
  );
  if (bomRows.length > 0) {
    bomId = bomRows[0].id;
  }

  const [soiRows] = await pool.query(
    `SELECT bom_cost FROM sales_order_items 
     WHERE TRIM(UPPER(drawing_no)) = TRIM(UPPER(?)) AND bom_cost > 0
     ORDER BY id DESC LIMIT 1`,
    [drawing.drawing_no]
  );
  if (soiRows.length > 0) {
    rate = Number(soiRows[0].bom_cost) || 0;
  }

  if (poId) {
    const [poItemRows] = await pool.query(
      `SELECT * FROM customer_po_items 
       WHERE customer_po_id = ? AND (TRIM(UPPER(drawing_no)) = TRIM(UPPER(?)) OR TRIM(UPPER(item_code)) = TRIM(UPPER(?)))
       LIMIT 1`,
      [poId, drawing.drawing_no, drawing.drawing_no]
    );
    if (poItemRows.length > 0) {
      const poItem = poItemRows[0];
      rate = Number(poItem.rate) || rate;
      cgst_percent = Number(poItem.cgst_percent) || cgst_percent;
      sgst_percent = Number(poItem.sgst_percent) || sgst_percent;
      igst_percent = Number(poItem.igst_percent) || igst_percent;
      hsn_code = poItem.hsn_code || hsn_code;
      if (poItem.delivery_date) {
        delivery_date = poItem.delivery_date instanceof Date ? poItem.delivery_date.toISOString().split('T')[0] : poItem.delivery_date;
      }
      
      const [storedSA] = await pool.query(
        `SELECT drawing_no, drawing_no as drawingNo, description, quantity, unit, rate, hsn_code, delivery_date 
         FROM customer_po_item_subassemblies 
         WHERE po_item_id = ?`,
         [poItem.id]
      );
      sub_assemblies = storedSA.map(sa => ({
        ...sa,
        quantity: Number(sa.quantity) || 0,
        rate: Number(sa.rate) || 0
      }));
    } else {
      const [poSaRows] = await pool.query(
        `SELECT cpis.*, cpi.cgst_percent, cpi.sgst_percent, cpi.igst_percent
         FROM customer_po_item_subassemblies cpis
         JOIN customer_po_items cpi ON cpis.po_item_id = cpi.id
         WHERE cpi.customer_po_id = ? AND TRIM(UPPER(cpis.drawing_no)) = TRIM(UPPER(?))
         LIMIT 1`,
        [poId, drawing.drawing_no]
      );
      if (poSaRows.length > 0) {
        const poSa = poSaRows[0];
        rate = Number(poSa.rate) || rate;
        cgst_percent = Number(poSa.cgst_percent) || cgst_percent;
        sgst_percent = Number(poSa.sgst_percent) || sgst_percent;
        igst_percent = Number(poSa.igst_percent) || igst_percent;
        hsn_code = poSa.hsn_code || hsn_code;
        if (poSa.delivery_date) {
          delivery_date = poSa.delivery_date instanceof Date ? poSa.delivery_date.toISOString().split('T')[0] : poSa.delivery_date;
        }
      }
    }
  }

  if (sub_assemblies.length === 0 && bomId) {
    try {
      const components = await bomService.getItemComponents(null, null, drawing.drawing_no);
      if (components && components.length > 0) {
        sub_assemblies = components.map(c => ({
          drawingNo: c.drawing_no || c.component_code || c.item_code || '',
          description: c.description || 'Sub-assembly',
          quantity: Number(c.quantity) || 0,
          unit: c.unit || c.uom || 'NOS',
          rate: Number(c.rate || c.bom_cost || 0),
          hsn_code: c.hsn_code || '',
          delivery_date: c.delivery_date || ''
        }));
      }
    } catch (err) {
      console.error('Error fetching BOM components for auto-fetch:', err);
    }
  }

  items.push({
    item_code: drawing.drawing_no,
    drawing_no: drawing.drawing_no,
    description: drawing.description || drawing.project_name || 'Finished Good',
    type: drawing.drawing_type || 'Finished Good',
    quantity: Number(drawing.qty) || 1,
    rate,
    amount: rate * (Number(drawing.qty) || 1),
    cgst_percent,
    sgst_percent,
    igst_percent,
    hsn_code,
    delivery_date,
    sub_assemblies
  });

  return {
    drawingId: drawing.id,
    drawingNo: drawing.drawing_no,
    finishedGoodName: drawing.description || drawing.project_name || '',
    designQty: drawing.qty || 1,
    poId,
    poNumber,
    projectName,
    companyId,
    clientName: drawing.client_name,
    contactPerson,
    email,
    phone,
    customerType,
    gstin,
    city,
    state,
    billingAddress,
    shippingAddress,
    hostCompanyId,
    items
  };
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
  getApprovedDrawings,
  getDrawingAutofetchDetails
};
