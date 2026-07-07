const pool = require('../config/db');
const emailService = require('../utils/emailService');
const designOrderService = require('../services/designOrderService');
const bomService = require('../services/bomService');

const getQuotationRequests = async (req, res, next) => {
  try {
    const { status, company_id } = req.query;
    let query = `
      SELECT *, COALESCE(total_amount / NULLIF(item_qty, 0), 0) as unit_rate FROM (
        SELECT qr.id as qr_id, qr.sales_order_id, qr.company_id, qr.status, qr.total_amount, qr.received_amount, qr.notes, qr.created_at, qr.rejection_reason, qr.reply_pdf,
               qr.profit_percentage, qr.override_percentage, qr.gst_percentage, qr.pending_bom_cost,
               qr.discount_type, qr.discount_value,
               qr.version, qr.parent_id, qr.batch_id, qr.host_company_id,
               COALESCE(qr.project_name, so.project_name, 'Manual Quotation') as project_name, 
               so.bom_id, c.company_name, 
               COALESCE(qr.client_email, cd_proj.email, cd_contact.email, ct.email, '') as client_email,
               COALESCE(qr.client_phone, cd_proj.phone, cd_contact.phone, ct.phone, '') as client_phone,
               COALESCE(qr.contact_person, cd_proj.contact_person, cd_contact.contact_person, ct.name, '') as contact_person,
               COALESCE(qr.client_address, cd_proj.billing_address, (SELECT CONCAT(line1, ', ', IFNULL(line2, ''), city, ', ', state, ' ', pincode) FROM company_addresses WHERE company_id = c.id LIMIT 1)) as client_address,
               cp.po_number,
               qr.drawing_no as drawing_no,
               COALESCE(qr.description, soi.description, '—') as item_description,
               COALESCE(
                 qr.item_qty, 
                 poi.quantity,
                 (SELECT MAX(quantity) FROM sales_order_items WHERE sales_order_id = soi.sales_order_id AND TRIM(drawing_no) = TRIM(soi.drawing_no)),
                 soi.quantity, 
                 0
               ) as item_qty,
               COALESCE(soi.unit, qr.item_unit, 'NOS') as item_unit,
               COALESCE(soi.unit, qr.item_unit, 'NOS') as uom,
               COALESCE(qr.item_group, soi.item_group, 'ASSEMBLY') as item_group,
               COALESCE(soi.item_code, qr.item_code) as item_code,
               (
                 SELECT bom_cost FROM sales_order_items v2 
                 WHERE ((v2.bom_id = soi.bom_id AND soi.bom_id IS NOT NULL)
                    OR (v2.item_code = soi.item_code AND v2.drawing_no = soi.drawing_no AND v2.item_code IS NOT NULL AND v2.drawing_no IS NOT NULL))
                    AND v2.bom_cost > 0
                 ORDER BY v2.id DESC LIMIT 1
               ) as latest_bom_cost,
               qr.id as id
        FROM quotation_requests qr
        LEFT JOIN sales_orders so ON so.id = qr.sales_order_id
        JOIN companies c ON c.id = qr.company_id
        LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
        LEFT JOIN sales_order_items soi ON (soi.id = qr.sales_order_item_id AND qr.status != 'COMPONENT')
        LEFT JOIN customer_po_items poi ON so.customer_po_id = poi.customer_po_id 
             AND (TRIM(soi.drawing_no) = TRIM(poi.drawing_no) AND soi.drawing_no IS NOT NULL)
        LEFT JOIN (
          SELECT company_id, email, phone, name, 
                 ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY contact_type = 'PRIMARY' DESC, id ASC) as rn
          FROM contacts
        ) ct ON ct.company_id = c.id AND ct.rn = 1
        LEFT JOIN (
          SELECT soi.sales_order_id, cd.contact_person, cd.phone, cd.email,
                 ROW_NUMBER() OVER (PARTITION BY soi.sales_order_id ORDER BY cd.id ASC) as rn
          FROM sales_order_items soi
          JOIN customer_drawings cd ON soi.drawing_id = cd.id
          WHERE cd.contact_person IS NOT NULL OR cd.phone IS NOT NULL OR cd.email IS NOT NULL
        ) cd_contact ON cd_contact.sales_order_id = qr.sales_order_id AND cd_contact.rn = 1
        LEFT JOIN (
          SELECT client_name, project_name, email, phone, contact_person, billing_address,
                 ROW_NUMBER() OVER (PARTITION BY client_name, project_name ORDER BY id DESC) as rn
          FROM customer_drawings
          WHERE contact_person IS NOT NULL OR phone IS NOT NULL OR email IS NOT NULL
        ) cd_proj ON cd_proj.client_name = c.company_name 
                 AND TRIM(LOWER(cd_proj.project_name)) = TRIM(LOWER(COALESCE(qr.project_name, so.project_name)))
                 AND cd_proj.rn = 1
      ) qry
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      const statusArray = status.split(',').map(s => s.trim());
      query += ` AND TRIM(status) IN (${statusArray.map(() => '?').join(',')})`;
      params.push(...statusArray);
    }

    if (company_id) {
      query += ` AND company_id = ?`;
      params.push(company_id);
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(query, params);

    // Fetch all components for all requested batches
    const batchIds = [...new Set(rows.map(r => r.batch_id).filter(Boolean))];
    let batchComponents = [];
    if (batchIds.length > 0) {
      const [compRows] = await pool.query(
        `SELECT qr.id, qr.batch_id, qr.rejection_reason, qr.version,
                COALESCE(soi.drawing_no, qr.drawing_no, qr.item_code) as drawing_no, 
                COALESCE(soi.description, qr.description) as description, 
                qr.item_unit as unit, qr.item_qty as quantity,
                qr.item_group, qr.bom_cost, qr.received_amount as rate, qr.item_code, qr.pending_bom_cost,
                1 as is_cost_frozen,
                COALESCE(sb.current_balance, 0) as available_stock
         FROM quotation_requests qr
         LEFT JOIN (
           SELECT item_code, drawing_no, description
           FROM sales_order_items 
           WHERE id IN (
             SELECT MAX(id) 
             FROM sales_order_items 
             WHERE sales_order_id IS NULL
             GROUP BY item_code
           )
         ) soi ON LOWER(TRIM(qr.item_code)) = LOWER(TRIM(soi.item_code))
         LEFT JOIN (
           SELECT item_code, SUM(current_balance) as current_balance
           FROM stock_balance
           GROUP BY item_code
         ) sb ON LOWER(TRIM(qr.item_code)) = LOWER(TRIM(sb.item_code))
         WHERE qr.batch_id IN (?) AND qr.status = 'COMPONENT'`,
        [batchIds]
      );
      batchComponents = compRows.map(row => ({
        ...row,
        qty: row.quantity || row.qty,
        quantity: row.quantity || row.qty,
        rate: parseFloat(row.rate || 0),
        bom_cost: parseFloat(row.bom_cost || 0),
        pending_bom_cost: row.pending_bom_cost ? parseFloat(row.pending_bom_cost) : null,
        is_cost_frozen: true,
        available_stock: parseFloat(row.available_stock || 0)
      }));
    }

    const batchComponentsMap = {};
    for (const r of rows) {
      const bId = r.batch_id;
      if (!bId) continue;

      if (!batchComponentsMap[bId]) {
        const parentsInBatch = rows.filter(p => p.batch_id === bId);
        const compsInBatch = batchComponents.filter(c => c.batch_id === bId);

        batchComponentsMap[bId] = {
          parents: parentsInBatch,
          components: compsInBatch
        };
      }
    }

    // Enrich with sub-assemblies for items with BOM structure
    const enrichedRows = await Promise.all(rows.map(async (row) => {
      const itemCode = row.item_code || null;
      const drawingNo = (row.drawing_no && row.drawing_no !== '—') ? row.drawing_no : null;
      const soiId = row.sales_order_item_id || null;

      const g = (row.item_group || '').toUpperCase();
      const isAssembly = g.includes('ASSEMBLY');

      if (!isAssembly) {
        return { ...row, sub_assemblies: [] };
      }

      if (row.batch_id && batchComponentsMap[row.batch_id]) {
        const { parents, components } = batchComponentsMap[row.batch_id];
        const matchingParents = parents.filter(p => 
          (p.item_code === itemCode && p.item_code !== null) ||
          (p.drawing_no === drawingNo && p.drawing_no !== null && p.drawing_no !== '—' && p.drawing_no !== 'NA')
        );

        const parentIds = matchingParents.map(p => String(p.id || p.qr_id || p.parent_id));
        const parentDrawings = matchingParents.map(p => p.drawing_no).filter(d => d && d !== '—' && d !== 'NA');
        const parentDescs = matchingParents.map(p => p.description || p.item_description).filter(Boolean);

        const matchCandidates = new Set([
          ...parentIds,
          ...parentDrawings,
          ...parentDescs,
          drawingNo
        ]);

        const matchedComponents = components.filter(c => 
          (row.version === undefined || c.version === row.version) &&
          matchCandidates.has(String(c.rejection_reason))
        );

        if (matchedComponents.length > 0) {
          return { ...row, sub_assemblies: matchedComponents };
        }
      }

      if (soiId || itemCode || drawingNo) {
        try {
          const components = await bomService.getItemComponents(
            `HISTORICAL_${soiId}`,
            itemCode,
            drawingNo,
            row.batch_id,
            row.created_at,
            row.version
          );
          const sub_assemblies = components;
          return { ...row, sub_assemblies };
        } catch (err) {
          console.error(`Error fetching sub-assemblies for QR ${row.id}:`, err);
          return { ...row, sub_assemblies: [] };
        }
      }
      return { ...row, sub_assemblies: [] };
    }));

    res.json(enrichedRows);
  } catch (error) {
    next(error);
  }
};

const getQuotationVersionHistory = async (req, res, next) => {
  try {
    const { id } = req.params;

    // First, find the root parent ID and other metadata for grouping siblings
    const [quotes] = await pool.query(
      'SELECT id, parent_id, company_id, project_name, created_at, batch_id FROM quotation_requests WHERE id = ?',
      [id]
    );

    if (quotes.length === 0) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    const targetQuote = quotes[0];
    let rootId = targetQuote.parent_id || targetQuote.id;

    // Fetch all items in the chain. 
    // We search by parent_id link, OR same batch_id, OR same legacy grouping (company + project + created_at)
    const [rows] = await pool.query(
      `SELECT qr.*, c.company_name, 
              qr.drawing_no as drawing_no,
              COALESCE(qr.description, soi.description) as item_description,
              COALESCE(soi.unit, qr.item_unit) as item_unit,
              COALESCE(soi.item_code, qr.item_code) as item_code,
              COALESCE(sb.current_balance, 0) as available_stock,
              COALESCE(qr.client_email, cd_proj.email, cd_contact.email, ct.email, '') as resolved_client_email,
              COALESCE(qr.client_phone, cd_proj.phone, cd_contact.phone, ct.phone, '') as resolved_client_phone,
              COALESCE(qr.contact_person, cd_proj.contact_person, cd_contact.contact_person, ct.name, '') as resolved_contact_person,
              COALESCE(qr.client_address, cd_proj.billing_address, (SELECT CONCAT(line1, ', ', IFNULL(line2, ''), city, ', ', state, ' ', pincode) FROM company_addresses WHERE company_id = c.id LIMIT 1)) as resolved_client_address,
              (
                SELECT bom_cost FROM sales_order_items v2 
                WHERE ((v2.bom_id = soi.bom_id AND soi.bom_id IS NOT NULL)
                   OR (LOWER(TRIM(v2.item_code)) = LOWER(TRIM(soi.item_code)) AND LOWER(TRIM(v2.drawing_no)) = LOWER(TRIM(soi.drawing_no)) AND v2.item_code IS NOT NULL AND v2.drawing_no IS NOT NULL)
                   OR (LOWER(TRIM(v2.drawing_no)) = LOWER(TRIM(qr.drawing_no)) AND qr.drawing_no IS NOT NULL AND LOWER(TRIM(v2.description)) = LOWER(TRIM(qr.description))))
                   AND v2.bom_cost > 0
                ORDER BY (v2.item_group = soi.item_group) DESC, v2.id DESC LIMIT 1
              ) as latest_bom_cost
       FROM quotation_requests qr
       JOIN companies c ON qr.company_id = c.id
       LEFT JOIN sales_order_items soi ON (soi.id = qr.sales_order_item_id AND qr.status != 'COMPONENT')
       LEFT JOIN (
         SELECT item_code, SUM(current_balance) as current_balance
         FROM stock_balance
         GROUP BY item_code
       ) sb ON LOWER(TRIM(COALESCE(soi.item_code, qr.item_code))) = LOWER(TRIM(sb.item_code))
       LEFT JOIN (
         SELECT company_id, email, phone, name, 
                ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY contact_type = 'PRIMARY' DESC, id ASC) as rn
         FROM contacts
       ) ct ON ct.company_id = c.id AND ct.rn = 1
       LEFT JOIN (
         SELECT soi.sales_order_id, cd.contact_person, cd.phone, cd.email,
                ROW_NUMBER() OVER (PARTITION BY soi.sales_order_id ORDER BY cd.id ASC) as rn
         FROM sales_order_items soi
         JOIN customer_drawings cd ON soi.drawing_id = cd.id
         WHERE cd.contact_person IS NOT NULL OR cd.phone IS NOT NULL OR cd.email IS NOT NULL
       ) cd_contact ON cd_contact.sales_order_id = qr.sales_order_id AND cd_contact.rn = 1
       LEFT JOIN (
         SELECT client_name, project_name, email, phone, contact_person, billing_address,
                ROW_NUMBER() OVER (PARTITION BY client_name, project_name ORDER BY id DESC) as rn
         FROM customer_drawings
         WHERE contact_person IS NOT NULL OR phone IS NOT NULL OR email IS NOT NULL
       ) cd_proj ON cd_proj.client_name = c.company_name 
                AND TRIM(LOWER(cd_proj.project_name)) = TRIM(LOWER(qr.project_name))
                AND cd_proj.rn = 1
       WHERE qr.id = ? OR qr.parent_id = ? 
          OR qr.parent_id IN (SELECT id FROM quotation_requests WHERE id = ? OR parent_id = ?)
          OR qr.id IN (SELECT parent_id FROM quotation_requests WHERE id = ?)
          OR (qr.batch_id IS NOT NULL AND qr.batch_id = ?)
          OR (qr.company_id = ? AND qr.project_name = ? AND ABS(TIMESTAMPDIFF(SECOND, qr.created_at, ?)) < 60)
       ORDER BY qr.version ASC, qr.id ASC`,
      [rootId, rootId, rootId, rootId, id, targetQuote.batch_id, targetQuote.company_id, targetQuote.project_name, targetQuote.created_at]
    );

    // Separate main items from component snapshots for each version
    const versionGroups = [];
    const versionMap = {};

    // 1. Group rows by version and filter out 'COMPONENT' snapshots for top-level list
    for (const row of rows) {
      if (!versionMap[row.version]) {
        versionMap[row.version] = {
          id: row.id,
          version: row.version,
          status: row.status,
          created_at: row.created_at,
          total_amount: 0,
          received_amount: 0,
          project_name: row.project_name,
          notes: row.notes,
          batch_id: row.batch_id,
          company_id: row.company_id,
          company_name: row.company_name,
          host_company_id: row.host_company_id,
          client_email: row.resolved_client_email,
          client_phone: row.resolved_client_phone,
          contact_person: row.resolved_contact_person,
          client_address: row.resolved_client_address,
          discount_type: row.discount_type || 'percentage',
          discount_value: parseFloat(row.discount_value) || 0,
          items: []
        };
        versionGroups.push(versionMap[row.version]);
      }

      const group = versionMap[row.version];
      const s = (row.status || '').toUpperCase();

      // SNAPSHOT DATA: If status is 'COMPONENT', it belongs to an item's sub_assemblies array, NOT the main list
      if (s === 'COMPONENT') continue;

      // Avoid pushing duplicate items if the SQL query returned the same row multiple times due to broad filters
      if (group.items.find(it => it.id === row.id)) continue;

      const lineTotal = parseFloat(row.total_amount) || 0;
      const lineTotalInclGst = parseFloat(row.received_amount) || 0;

      group.total_amount += lineTotal;
      group.received_amount += lineTotalInclGst;

      const itemRate = parseFloat(lineTotal / (row.item_qty || 1)) || 0;

      const itemData = {
        id: row.id,
        sales_order_item_id: row.sales_order_item_id,
        item_code: row.item_code,
        drawing_no: row.drawing_no,
        description: row.item_description,
        quantity: row.item_qty,
        unit: row.item_unit,
        rate: itemRate,
        bom_cost: parseFloat(row.bom_cost) || 0,
        latest_bom_cost: parseFloat(row.latest_bom_cost) || 0,
        total: lineTotal,
        profit_percentage: parseFloat(row.profit_percentage) || 0,
        override_percentage: parseFloat(row.override_percentage) || 0,
        gst_percentage: row.gst_percentage,
        item_group: row.item_group,
        status: row.status,
        sub_assemblies: [],
        materials: [],
        operations: [],
        scrap: []
      };

      // 2. ENRICH: Find component snapshots in the SAME VERSION and SAME BATCH for this item
      const snapshots = rows.filter(r =>
        r.version === row.version &&
        r.batch_id === row.batch_id &&
        (r.status || '').toUpperCase() === 'COMPONENT' &&
        (r.rejection_reason === row.drawing_no || r.rejection_reason === row.item_description || r.rejection_reason === String(row.id))
      );

      if (snapshots.length > 0) {
        const seen = new Set();
        const uniqueSnapshots = snapshots.filter(sn => {
          const code = String(sn.item_code || sn.drawing_no || sn.description || '').trim().toLowerCase();
          if (seen.has(code)) return false;
          seen.add(code);
          return true;
        });

        itemData.sub_assemblies = uniqueSnapshots.map(sn => ({
          item_code: sn.item_code,
          drawing_no: sn.drawing_no,
          description: sn.description,
          quantity: sn.item_qty,
          unit: sn.item_unit,
          item_group: sn.item_group,
          bom_cost: parseFloat(sn.bom_cost) || 0,
          rate: parseFloat(sn.bom_cost) || 0,
          pending_bom_cost: sn.pending_bom_cost ? parseFloat(sn.pending_bom_cost) : null,
          is_snapshot: true,
          available_stock: parseFloat(sn.available_stock || 0)
        }));

        // Even if we have snapshots, we might need materials/ops for the full breakdown calculation in frontend
        try {
          const [materials, operations, scrap] = await Promise.all([
            bomService.getItemMaterials(`HISTORICAL_${row.sales_order_item_id}`, row.item_code, row.drawing_no),
            bomService.getItemOperations(`HISTORICAL_${row.sales_order_item_id}`, row.item_code, row.drawing_no),
            bomService.getItemScrap(`HISTORICAL_${row.sales_order_item_id}`, row.item_code, row.drawing_no)
          ]);
          itemData.materials = materials;
          itemData.operations = operations;
          itemData.scrap = scrap;
        } catch (e) { /* ignore */ }
      } else {
        // FALLBACK: If no snapshot found in DB, try live lookup
        try {
          const [materials, components, operations, scrap] = await Promise.all([
            bomService.getItemMaterials(`HISTORICAL_${row.sales_order_item_id}`, row.item_code, row.drawing_no),
            bomService.getItemComponents(`HISTORICAL_${row.sales_order_item_id}`, row.item_code, row.drawing_no, row.batch_id, row.created_at, row.version),
            bomService.getItemOperations(`HISTORICAL_${row.sales_order_item_id}`, row.item_code, row.drawing_no),
            bomService.getItemScrap(`HISTORICAL_${row.sales_order_item_id}`, row.item_code, row.drawing_no)
          ]);

          const g = (row.item_group || '').toUpperCase();
          const isAssembly = g.includes('ASSEMBLY');
          const isPart = g.includes('PART');
          itemData.sub_assemblies = isAssembly ? components : [];

          itemData.materials = materials;
          itemData.operations = operations;
          itemData.scrap = scrap;
        } catch (err) {
          console.error(`Fallback component fetch failed for QR ${row.id}:`, err.message);
        }
      }

      group.items.push(itemData);
    }

    res.json(versionGroups);
  } catch (error) {
    next(error);
  }
};

const approveQuotationRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    await pool.execute(
      'UPDATE quotation_requests SET status = ?, updated_at = NOW() WHERE id = ?',
      ['APPROVED', id]
    );

    res.json({ message: 'Quotation request approved' });
  } catch (error) {
    next(error);
  }
};

const batchApproveQuotationRequests = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    let ids = req.body?.ids;

    // Handle FormData stringified array
    if (typeof ids === 'string') {
      try {
        ids = JSON.parse(ids);
      } catch (e) {
        ids = ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      }
    }

    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'IDs array is required' });
    }

    const replyPdfPath = req.file ? `uploads/${req.file.filename}` : null;

    await connection.beginTransaction();
    for (const id of ids) {
      if (replyPdfPath) {
        await connection.execute(
          'UPDATE quotation_requests SET status = ?, reply_pdf = ?, updated_at = NOW() WHERE id = ?',
          ['APPROVED', replyPdfPath, id]
        );
      } else {
        await connection.execute(
          'UPDATE quotation_requests SET status = ?, updated_at = NOW() WHERE id = ?',
          ['APPROVED', id]
        );
      }
    }
    await connection.commit();
    res.json({ message: 'Quotations moved to approval' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

const batchSendToDesign = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const ids = req.body?.ids; // Quotation Request IDs
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'IDs array is required' });
    }

    await connection.beginTransaction();

    // 1. Get unique Sales Order IDs from these quotation requests
    const [quotes] = await connection.query(
      `SELECT DISTINCT sales_order_id FROM quotation_requests WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids
    );

    const salesOrderIds = quotes.map(q => q.sales_order_id);

    // 2. Update Quotation Requests status
    await connection.execute(
      `UPDATE quotation_requests SET status = ?, updated_at = NOW() WHERE id IN (${ids.map(() => '?').join(',')})`,
      ['COMPLETED', ...ids]
    );

    // 3. Update Sales Orders status and move to Design - DISABLED AS PER NEW RULE
    if (salesOrderIds.length > 0) {
      /*
      await connection.execute(
        `UPDATE sales_orders SET status = ?, current_department = ?, request_accepted = 1, updated_at = NOW() 
         WHERE id IN (${salesOrderIds.map(() => '?').join(',')})`,
        ['DESIGN_IN_REVIEW', 'DESIGN_ENG', ...salesOrderIds]
      );
      */

      // 4. Create Design Orders
      for (const soId of salesOrderIds) {
        await designOrderService.createDesignOrder(soId, connection, 'IN_DESIGN');
      }
    }

    await connection.commit();
    res.json({ message: 'Quotations sent to Design Engineering' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

const rejectQuotationRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await pool.execute(
      'UPDATE quotation_requests SET status = ?, rejection_reason = ?, updated_at = NOW() WHERE id = ?',
      ['REJECTED', reason || null, id]
    );

    res.json({ message: 'Quotation request rejected' });
  } catch (error) {
    next(error);
  }
};

const sendQuotationViaEmail = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const resolvedClientId = req.body.clientId || req.body.company_id;
    const resolvedClientName = req.body.clientName || req.body.company_name;
    const resolvedClientEmail = req.body.clientEmail || req.body.email;
    const resolvedClientPhone = req.body.clientPhone || req.body.phone;
    const resolvedContactPerson = req.body.contactPerson || req.body.contact_person;
    const resolvedClientAddress = req.body.clientAddress || req.body.address;

    const { 
      items, 
      totalAmount, 
      notes, 
      emailRequired = true, 
      status, 
      projectName, 
      clearPendingBomId,
      customSubject,
      customMessage,
      attachPDF,
      customAttachments,
      cc,
      bcc
    } = req.body;

    if (!resolvedClientId || !items || items.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields: clientId, items'
      });
    }

    if (emailRequired && (!resolvedClientEmail || !resolvedClientName)) {
      return res.status(400).json({
        error: 'Missing required fields for email: clientEmail, clientName'
      });
    }

    await connection.beginTransaction();

    if (clearPendingBomId) {
      await connection.execute(
        'UPDATE quotation_requests SET pending_bom_cost = NULL WHERE id = ?',
        [clearPendingBomId]
      );
    }

    // Fetch all existing valid sales order IDs
    const [orderRows] = await connection.query('SELECT id FROM sales_orders');
    const validOrderIds = new Set(orderRows.map(r => r.id));

    // Fetch all existing valid sales order item IDs
    const [itemRows] = await connection.query('SELECT id FROM sales_order_items');
    const validOrderItemIds = new Set(itemRows.map(r => r.id));

    const batchId = req.body.batch_id || `BATCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const finalVersion = req.body.version || 1;

    // Sanitize and validate parent_id to avoid foreign key violations
    const rawParentId = req.body.parentId || null;
    let finalParentId = null;
    if (rawParentId) {
      const [parentRows] = await connection.query('SELECT id FROM quotation_requests WHERE id = ?', [rawParentId]);
      if (parentRows.length > 0) {
        finalParentId = Number(rawParentId);
      }
    }

    // If this is a revision, load parent details as fallback for contact info
    let parentQuote = null;
    if (finalParentId) {
      const [parentRows] = await connection.query(
        'SELECT client_email, client_phone, contact_person, client_address FROM quotation_requests WHERE id = ?',
        [finalParentId]
      );
      if (parentRows.length > 0) {
        parentQuote = parentRows[0];
      }
    }

    // Resolve snapshot contact details (with fallbacks if frontend didn't supply them)
    let finalClientEmail = resolvedClientEmail || (parentQuote ? parentQuote.client_email : null);
    let finalClientPhone = resolvedClientPhone || (parentQuote ? parentQuote.client_phone : null);
    let finalContactPerson = resolvedContactPerson || (parentQuote ? parentQuote.contact_person : null);
    let finalClientAddress = resolvedClientAddress || (parentQuote ? parentQuote.client_address : null);

    if (!finalClientEmail || !finalClientPhone || !finalContactPerson || !finalClientAddress) {
      const [contactRows] = await connection.query(
        `SELECT email, phone, name FROM contacts WHERE company_id = ? 
         ORDER BY contact_type = 'PRIMARY' DESC, id ASC LIMIT 1`,
        [resolvedClientId]
      );
      if (contactRows.length > 0) {
        if (!finalClientEmail) finalClientEmail = contactRows[0].email || '';
        if (!finalClientPhone) finalClientPhone = contactRows[0].phone || '';
        if (!finalContactPerson) finalContactPerson = contactRows[0].name || '';
      }
      if (!finalClientAddress) {
        const [addrRows] = await connection.query(
          `SELECT line1, line2, city, state, pincode FROM company_addresses WHERE company_id = ? LIMIT 1`,
          [resolvedClientId]
        );
        if (addrRows.length > 0) {
          finalClientAddress = [addrRows[0].line1, addrRows[0].line2, addrRows[0].city, addrRows[0].state, addrRows[0].pincode]
            .filter(Boolean)
            .join(', ');
        }
      }
    }

    const quotationIds = [];
    const sanitizedSalesOrderIds = new Set();

    // Process items SEQUENTIALLY to allow linking components to their parent insertId
    for (const item of items) {
      try {
        // 1. Save Parent Item
        const lineTotal = (item.quotedPrice || item.quoted_price || 0) * (item.quantity || 1);
        const gstRate = parseFloat(item.gst_percentage) || 18;
        const lineTotalInclGst = lineTotal * (1 + gstRate / 100);

        const finalStatus = (status || item.status || 'SENT').toUpperCase();

        // Sanitize sales_order_id and sales_order_item_id
        const rawOrderId = Number(item.orderId || item.sales_order_id);
        const salesOrderId = (!isNaN(rawOrderId) && validOrderIds.has(rawOrderId)) ? rawOrderId : null;

        const rawOrderItemId = Number(item.salesOrderItemId || item.sales_order_item_id);
        const salesOrderItemId = (!isNaN(rawOrderItemId) && validOrderItemIds.has(rawOrderItemId)) ? rawOrderItemId : null;

        if (salesOrderId) {
          sanitizedSalesOrderIds.add(salesOrderId);
        }

        const [result] = await connection.execute(
          `INSERT INTO quotation_requests (
             sales_order_id, sales_order_item_id, item_qty, company_id, 
             status, total_amount, received_amount, rejection_reason, 
             notes, created_at, profit_percentage, override_percentage, gst_percentage,
             version, parent_id, drawing_no, description, item_unit,
             project_name, batch_id, item_group, bom_cost, item_code, host_company_id,
             client_email, client_phone, contact_person, client_address,
             discount_type, discount_value, item_notes
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            salesOrderId,
            salesOrderItemId,
            item.quantity || 0,
            resolvedClientId,
            finalStatus,
            lineTotal,
            lineTotalInclGst,
            item.rejection_reason || null,
            notes || null,
            item.profit_percentage || 0,
            item.override_percentage || 0,
            gstRate,
            finalVersion,
            finalParentId,
            item.drawing_no || null,
            item.description || null,
            item.unit || 'Nos',
            projectName || null,
            batchId,
            item.item_group || item.item_group_calc || null,
            item.bom_cost || 0,
            item.item_code || null,
            req.body.hostCompanyId ? Number(req.body.hostCompanyId) : null,
            finalClientEmail,
            finalClientPhone,
            finalContactPerson,
            finalClientAddress,
            req.body.discount_type || 'percentage',
            parseFloat(req.body.discount_value) || 0,
            item.item_notes || null
          ]
        );

        const parentQrId = result.insertId;
        quotationIds.push(parentQrId);

        // 2. Save Sub-Assemblies (Components) linked by parentQrId
        // Prioritize sub_assemblies passed from the frontend to preserve snapshot costs
        let components = item.sub_assemblies && item.sub_assemblies.length > 0 ? item.sub_assemblies : null;

        if (!components) {
          components = await bomService.getItemComponents(
            salesOrderItemId,
            item.item_code,
            item.drawing_no
          );
        }

        for (const sa of components) {
          await connection.execute(
            `INSERT INTO quotation_requests (
               company_id, status, total_amount, received_amount, 
               created_at, version, parent_id, drawing_no, description, 
               item_unit, item_qty, batch_id, item_group, bom_cost, 
               project_name, item_code, rejection_reason,
               client_email, client_phone, contact_person, client_address
             ) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              resolvedClientId,
              'COMPONENT',
              0,
              sa.rate || sa.bom_cost || 0,
              finalVersion,
              finalParentId,
              sa.drawing_no || null,
              sa.description || null,
              sa.unit || 'Nos',
              sa.quantity || 0,
              batchId,
              sa.item_group || 'PART',
              sa.bom_cost || 0,
              projectName || null,
              sa.item_code || null,
              String(parentQrId),
              finalClientEmail,
              finalClientPhone,
              finalContactPerson,
              finalClientAddress
            ]
          );
        }
      } catch (error) {
        console.error('[Quotation Controller] Error saving item/components:', error.message);
        throw error;
      }
    }

    const uniqueOrderIds = [...sanitizedSalesOrderIds];

    if (uniqueOrderIds.length > 0 && (status || 'SENT').toUpperCase() !== 'DRAFT') {
      // Link SO to the first quotation ID in the batch to mark it as quoted
      const firstQuoteId = quotationIds[0];
      await connection.execute(
        `UPDATE sales_orders SET status = ?, current_department = ?, request_accepted = 1, quotation_id = ?, updated_at = NOW() 
         WHERE id IN (${uniqueOrderIds.map(() => '?').join(',')})`,
        ['QUOTATION_SENT', 'SALES', firstQuoteId, ...uniqueOrderIds]
      );
    }

    await connection.commit();

    let emailSent = false;
    let emailMessageId = null;
    const firstQuotationId = quotationIds[0];
    const quoteNumber = `QRT-${String(firstQuotationId).padStart(4, '0')}`;
    const totalAmountNum = parseFloat(totalAmount) || 0;

    if (emailRequired) {
      try {
        const emailResult = await emailService.sendQuotationEmail(
          resolvedClientEmail,
          resolvedClientName,
          items,
          totalAmountNum,
          notes,
          resolvedClientId,
          quoteNumber,
          req.body.hostCompanyId,
          {
            email: finalClientEmail,
            phone: finalClientPhone,
            contact_person: finalContactPerson,
            address: finalClientAddress
          },
          customSubject,
          customMessage,
          attachPDF !== undefined ? attachPDF : true,
          customAttachments || [],
          cc,
          bcc
        );
        emailSent = true;
        emailMessageId = emailResult.messageId;

        // Log to communications for ALL quotations in this batch
        const messageText = `Quotation ${quoteNumber} sent to client.\nTotal Amount (Incl. GST): ₹${totalAmountNum.toLocaleString('en-IN')}\nItems: ${items.length}`;

        for (const qId of quotationIds) {
          await pool.execute(
            `INSERT INTO quotation_communications 
             (quotation_id, quotation_type, sender_type, message, email_message_id, created_at, is_read) 
             VALUES (?, ?, ?, ?, ?, NOW(), 1)`,
            [qId, 'CLIENT', 'SYSTEM', messageText, emailMessageId]
          );
        }

      } catch (emailError) {
        console.error('[Quotation Controller] Email sending failed:', emailError.message);
      }
    }

    res.json({
      message: 'Quotation created successfully',
      quotationIds: quotationIds,
      emailSent: emailSent
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

const deleteQuotationRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute(
      'DELETE FROM quotation_requests WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Quotation request not found' });
    }

    res.json({ message: 'Quotation request deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const batchUploadReplyPDF = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    let ids = req.body?.ids;

    // Handle FormData stringified array
    if (typeof ids === 'string') {
      try {
        ids = JSON.parse(ids);
      } catch (e) {
        ids = ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      }
    }

    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'IDs array is required' });
    }

    const replyPdfPath = req.file ? `uploads/${req.file.filename}` : null;
    if (!replyPdfPath) {
      return res.status(400).json({ error: 'Reply PDF is required' });
    }

    await connection.beginTransaction();
    for (const id of ids) {
      await connection.execute(
        'UPDATE quotation_requests SET reply_pdf = ?, updated_at = NOW() WHERE id = ?',
        [replyPdfPath, id]
      );
    }
    await connection.commit();
    res.json({ message: 'Reply PDF uploaded successfully' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

const batchDeleteQuotationRequests = async (req, res, next) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs array is required' });
    }

    const [result] = await pool.query(
      `DELETE FROM quotation_requests WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids
    );

    res.json({
      message: 'Quotation requests deleted successfully',
      affectedRows: result.affectedRows
    });
  } catch (error) {
    next(error);
  }
};

const updateQuotationRates = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const items = req.body?.items; // Array of { id, rate }

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    await connection.beginTransaction();

    for (const item of items) {
      await connection.execute(
        'UPDATE quotation_requests SET total_amount = ?, received_amount = ?, item_qty = ?, updated_at = NOW() WHERE id = ?',
        [item.rate * item.qty, item.received_amount || 0, item.qty, item.id]
      );
    }

    await connection.commit();
    res.json({ message: 'Quotation rates updated successfully' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

const downloadQuotationPDF = async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1. Fetch the representative quotation to get client info and timestamp
    const [quotes] = await pool.query(
      `SELECT qr.*, c.company_name, c.id as client_id,
              COALESCE(qr.client_email, (SELECT email FROM contacts WHERE company_id = c.id AND (contact_type = 'PRIMARY' OR contact_type = 'PURCHASE') LIMIT 1)) as client_email,
              COALESCE(qr.client_phone, (SELECT phone FROM contacts WHERE company_id = c.id AND (contact_type = 'PRIMARY' OR contact_type = 'PURCHASE') LIMIT 1)) as client_phone,
              COALESCE(qr.contact_person, (SELECT name FROM contacts WHERE company_id = c.id AND (contact_type = 'PRIMARY' OR contact_type = 'PURCHASE') LIMIT 1)) as contact_person,
              COALESCE(qr.client_address, (SELECT CONCAT(line1, ', ', IFNULL(line2, ''), city, ', ', state, ' ', pincode) FROM company_addresses WHERE company_id = c.id LIMIT 1)) as client_address
       FROM quotation_requests qr 
       JOIN companies c ON qr.company_id = c.id 
       WHERE qr.id = ?`,
      [id]
    );

    if (quotes.length === 0) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    const representative = quotes[0];

    // 2. Fetch all quotations in this batch (same client, same approx timestamp)
    // We exclude COMPONENT rows as they are snapshots for sub-assemblies
    const [batchQuotes] = await pool.query(
      `SELECT qr.*, 
              COALESCE(soi.drawing_no, qr.drawing_no) as effective_drawing_no, 
              COALESCE(soi.description, qr.description) as effective_description
       FROM quotation_requests qr
       LEFT JOIN sales_order_items soi ON qr.sales_order_item_id = soi.id
       WHERE qr.company_id = ? 
       AND ABS(TIMESTAMPDIFF(SECOND, qr.created_at, ?)) <= 10
       AND qr.status != 'COMPONENT'`,
      [representative.company_id, representative.created_at]
    );

    const items = await Promise.all(batchQuotes.map(async q => {
      // Fetch component snapshots for this item
      const [components] = await pool.query(
        'SELECT * FROM quotation_requests WHERE status = ? AND rejection_reason = ?',
        ['COMPONENT', String(q.id)]
      );

      return {
        id: q.id,
        item_code: q.item_code || null,
        drawing_no: q.effective_drawing_no || '—',
        description: q.effective_description || '',
        quantity: q.item_qty || 1,
        quotedPrice: (parseFloat(q.total_amount) / (q.item_qty || 1)) || 0,
        profit_percentage: q.profit_percentage || 0,
        override_percentage: q.override_percentage || 0,
        bom_cost: parseFloat(q.bom_cost) || 0,
        gst_percentage: q.gst_percentage || 18,
        status: q.status,
        item_notes: q.item_notes || null,
        sub_assemblies: components.map(sa => ({
          drawing_no: sa.drawing_no,
          description: sa.description,
          quantity: sa.item_qty,
          unit: sa.item_unit,
          rate: parseFloat(sa.received_amount) || parseFloat(sa.bom_cost) || 0
        }))
      };
    }));

    const totalAmount = batchQuotes.reduce((sum, q) => {
      if (q.status === 'REJECTED') return sum;
      return sum + (parseFloat(q.total_amount) || 0);
    }, 0);

    const quoteNumber = `QRT-${String(representative.id).padStart(4, '0')}`;

    const pdfBuffer = await emailService.generateQuotationPDF(
      representative.company_name,
      items,
      totalAmount,
      representative.notes,
      representative.client_id,
      quoteNumber,
      representative.host_company_id,
      {
        email: representative.client_email,
        phone: representative.client_phone,
        contact_person: representative.contact_person,
        address: representative.client_address
      }
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Quotation_${quoteNumber}.pdf`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('[Quotation Controller] PDF download failed:', error);
    next(error);
  }
};

const exportQuotationCostBreakdown = async (req, res, next) => {
  try {
    const { id } = req.params;
    const XLSX = require('xlsx');

    // 1. Fetch representative quotation
    const [quotes] = await pool.query(
      `SELECT qr.*, c.company_name, c.id as client_id
       FROM quotation_requests qr 
       JOIN companies c ON qr.company_id = c.id 
       WHERE qr.id = ?`,
      [id]
    );

    if (quotes.length === 0) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    const representative = quotes[0];

    // 2. Fetch all items in this batch
    const [batchQuotes] = await pool.query(
      `SELECT qr.*, 
              COALESCE(soi.drawing_no, qr.drawing_no) as effective_drawing_no, 
              COALESCE(soi.description, qr.description) as effective_description,
              soi.drawing_id as effective_drawing_id
       FROM quotation_requests qr
       LEFT JOIN sales_order_items soi ON qr.sales_order_item_id = soi.id
       WHERE qr.company_id = ? 
       AND ABS(TIMESTAMPDIFF(SECOND, qr.created_at, ?)) <= 10
       AND qr.status != 'COMPONENT'
       ORDER BY qr.id ASC`,
      [representative.company_id, representative.created_at]
    );

    // Helpers
    const calculateMaterialCost = (m) => {
      const qty = parseFloat(m.qty_per_pc || m.quantity || 0);
      const rate = parseFloat(m.rate || 0);
      const weightPerUnit = parseFloat(m.weight_per_unit || 0);
      const scrapPercent = parseFloat(m.scrap_percent || 0);
      
      if (weightPerUnit > 0) {
        const sP = scrapPercent > 1 ? scrapPercent / 100 : scrapPercent;
        return qty * weightPerUnit * (1 + sP) * rate;
      }
      return qty * rate;
    };

    const parseOperations = (operationsList) => {
      const ops = { cnc: 0, milling: 0, vmc: 0, drilling: 0, tapping: 0, grinding: 0, laser: 0, sparking: 0, finish: 0, qc: 0, packing: 0 };
      (operationsList || []).forEach(op => {
        const name = (op.operation_name || '').toLowerCase();
        const hourlyRate = parseFloat(op.hourly_rate || 0);
        const setupTime = parseFloat(op.setup_time_min || 0);
        const cycleTime = parseFloat(op.cycle_time_min || 0);
        const totalOpCost = ((cycleTime + setupTime) / 60) * hourlyRate;
        
        if (name.includes('laser')) ops.laser += totalOpCost;
        else if (name.includes('cnc') || name.includes('turn')) ops.cnc += totalOpCost;
        else if (name.includes('vmc')) ops.vmc += totalOpCost;
        else if (name.includes('drill')) ops.drilling += totalOpCost;
        else if (name.includes('tap')) ops.tapping += totalOpCost;
        else if (name.includes('grind')) ops.grinding += totalOpCost;
        else if (name.includes('spark')) ops.sparking += totalOpCost;
        else if (name.includes('qc') || name.includes('inspect')) ops.qc += totalOpCost;
        else if (name.includes('pack')) ops.packing += totalOpCost;
        else if (name.includes('mill') || name.includes('cut')) ops.milling += totalOpCost;
        else if (name.includes('finish') || name.includes('powder') || name.includes('anodiz') || name.includes('paint') || name.includes('weld')) ops.finish += totalOpCost;
        else {
          ops.finish += totalOpCost;
        }
      });
      return ops;
    };

    // Columns structure (Material, Material Size, and Weight columns removed)
    const headers = [
      "Sr No", "Component Number", "Description", "Type", "Material Cost", 
      "CNC/Turning", "Milling/Cutting", "VMC", "Drilling", "Tapping", "Grinding", "Laser Cutting & Bending", 
      "Sparking", "Finish", "Profit & Overheads", "Qty", "Unit Price", "Total Price"
    ];

    const dataRows = [headers];
    let grandTotalSum = 0;
    let mainSr = 1;

    for (const q of batchQuotes) {
      const effectiveItemId = q.sales_order_item_id || null;
      const resolvedDrawingId = q.effective_drawing_id || q.drawing_id || null;
      
      const parentBOM = {
        materials: await bomService.getItemMaterials(effectiveItemId, q.item_code, q.effective_drawing_no, resolvedDrawingId),
        components: await bomService.getItemComponents(effectiveItemId, q.item_code, q.effective_drawing_no, null, null, null, resolvedDrawingId),
        operations: await bomService.getItemOperations(effectiveItemId, q.item_code, q.effective_drawing_no, resolvedDrawingId)
      };

      const isAssembly = parentBOM.components && parentBOM.components.length > 0;
      const qQty = parseFloat(q.item_qty) || 0;
      const qRate = parseFloat(q.total_amount / (q.item_qty || 1)) || 0;
      const qTotal = parseFloat(q.total_amount) || 0;
      
      grandTotalSum += qTotal;

      if (!isAssembly) {
        // Part/Commercial Row
        const matCost = parentBOM.materials.reduce((sum, m) => sum + calculateMaterialCost(m), 0);
        const ops = parseOperations(parentBOM.operations);
        const opsSum = Object.values(ops).reduce((a, b) => a + b, 0);
        const profit = qRate - matCost - opsSum;

        dataRows.push([
          mainSr++,
          q.effective_drawing_no || q.drawing_no || q.item_code || '—',
          q.effective_description || '',
          q.item_group || 'PART',
          matCost,
          ops.cnc,
          ops.milling,
          ops.vmc,
          ops.drilling,
          ops.tapping,
          ops.grinding,
          ops.laser,
          ops.sparking,
          ops.finish,
          profit,
          qQty,
          qRate,
          qTotal
        ]);
      } else {
        // Assembly & Components
        // 1. Calculate parent assembly values as sum of components
        const childBOMs = await Promise.all(
          parentBOM.components.map(async (c) => {
            try {
              const childRes = await pool.query(
                `SELECT * FROM bom WHERE item_code = ? OR drawing_no = ? LIMIT 1`,
                [c.component_code, c.component_code]
              );
              if (childRes[0].length > 0) {
                return {
                  materials: await bomService.getItemMaterials(null, c.component_code, null, null),
                  operations: await bomService.getItemOperations(null, c.component_code, null, null)
                };
              }
            } catch (e) {
              console.error(e);
            }
            return null;
          })
        );

        let parentMatCost = 0;
        let parentOps = { cnc: 0, milling: 0, vmc: 0, drilling: 0, tapping: 0, grinding: 0, laser: 0, sparking: 0, finish: 0, qc: 0, packing: 0 };

        parentBOM.components.forEach((c, idx) => {
          const childBOM = childBOMs[idx];
          const cQty = parseFloat(c.quantity || 0);
          if (childBOM) {
            const childMat = childBOM.materials.reduce((sum, m) => sum + calculateMaterialCost(m), 0);
            const childOps = parseOperations(childBOM.operations);
            parentMatCost += childMat * cQty;
            Object.keys(parentOps).forEach(k => {
              parentOps[k] += (childOps[k] || 0) * cQty;
            });
          } else {
            parentMatCost += (parseFloat(c.rate || 0) * cQty);
          }
        });

        const parentOpsSum = Object.values(parentOps).reduce((a, b) => a + b, 0);
        const parentProfit = qRate - parentMatCost - parentOpsSum;

        // Push Parent Assembly Row
        const currentAssemblySr = mainSr++;
        dataRows.push([
          currentAssemblySr,
          q.effective_drawing_no || q.drawing_no || q.item_code || '—',
          q.effective_description || '',
          'ASM',
          parentMatCost,
          parentOps.cnc,
          parentOps.milling,
          parentOps.vmc,
          parentOps.drilling,
          parentOps.tapping,
          parentOps.grinding,
          parentOps.laser,
          parentOps.sparking,
          parentOps.finish,
          parentProfit,
          qQty,
          qRate,
          qTotal
        ]);

        // Push Child Components
        parentBOM.components.forEach((c, idx) => {
          const childBOM = childBOMs[idx];
          const cQty = parseFloat(c.quantity || 0);
          let childMatCost = 0;
          let childOps = { cnc: 0, milling: 0, vmc: 0, drilling: 0, tapping: 0, grinding: 0, laser: 0, sparking: 0, finish: 0, qc: 0, packing: 0 };

          if (childBOM) {
            childMatCost = childBOM.materials.reduce((sum, m) => sum + calculateMaterialCost(m), 0);
            childOps = parseOperations(childBOM.operations);
          } else {
            childMatCost = parseFloat(c.rate || 0);
          }

          const childOpsSum = Object.values(childOps).reduce((a, b) => a + b, 0);
          const childProfit = 0;
          const childRate = childMatCost + childOpsSum;

          dataRows.push([
            `↳ ${currentAssemblySr}.${idx + 1}`,
            c.drawing_no || c.component_code || c.item_code || '—',
            c.description || '',
            c.item_group || 'PART',
            childMatCost,
            childOps.cnc,
            childOps.milling,
            childOps.vmc,
            childOps.drilling,
            childOps.tapping,
            childOps.grinding,
            childOps.laser,
            childOps.sparking,
            childOps.finish,
            childProfit,
            cQty * qQty,
            childRate,
            ""
          ]);
        });
      }
    }

    // Add Grand Total Row
    const grandTotalRow = Array(17).fill("");
    grandTotalRow[0] = "Grand Total";
    grandTotalRow[17] = grandTotalSum;
    dataRows.push(grandTotalRow);

    // Create workbook & worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(dataRows);

    // Adjust column widths automatically
    ws['!cols'] = headers.map((h, i) => {
      let maxLen = h.length;
      dataRows.forEach(r => {
        const val = String(r[i] || '');
        if (val.length > maxLen) maxLen = val.length;
      });
      return { wch: maxLen + 3 };
    });

    XLSX.utils.book_append_sheet(wb, ws, "Cost Breakdown");
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Cost_Breakdown_QRT_${id}.xlsx`);
    res.send(buf);

  } catch (error) {
    console.error('[Quotation Controller] Cost breakdown export failed:', error);
    next(error);
  }
};

const exportQuotationCostBreakdownPDF = async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1. Fetch representative quotation
    const [quotes] = await pool.query(
      `SELECT qr.*, c.company_name, c.id as client_id
       FROM quotation_requests qr 
       JOIN companies c ON qr.company_id = c.id 
       WHERE qr.id = ?`,
      [id]
    );

    if (quotes.length === 0) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    const representative = quotes[0];

    // 2. Fetch all items in this batch
    const [batchQuotes] = await pool.query(
      `SELECT qr.*, 
              COALESCE(soi.drawing_no, qr.drawing_no) as effective_drawing_no, 
              COALESCE(soi.description, qr.description) as effective_description,
              soi.drawing_id as effective_drawing_id
       FROM quotation_requests qr
       LEFT JOIN sales_order_items soi ON qr.sales_order_item_id = soi.id
       WHERE qr.company_id = ? 
       AND ABS(TIMESTAMPDIFF(SECOND, qr.created_at, ?)) <= 10
       AND qr.status != 'COMPONENT'
       ORDER BY qr.id ASC`,
      [representative.company_id, representative.created_at]
    );

    // Helpers
    const calculateMaterialCost = (m) => {
      const qty = parseFloat(m.qty_per_pc || m.quantity || 0);
      const rate = parseFloat(m.rate || 0);
      const weightPerUnit = parseFloat(m.weight_per_unit || 0);
      const scrapPercent = parseFloat(m.scrap_percent || 0);
      
      if (weightPerUnit > 0) {
        const sP = scrapPercent > 1 ? scrapPercent / 100 : scrapPercent;
        return qty * weightPerUnit * (1 + sP) * rate;
      }
      return qty * rate;
    };

    const parseOperations = (operationsList) => {
      const ops = { cnc: 0, milling: 0, vmc: 0, drilling: 0, tapping: 0, grinding: 0, laser: 0, sparking: 0, finish: 0, qc: 0, packing: 0 };
      (operationsList || []).forEach(op => {
        const name = (op.operation_name || '').toLowerCase();
        const hourlyRate = parseFloat(op.hourly_rate || 0);
        const setupTime = parseFloat(op.setup_time_min || 0);
        const cycleTime = parseFloat(op.cycle_time_min || 0);
        const totalOpCost = ((cycleTime + setupTime) / 60) * hourlyRate;
        
        if (name.includes('laser')) ops.laser += totalOpCost;
        else if (name.includes('cnc') || name.includes('turn')) ops.cnc += totalOpCost;
        else if (name.includes('vmc')) ops.vmc += totalOpCost;
        else if (name.includes('drill')) ops.drilling += totalOpCost;
        else if (name.includes('tap')) ops.tapping += totalOpCost;
        else if (name.includes('grind')) ops.grinding += totalOpCost;
        else if (name.includes('spark')) ops.sparking += totalOpCost;
        else if (name.includes('qc') || name.includes('inspect')) ops.qc += totalOpCost;
        else if (name.includes('pack')) ops.packing += totalOpCost;
        else if (name.includes('mill') || name.includes('cut')) ops.milling += totalOpCost;
        else if (name.includes('finish') || name.includes('powder') || name.includes('anodiz') || name.includes('paint') || name.includes('weld')) ops.finish += totalOpCost;
        else {
          ops.finish += totalOpCost;
        }
      });
      return ops;
    };

    // Columns structure (Material, Material Size, and Weight columns removed)
    const headers = [
      "Sr No", "Component Number", "Description", "Type", "Material Cost", 
      "CNC/Turning", "Milling/Cutting", "VMC", "Drilling", "Tapping", "Grinding", "Laser Cutting & Bending", 
      "Sparking", "Finish", "Profit & Overheads", "Qty", "Unit Price", "Total Price"
    ];

    const dataRows = [headers];
    let grandTotalSum = 0;
    let mainSr = 1;

    for (const q of batchQuotes) {
      const effectiveItemId = q.sales_order_item_id || null;
      const resolvedDrawingId = q.effective_drawing_id || q.drawing_id || null;
      
      const parentBOM = {
        materials: await bomService.getItemMaterials(effectiveItemId, q.item_code, q.effective_drawing_no, resolvedDrawingId),
        components: await bomService.getItemComponents(effectiveItemId, q.item_code, q.effective_drawing_no, null, null, null, resolvedDrawingId),
        operations: await bomService.getItemOperations(effectiveItemId, q.item_code, q.effective_drawing_no, resolvedDrawingId)
      };

      const isAssembly = parentBOM.components && parentBOM.components.length > 0;
      const qQty = parseFloat(q.item_qty) || 0;
      const qRate = parseFloat(q.total_amount / (q.item_qty || 1)) || 0;
      const qTotal = parseFloat(q.total_amount) || 0;
      
      grandTotalSum += qTotal;

      if (!isAssembly) {
        // Part/Commercial Row
        const matCost = parentBOM.materials.reduce((sum, m) => sum + calculateMaterialCost(m), 0);
        const ops = parseOperations(parentBOM.operations);
        const opsSum = Object.values(ops).reduce((a, b) => a + b, 0);
        const profit = qRate - matCost - opsSum;

        dataRows.push([
          mainSr++,
          q.effective_drawing_no || q.drawing_no || q.item_code || '—',
          q.effective_description || '',
          q.item_group || 'PART',
          matCost,
          ops.cnc,
          ops.milling,
          ops.vmc,
          ops.drilling,
          ops.tapping,
          ops.grinding,
          ops.laser,
          ops.sparking,
          ops.finish,
          profit,
          qQty,
          qRate,
          qTotal
        ]);
      } else {
        // Assembly & Components
        // 1. Calculate parent assembly values as sum of components
        const childBOMs = await Promise.all(
          parentBOM.components.map(async (c) => {
            try {
              const childRes = await pool.query(
                `SELECT * FROM bom WHERE item_code = ? OR drawing_no = ? LIMIT 1`,
                [c.component_code, c.component_code]
              );
              if (childRes[0].length > 0) {
                return {
                  materials: await bomService.getItemMaterials(null, c.component_code, null, null),
                  operations: await bomService.getItemOperations(null, c.component_code, null, null)
                };
              }
            } catch (e) {
              console.error(e);
            }
            return null;
          })
        );

        let parentMatCost = 0;
        let parentOps = { cnc: 0, milling: 0, vmc: 0, drilling: 0, tapping: 0, grinding: 0, laser: 0, sparking: 0, finish: 0, qc: 0, packing: 0 };

        parentBOM.components.forEach((c, idx) => {
          const childBOM = childBOMs[idx];
          const cQty = parseFloat(c.quantity || 0);
          if (childBOM) {
            const childMat = childBOM.materials.reduce((sum, m) => sum + calculateMaterialCost(m), 0);
            const childOps = parseOperations(childBOM.operations);
            parentMatCost += childMat * cQty;
            Object.keys(parentOps).forEach(k => {
              parentOps[k] += (childOps[k] || 0) * cQty;
            });
          } else {
            parentMatCost += (parseFloat(c.rate || 0) * cQty);
          }
        });

        const parentOpsSum = Object.values(parentOps).reduce((a, b) => a + b, 0);
        const parentProfit = qRate - parentMatCost - parentOpsSum;

        // Push Parent Assembly Row
        const currentAssemblySr = mainSr++;
        dataRows.push([
          currentAssemblySr,
          q.effective_drawing_no || q.drawing_no || q.item_code || '—',
          q.effective_description || '',
          'ASM',
          parentMatCost,
          parentOps.cnc,
          parentOps.milling,
          parentOps.vmc,
          parentOps.drilling,
          parentOps.tapping,
          parentOps.grinding,
          parentOps.laser,
          parentOps.sparking,
          parentOps.finish,
          parentProfit,
          qQty,
          qRate,
          qTotal
        ]);

        // Push Child Components
        parentBOM.components.forEach((c, idx) => {
          const childBOM = childBOMs[idx];
          const cQty = parseFloat(c.quantity || 0);
          let childMatCost = 0;
          let childOps = { cnc: 0, milling: 0, vmc: 0, drilling: 0, tapping: 0, grinding: 0, laser: 0, sparking: 0, finish: 0, qc: 0, packing: 0 };

          if (childBOM) {
            childMatCost = childBOM.materials.reduce((sum, m) => sum + calculateMaterialCost(m), 0);
            childOps = parseOperations(childBOM.operations);
          } else {
            childMatCost = parseFloat(c.rate || 0);
          }

          const childOpsSum = Object.values(childOps).reduce((a, b) => a + b, 0);
          const childProfit = 0;
          const childRate = childMatCost + childOpsSum;

          dataRows.push([
            `↳ ${currentAssemblySr}.${idx + 1}`,
            c.drawing_no || c.component_code || c.item_code || '—',
            c.description || '',
            c.item_group || 'PART',
            childMatCost,
            childOps.cnc,
            childOps.milling,
            childOps.vmc,
            childOps.drilling,
            childOps.tapping,
            childOps.grinding,
            childOps.laser,
            childOps.sparking,
            childOps.finish,
            childProfit,
            cQty * qQty,
            childRate,
            ""
          ]);
        });
      }
    }

    // Add Grand Total Row
    const grandTotalRow = Array(17).fill("");
    grandTotalRow[0] = "Grand Total";
    grandTotalRow[17] = grandTotalSum;
    dataRows.push(grandTotalRow);

    const pdfBuffer = await emailService.generateCostBreakdownPDF(
      representative.company_name,
      `QRT-${String(representative.id).padStart(4, '0')}`,
      representative.project_name,
      dataRows
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Cost_Breakdown_QRT_${id}.pdf`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('[Quotation Controller] Cost breakdown PDF download failed:', error);
    next(error);
  }
};

const getQuotationCostBreakdownDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1. Fetch representative quotation
    const [quotes] = await pool.query(
      `SELECT qr.*, c.company_name, c.id as client_id
       FROM quotation_requests qr 
       JOIN companies c ON qr.company_id = c.id 
       WHERE qr.id = ?`,
      [id]
    );

    if (quotes.length === 0) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    const representative = quotes[0];

    // 2. Fetch all items in this batch
    const [batchQuotes] = await pool.query(
      `SELECT qr.*, 
              COALESCE(soi.drawing_no, qr.drawing_no) as effective_drawing_no, 
              COALESCE(soi.description, qr.description) as effective_description,
              soi.drawing_id as effective_drawing_id
       FROM quotation_requests qr
       LEFT JOIN sales_order_items soi ON qr.sales_order_item_id = soi.id
       WHERE qr.company_id = ? 
       AND ABS(TIMESTAMPDIFF(SECOND, qr.created_at, ?)) <= 10
       AND qr.status != 'COMPONENT'
       ORDER BY qr.id ASC`,
      [representative.company_id, representative.created_at]
    );

    // Helpers
    const calculateMaterialCost = (m) => {
      const qty = parseFloat(m.qty_per_pc || m.quantity || 0);
      const rate = parseFloat(m.rate || 0);
      const weightPerUnit = parseFloat(m.weight_per_unit || 0);
      const scrapPercent = parseFloat(m.scrap_percent || 0);
      
      if (weightPerUnit > 0) {
        const sP = scrapPercent > 1 ? scrapPercent / 100 : scrapPercent;
        return qty * weightPerUnit * (1 + sP) * rate;
      }
      return qty * rate;
    };

    const parseOperations = (operationsList) => {
      const ops = { cnc: 0, milling: 0, vmc: 0, drilling: 0, tapping: 0, grinding: 0, laser: 0, sparking: 0, finish: 0, qc: 0, packing: 0 };
      (operationsList || []).forEach(op => {
        const name = (op.operation_name || '').toLowerCase();
        const hourlyRate = parseFloat(op.hourly_rate || 0);
        const setupTime = parseFloat(op.setup_time_min || 0);
        const cycleTime = parseFloat(op.cycle_time_min || 0);
        const totalOpCost = ((cycleTime + setupTime) / 60) * hourlyRate;
        
        if (name.includes('laser')) ops.laser += totalOpCost;
        else if (name.includes('cnc') || name.includes('turn')) ops.cnc += totalOpCost;
        else if (name.includes('vmc')) ops.vmc += totalOpCost;
        else if (name.includes('drill')) ops.drilling += totalOpCost;
        else if (name.includes('tap')) ops.tapping += totalOpCost;
        else if (name.includes('grind')) ops.grinding += totalOpCost;
        else if (name.includes('spark')) ops.sparking += totalOpCost;
        else if (name.includes('qc') || name.includes('inspect')) ops.qc += totalOpCost;
        else if (name.includes('pack')) ops.packing += totalOpCost;
        else if (name.includes('mill') || name.includes('cut')) ops.milling += totalOpCost;
        else if (name.includes('finish') || name.includes('powder') || name.includes('anodiz') || name.includes('paint') || name.includes('weld')) ops.finish += totalOpCost;
        else {
          ops.finish += totalOpCost;
        }
      });
      return ops;
    };

    const dataRows = [];
    let mainSr = 1;

    for (const q of batchQuotes) {
      const effectiveItemId = q.sales_order_item_id || null;
      const resolvedDrawingId = q.effective_drawing_id || q.drawing_id || null;
      
      const parentBOM = {
        materials: await bomService.getItemMaterials(effectiveItemId, q.item_code, q.effective_drawing_no, resolvedDrawingId),
        components: await bomService.getItemComponents(effectiveItemId, q.item_code, q.effective_drawing_no, null, null, null, resolvedDrawingId),
        operations: await bomService.getItemOperations(effectiveItemId, q.item_code, q.effective_drawing_no, resolvedDrawingId)
      };

      const isAssembly = parentBOM.components && parentBOM.components.length > 0;
      const qQty = parseFloat(q.item_qty) || 0;
      const qRate = parseFloat(q.total_amount / (q.item_qty || 1)) || 0;
      const qTotal = parseFloat(q.total_amount) || 0;

      if (!isAssembly) {
        // Part/Commercial Row
        const matCost = parentBOM.materials.reduce((sum, m) => sum + calculateMaterialCost(m), 0);
        const ops = parseOperations(parentBOM.operations);
        const opsSum = Object.values(ops).reduce((a, b) => a + b, 0);
        const profit = qRate - matCost - opsSum;

        dataRows.push({
          sr: String(mainSr++),
          drawing_no: q.effective_drawing_no || q.drawing_no || q.item_code || '—',
          description: q.effective_description || '',
          type: q.item_group || 'PART',
          materialCost: matCost,
          cnc: ops.cnc,
          milling: ops.milling,
          vmc: ops.vmc,
          drilling: ops.drilling,
          tapping: ops.tapping,
          grinding: ops.grinding,
          laser: ops.laser,
          sparking: ops.sparking,
          finish: ops.finish,
          profit: profit,
          qty: qQty,
          unitRate: qRate,
          total: qTotal
        });
      } else {
        // Assembly & Components
        const childBOMs = await Promise.all(
          parentBOM.components.map(async (c) => {
            try {
              const childRes = await pool.query(
                `SELECT * FROM bom WHERE item_code = ? OR drawing_no = ? LIMIT 1`,
                [c.component_code, c.component_code]
              );
              if (childRes[0].length > 0) {
                return {
                  materials: await bomService.getItemMaterials(null, c.component_code, null, null),
                  operations: await bomService.getItemOperations(null, c.component_code, null, null)
                };
              }
            } catch (e) {
              console.error(e);
            }
            return null;
          })
        );

        let parentMatCost = 0;
        let parentOps = { cnc: 0, milling: 0, vmc: 0, drilling: 0, tapping: 0, grinding: 0, laser: 0, sparking: 0, finish: 0, qc: 0, packing: 0 };

        parentBOM.components.forEach((c, idx) => {
          const childBOM = childBOMs[idx];
          const cQty = parseFloat(c.quantity || 0);
          if (childBOM) {
            const childMat = childBOM.materials.reduce((sum, m) => sum + calculateMaterialCost(m), 0);
            const childOps = parseOperations(childBOM.operations);
            parentMatCost += childMat * cQty;
            Object.keys(parentOps).forEach(k => {
              parentOps[k] += (childOps[k] || 0) * cQty;
            });
          } else {
            parentMatCost += (parseFloat(c.rate || 0) * cQty);
          }
        });

        const parentOpsSum = Object.values(parentOps).reduce((a, b) => a + b, 0);
        const parentProfit = qRate - parentMatCost - parentOpsSum;

        const currentAssemblySr = mainSr++;
        dataRows.push({
          sr: String(currentAssemblySr),
          drawing_no: q.effective_drawing_no || q.drawing_no || q.item_code || '—',
          description: q.effective_description || '',
          type: 'ASM',
          materialCost: parentMatCost,
          cnc: parentOps.cnc,
          milling: parentOps.milling,
          vmc: parentOps.vmc,
          drilling: parentOps.drilling,
          tapping: parentOps.tapping,
          grinding: parentOps.grinding,
          laser: parentOps.laser,
          sparking: parentOps.sparking,
          finish: parentOps.finish,
          profit: parentProfit,
          qty: qQty,
          unitRate: qRate,
          total: qTotal
        });

        // Child Components
        parentBOM.components.forEach((c, idx) => {
          const childBOM = childBOMs[idx];
          const cQty = parseFloat(c.quantity || 0);
          let childMatCost = 0;
          let childOps = { cnc: 0, milling: 0, vmc: 0, drilling: 0, tapping: 0, grinding: 0, laser: 0, sparking: 0, finish: 0, qc: 0, packing: 0 };

          if (childBOM) {
            childMatCost = childBOM.materials.reduce((sum, m) => sum + calculateMaterialCost(m), 0);
            childOps = parseOperations(childBOM.operations);
          } else {
            childMatCost = parseFloat(c.rate || 0);
          }

          const childOpsSum = Object.values(childOps).reduce((a, b) => a + b, 0);
          const childProfit = 0;
          const childRate = childMatCost + childOpsSum;

          dataRows.push({
            sr: `↳ ${currentAssemblySr}.${idx + 1}`,
            drawing_no: c.drawing_no || c.component_code || c.item_code || '—',
            description: c.description || '',
            type: c.item_group || 'PART',
            materialCost: childMatCost,
            cnc: childOps.cnc,
            milling: childOps.milling,
            vmc: childOps.vmc,
            drilling: childOps.drilling,
            tapping: childOps.tapping,
            grinding: childOps.grinding,
            laser: childOps.laser,
            sparking: childOps.sparking,
            finish: childOps.finish,
            profit: childProfit,
            qty: cQty * qQty,
            unitRate: childRate,
            total: 0
          });
        });
      }
    }

    res.json(dataRows);

  } catch (error) {
    console.error('[Quotation Controller] Failed to fetch cost breakdown details:', error);
    next(error);
  }
};

const updateQuotationFromBOM = async (req, res, next) => {
  try {
    const { salesOrderItemId, bomCost } = req.body;

    if (!salesOrderItemId || bomCost === undefined) {
      return res.status(400).json({ error: 'salesOrderItemId and bomCost are required' });
    }

    // 1. Fetch the identity of the BOM item (drawing_no and item_code)
    const [bomItems] = await pool.query(
      'SELECT item_code, drawing_no, bom_id FROM sales_order_items WHERE id = ?',
      [salesOrderItemId]
    );

    if (bomItems.length === 0) {
      throw new Error('BOM version not found');
    }

    const { item_code, drawing_no } = bomItems[0];

    // 2. Trigger the sync and propagation logic
    // This will update component rates, latest sales_order_item costs, parent BOMs, and quotations
    await bomService.updateItemCostAndPropagate(item_code, drawing_no, bomCost);

    res.json({
      message: `BOM value ₹${bomCost} has been applied to this item and propagated to all parent assemblies and linked quotations.`
    });
  } catch (error) {
    next(error);
  }
};

const getQuotationVersionDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1. Fetch the main record to get batch_id and version
    const [quotes] = await pool.query(
      `SELECT qr.*, c.company_name,
              COALESCE(qr.client_email, cd_proj.email, cd_contact.email, ct.email, '') as client_email,
              COALESCE(qr.client_phone, cd_proj.phone, cd_contact.phone, ct.phone, '') as client_phone,
              COALESCE(qr.contact_person, cd_proj.contact_person, cd_contact.contact_person, ct.name, '') as contact_person,
              COALESCE(qr.client_address, cd_proj.billing_address, (SELECT CONCAT(line1, ', ', IFNULL(line2, ''), city, ', ', state, ' ', pincode) FROM company_addresses WHERE company_id = c.id LIMIT 1)) as client_address
       FROM quotation_requests qr 
       JOIN companies c ON qr.company_id = c.id 
       LEFT JOIN (
         SELECT company_id, email, phone, name, 
                ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY contact_type = 'PRIMARY' DESC, id ASC) as rn
         FROM contacts
       ) ct ON ct.company_id = c.id AND ct.rn = 1
       LEFT JOIN (
         SELECT soi.sales_order_id, cd.contact_person, cd.phone, cd.email,
                ROW_NUMBER() OVER (PARTITION BY soi.sales_order_id ORDER BY cd.id ASC) as rn
         FROM sales_order_items soi
         JOIN customer_drawings cd ON soi.drawing_id = cd.id
         WHERE cd.contact_person IS NOT NULL OR cd.phone IS NOT NULL OR cd.email IS NOT NULL
       ) cd_contact ON cd_contact.sales_order_id = qr.sales_order_id AND cd_contact.rn = 1
       LEFT JOIN (
         SELECT client_name, project_name, email, phone, contact_person, billing_address,
                ROW_NUMBER() OVER (PARTITION BY client_name, project_name ORDER BY id DESC) as rn
         FROM customer_drawings
         WHERE contact_person IS NOT NULL OR phone IS NOT NULL OR email IS NOT NULL
       ) cd_proj ON cd_proj.client_name = c.company_name 
                AND TRIM(LOWER(cd_proj.project_name)) = TRIM(LOWER(qr.project_name))
                AND cd_proj.rn = 1
       WHERE qr.id = ?`,
      [id]
    );

    if (quotes.length === 0) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    const mainQuote = quotes[0];
    const { batch_id, version } = mainQuote;

    // 2. Fetch all related rows for this specific snapshot
    // We strictly filter by version to avoid pulling items from other versions
    const [rows] = await pool.query(
      `SELECT qr.*, 
              qr.drawing_no as qr_drawing_no,
              qr.description as qr_description,
              qr.item_code as qr_item_code,
              COALESCE(soi.drawing_no, qr.drawing_no) as drawing_no,
              COALESCE(soi.description, qr.description) as description,
              COALESCE(soi.unit, qr.item_unit) as unit,
              COALESCE(soi.item_code, qr.item_code) as item_code,
              COALESCE(sb.current_balance, 0) as available_stock
       FROM quotation_requests qr
       LEFT JOIN sales_order_items soi ON (soi.id = qr.sales_order_item_id AND qr.status != 'COMPONENT')
       LEFT JOIN (
         SELECT item_code, SUM(current_balance) as current_balance
         FROM stock_balance
         GROUP BY item_code
       ) sb ON LOWER(TRIM(COALESCE(soi.item_code, qr.item_code))) = LOWER(TRIM(sb.item_code))
       WHERE qr.version = ?
         AND (
           (qr.batch_id IS NOT NULL AND qr.batch_id = ?)
           OR (qr.parent_id = ?)
           OR (qr.id = ?)
         )
       ORDER BY qr.sales_order_item_id ASC, qr.id ASC`,
      [version, batch_id, mainQuote.parent_id || mainQuote.id, id]
    );

    // 3. Structure the data exactly like the frontend expects for a form
    const items = rows.filter(r => (r.status || '').toUpperCase() !== 'COMPONENT').map(row => {
      const itemData = {
        id: row.id,
        sales_order_item_id: row.sales_order_item_id,
        salesOrderItemId: row.sales_order_item_id,
        item_code: row.item_code,
        drawing_no: row.drawing_no,
        description: row.description,
        quantity: row.item_qty,
        unit: row.unit,
        rate: parseFloat(row.total_amount / (row.item_qty || 1)) || 0,
        bom_cost: parseFloat(row.bom_cost) || 0,
        total: parseFloat(row.total_amount) || 0,
        profit_percentage: parseFloat(row.profit_percentage) || 0,
        override_percentage: parseFloat(row.override_percentage) || 0,
        gst_percentage: row.gst_percentage,
        item_group: row.item_group,
        status: row.status,
        item_notes: row.item_notes,
        sub_assemblies: []
      };

      // Enrich with components using robust batch + version + parent ID linking
      const snapshots = rows.filter(r => {
        const isComponent = (r.status || '').toUpperCase() === 'COMPONENT';
        if (!isComponent) return false;

        // 1. PRIMARY: Exact parent ID match (stored in rejection_reason column)
        const parentLink = (r.rejection_reason || '').trim();
        if (parentLink === String(row.id)) return true;

        // 2. FALLBACK: Batch match (if legacy or rejection_reason is missing)
        // If there's only one parent in the batch, all components must belong to it
        const parentsInBatch = rows.filter(p => (p.status || '').toUpperCase() !== 'COMPONENT');
        if (parentsInBatch.length === 1 && r.batch_id === row.batch_id && r.version === row.version) {
          return true;
        }

        return false;
      });

      const seen = new Set();
      const uniqueSnapshots = snapshots.filter(sn => {
        const code = String(sn.item_code || sn.drawing_no || sn.description || '').trim().toLowerCase();
        if (seen.has(code)) return false;
        seen.add(code);
        return true;
      });

      itemData.sub_assemblies = uniqueSnapshots.map(sn => ({
        id: sn.id,
        item_code: sn.item_code,
        drawing_no: sn.drawing_no,
        description: sn.description,
        quantity: sn.item_qty,
        unit: sn.unit,
        bom_cost: parseFloat(sn.bom_cost) || 0,
        rate: parseFloat(sn.bom_cost) || 0,
        pending_bom_cost: sn.pending_bom_cost ? parseFloat(sn.pending_bom_cost) : null,
        item_group: sn.item_group,
        is_snapshot: true,
        available_stock: parseFloat(sn.available_stock || 0)
      }));

      return itemData;
    });

    res.json({
      ...mainQuote,
      items
    });
  } catch (error) {
    next(error);
  }
};

const requestQuotationUpdateFromBOM = async (req, res, next) => {
  try {
    const { salesOrderItemId, bomCost } = req.body;

    if (!salesOrderItemId || bomCost === undefined) {
      return res.status(400).json({ error: 'salesOrderItemId and bomCost are required' });
    }

    // 1. Fetch the identity of the BOM item
    const [bomItems] = await pool.query(
      'SELECT item_code, drawing_no, description FROM sales_order_items WHERE id = ?',
      [salesOrderItemId]
    );

    if (bomItems.length === 0) {
      throw new Error('BOM version not found');
    }

    const { item_code, drawing_no, description } = bomItems[0];
    const requesterName = req.user ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() : 'A user';

    // 2. Find all relevant quotations
    // Priority: 
    // a) Match by sales_order_item_id
    // b) Match by (item_code AND drawing_no)
    // c) Match by drawing_no alone (if item_code is missing)
    // d) Match by description (as last resort)
    // e) Match if it's a SUB-COMPONENT of a parent that is in a quotation
    let [qrs] = await pool.query(
      `SELECT qr.id, c.company_name, qr.batch_id, qr.sales_order_item_id, qr.status
       FROM quotation_requests qr
       JOIN companies c ON qr.company_id = c.id
       WHERE (qr.sales_order_item_id = ? 
          OR (qr.item_code IS NOT NULL AND qr.item_code = ? AND qr.drawing_no = ?)
          OR (qr.item_code IS NULL AND qr.drawing_no = ? AND qr.drawing_no IS NOT NULL)
          OR (qr.drawing_no IS NULL AND qr.description = ? AND qr.description IS NOT NULL))
          AND qr.status NOT IN ('COMPLETED', 'REJECTED', 'CANCELLED')
          AND qr.status != 'COMPONENT'`,
      [salesOrderItemId, item_code, drawing_no, drawing_no, description]
    );

    let isParentNotification = false;

    // 2.1 IF NO QUOTATIONS FOUND, check if it's a sub-assembly component of an active ASSEMBLY quotation
    if (qrs.length === 0) {
      console.log(`[requestQuotationUpdateFromBOM] No direct quotations for ${item_code}. Checking parents...`);
      const [parentQrs] = await pool.query(
        `SELECT DISTINCT qr.id, c.company_name, qr.batch_id, qr.description as parent_desc, qr.sales_order_item_id
         FROM quotation_requests qr
         JOIN companies c ON qr.company_id = c.id
         JOIN sales_order_item_components sic ON sic.sales_order_item_id = qr.sales_order_item_id
         WHERE (sic.component_code = ? OR sic.drawing_no = ?)
         AND qr.status NOT IN ('COMPLETED', 'REJECTED', 'CANCELLED')`,
        [item_code, drawing_no]
      );

      if (parentQrs.length > 0) {
        console.log(`[requestQuotationUpdateFromBOM] Found ${parentQrs.length} parent quotations to notify.`);
        qrs = parentQrs;
        isParentNotification = true;
      }
    }

    if (qrs.length === 0) {
      console.log(`[requestQuotationUpdateFromBOM] No active quotations found for: ${item_code} / ${drawing_no} / ${description}`);
      return res.status(404).json({ error: 'No active quotations found for this item.' });
    }

    // 3. Insert communication record for each quotation AND update pending_bom_cost
    const message = `${requesterName} has requested a quotation update for "${description || drawing_no || item_code}" with the latest BOM cost: ₹${parseFloat(bomCost).toLocaleString('en-IN')}. Please review and update.`;

    for (const qr of qrs) {
      await pool.execute(
        `INSERT INTO quotation_communications 
         (quotation_id, quotation_type, sender_type, message, created_at, is_read) 
         VALUES (?, ?, ?, ?, NOW(), 0)`,
        [qr.id, 'INTERNAL', 'SYSTEM', message]
      );

      let targetPendingCost = bomCost;
      if (isParentNotification && qr.sales_order_item_id) {
        const [parentItemRow] = await pool.query(
          'SELECT bom_cost FROM sales_order_items WHERE id = ?',
          [qr.sales_order_item_id]
        );
        if (parentItemRow.length > 0 && parseFloat(parentItemRow[0].bom_cost) > 0) {
          targetPendingCost = parseFloat(parentItemRow[0].bom_cost);
        }
      }

      // Update the quotation request with the pending cost
      await pool.execute(
        'UPDATE quotation_requests SET pending_bom_cost = ? WHERE id = ?',
        [targetPendingCost, qr.id]
      );

      // Also, update the pending_bom_cost of the component row inside quotation_requests
      // where status = 'COMPONENT' and rejection_reason = String(qr.id)
      await pool.execute(
        `UPDATE quotation_requests 
         SET pending_bom_cost = ?, updated_at = NOW() 
         WHERE status = 'COMPONENT' AND rejection_reason = ?
         AND (LOWER(TRIM(item_code)) = LOWER(TRIM(?)) OR LOWER(TRIM(drawing_no) ) = LOWER(TRIM(?)))`,
        [bomCost, String(qr.id), item_code, drawing_no]
      );
    }

    res.json({
      message: `Request to update ${qrs.length} quotations has been sent to the Sales/Purchase team.`
    });
  } catch (error) {
    next(error);
  }
};

const sendExistingQuotationEmail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { to, subject, message, attachPDF, customAttachments, cc, bcc } = req.body;

    // 1. Fetch the representative quotation to get client info and timestamp
    // Corrected SQL query to fetch client email from contacts table
    const [quotes] = await pool.query(
      `SELECT qr.*, c.company_name, c.id as client_id,
              COALESCE(qr.client_email, cd_proj.email, (SELECT email FROM contacts WHERE company_id = c.id AND (contact_type = 'PRIMARY' OR contact_type = 'PURCHASE') LIMIT 1)) as client_email,
              COALESCE(qr.client_phone, cd_proj.phone, (SELECT phone FROM contacts WHERE company_id = c.id AND (contact_type = 'PRIMARY' OR contact_type = 'PURCHASE') LIMIT 1)) as client_phone,
              COALESCE(qr.contact_person, cd_proj.contact_person, (SELECT name FROM contacts WHERE company_id = c.id AND (contact_type = 'PRIMARY' OR contact_type = 'PURCHASE') LIMIT 1)) as contact_person,
              COALESCE(qr.client_address, cd_proj.billing_address, (SELECT CONCAT(line1, ', ', IFNULL(line2, ''), city, ', ', state, ' ', pincode) FROM company_addresses WHERE company_id = c.id LIMIT 1)) as client_address
       FROM quotation_requests qr 
       JOIN companies c ON qr.company_id = c.id 
       LEFT JOIN (
         SELECT client_name, project_name, email, phone, contact_person, billing_address,
                ROW_NUMBER() OVER (PARTITION BY client_name, project_name ORDER BY id DESC) as rn
         FROM customer_drawings
         WHERE contact_person IS NOT NULL OR phone IS NOT NULL OR email IS NOT NULL
       ) cd_proj ON cd_proj.client_name = c.company_name 
                AND TRIM(LOWER(cd_proj.project_name)) = TRIM(LOWER(qr.project_name))
                AND cd_proj.rn = 1
       WHERE qr.id = ?`,
      [id]
    );

    if (quotes.length === 0) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    const representative = quotes[0];
    const clientEmail = to || representative.client_email;
    const clientName = representative.company_name;

    if (!clientEmail) {
      return res.status(400).json({ error: 'Client email is required to send quotation' });
    }

    // 2. Fetch all quotations in this batch (same client, same approx timestamp)
    // We exclude COMPONENT rows as they are snapshots for sub-assemblies
    const [batchQuotes] = await pool.query(
      `SELECT qr.*, 
              COALESCE(soi.drawing_no, qr.drawing_no) as effective_drawing_no, 
              COALESCE(soi.description, qr.description) as effective_description
       FROM quotation_requests qr
       LEFT JOIN sales_order_items soi ON qr.sales_order_item_id = soi.id
       WHERE qr.company_id = ? 
       AND ABS(TIMESTAMPDIFF(SECOND, qr.created_at, ?)) <= 10
       AND qr.status != 'COMPONENT'`,
      [representative.company_id, representative.created_at]
    );

    const items = await Promise.all(batchQuotes.map(async q => {
      // Fetch component snapshots for this item
      const [components] = await pool.query(
        'SELECT * FROM quotation_requests WHERE status = ? AND rejection_reason = ?',
        ['COMPONENT', String(q.id)]
      );

      return {
        id: q.id,
        item_code: q.item_code || null,
        drawing_no: q.effective_drawing_no || '—',
        description: q.effective_description || '',
        quantity: q.item_qty || 1,
        quotedPrice: (parseFloat(q.total_amount) / (q.item_qty || 1)) || 0,
        profit_percentage: q.profit_percentage || 0,
        override_percentage: q.override_percentage || 0,
        bom_cost: parseFloat(q.bom_cost) || 0,
        gst_percentage: q.gst_percentage || 18,
        status: q.status,
        sub_assemblies: components.map(sa => ({
          drawing_no: sa.drawing_no,
          description: sa.description,
          quantity: sa.item_qty,
          unit: sa.item_unit,
          rate: parseFloat(sa.received_amount) || parseFloat(sa.bom_cost) || 0
        }))
      };
    }));

    const totalAmount = batchQuotes.reduce((sum, q) => {
      if (q.status === 'REJECTED') return sum;
      return sum + (parseFloat(q.total_amount) || 0);
    }, 0);

    const quoteNumber = `QRT-${String(representative.id).padStart(4, '0')}`;
    const totalAmountNum = parseFloat(totalAmount) || 0;

    const emailResult = await emailService.sendQuotationEmail(
      clientEmail,
      clientName,
      items,
      totalAmountNum,
      representative.notes,
      representative.client_id,
      quoteNumber,
      representative.host_company_id,
      {
        email: clientEmail,
        phone: representative.client_phone,
        contact_person: representative.contact_person,
        address: representative.client_address
      },
      subject,
      message,
      attachPDF !== undefined ? attachPDF : true,
      customAttachments || [],
      cc,
      bcc
    );

    const emailMessageId = emailResult?.messageId || null;

    // Log to communications for ALL quotations in this batch
    const messageText = `Quotation ${quoteNumber} sent to client.\nTotal Amount (Incl. GST): ₹${totalAmountNum.toLocaleString('en-IN')}\nItems: ${items.length}`;

    for (const q of batchQuotes) {
      if (q.status === 'DRAFT') {
        await pool.execute(
          'UPDATE quotation_requests SET status = ?, updated_at = NOW() WHERE id = ?',
          ['SENT', q.id]
        );
      }
      await pool.execute(
        `INSERT INTO quotation_communications 
         (quotation_id, quotation_type, sender_type, message, email_message_id, created_at, is_read) 
         VALUES (?, ?, ?, ?, ?, NOW(), 1)`,
        [q.id, 'CLIENT', 'SYSTEM', messageText, emailMessageId]
      );
    }

    res.json({
      message: 'Quotation sent to client successfully',
      emailSent: true
    });

  } catch (error) {
    console.error('[Quotation Controller] Email sending failed:', error);
    next(error);
  }
};

module.exports = {
  getQuotationRequests,
  getQuotationVersionHistory,
  getQuotationVersionDetails,
  downloadQuotationPDF,
  exportQuotationCostBreakdown,
  exportQuotationCostBreakdownPDF,
  getQuotationCostBreakdownDetails,
  approveQuotationRequest,
  batchApproveQuotationRequests,
  batchUploadReplyPDF,
  batchSendToDesign,
  rejectQuotationRequest,
  sendQuotationViaEmail,
  deleteQuotationRequest,
  batchDeleteQuotationRequests,
  updateQuotationRates,
  updateQuotationFromBOM,
  requestQuotationUpdateFromBOM,
  sendExistingQuotationEmail
};
