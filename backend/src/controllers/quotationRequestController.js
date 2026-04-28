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
               qr.profit_percentage, qr.gst_percentage, qr.pending_bom_cost,
               qr.version, qr.parent_id, qr.batch_id,
               COALESCE(qr.project_name, so.project_name, 'Manual Quotation') as project_name, 
               so.bom_id, c.company_name, 
               (SELECT email FROM contacts WHERE company_id = c.id AND (contact_type = 'PRIMARY' OR contact_type = 'PURCHASE') LIMIT 1) as client_email,
               (SELECT phone FROM contacts WHERE company_id = c.id AND (contact_type = 'PRIMARY' OR contact_type = 'PURCHASE') LIMIT 1) as client_phone,
               (SELECT CONCAT(line1, ', ', IFNULL(line2, ''), city, ', ', state, ' ', pincode) FROM company_addresses WHERE company_id = c.id LIMIT 1) as client_address,
               cp.po_number,
               COALESCE(soi.drawing_no, qr.drawing_no, '—') as drawing_no,
               COALESCE(soi.description, qr.description, '—') as item_description,
               COALESCE(
                 qr.item_qty, 
                 poi.quantity,
                 (SELECT MAX(quantity) FROM sales_order_items WHERE sales_order_id = soi.sales_order_id AND TRIM(drawing_no) = TRIM(soi.drawing_no)),
                 soi.quantity, 
                 0
               ) as item_qty,
               COALESCE(soi.unit, qr.item_unit, 'NOS') as item_unit,
               COALESCE(soi.unit, qr.item_unit, 'NOS') as uom,
               COALESCE(qr.item_group, soi.item_group, 'FG') as item_group,
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
        LEFT JOIN sales_order_items soi ON soi.id = qr.sales_order_item_id
        LEFT JOIN customer_po_items poi ON so.customer_po_id = poi.customer_po_id 
             AND (TRIM(soi.drawing_no) = TRIM(poi.drawing_no) AND soi.drawing_no IS NOT NULL)
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
    
    // Enrich with sub-assemblies for items with BOM structure
    const enrichedRows = await Promise.all(rows.map(async (row) => {
      // Fetch components for items that might have a BOM (FG or SA)
      // Use direct identifiers from QR if available as they are more reliable for the specific version
      const itemCode = row.item_code || null;
      const drawingNo = (row.drawing_no && row.drawing_no !== '—') ? row.drawing_no : null;
      const soiId = row.sales_order_item_id || null;

      if (soiId || itemCode || drawingNo) {
        try {
          const components = await bomService.getItemComponents(
            `HISTORICAL_${soiId}`, 
            itemCode, 
            drawingNo, 
            row.batch_id, 
            row.created_at
          );
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
              COALESCE(soi.drawing_no, qr.drawing_no) as drawing_no,
              COALESCE(soi.description, qr.description) as item_description,
              COALESCE(soi.unit, qr.item_unit) as item_unit,
              COALESCE(soi.item_code, qr.item_code) as item_code,
              (
                SELECT bom_cost FROM sales_order_items v2 
                WHERE ((v2.bom_id = soi.bom_id AND soi.bom_id IS NOT NULL)
                   OR (LOWER(TRIM(v2.item_code)) = LOWER(TRIM(soi.item_code)) AND LOWER(TRIM(v2.drawing_no)) = LOWER(TRIM(soi.drawing_no)) AND v2.item_code IS NOT NULL AND v2.drawing_no IS NOT NULL)
                   OR (LOWER(TRIM(v2.drawing_no)) = LOWER(TRIM(qr.drawing_no)) AND qr.drawing_no IS NOT NULL AND LOWER(TRIM(v2.description)) = LOWER(TRIM(qr.description))))
                   AND v2.bom_cost > 0
                ORDER BY v2.id DESC LIMIT 1
              ) as latest_bom_cost
       FROM quotation_requests qr
       JOIN companies c ON qr.company_id = c.id
       LEFT JOIN sales_order_items soi ON soi.id = qr.sales_order_item_id
       WHERE qr.id = ? OR qr.parent_id = ? 
          OR qr.parent_id IN (SELECT id FROM quotation_requests WHERE id = ? OR parent_id = ?)
          OR qr.id IN (SELECT parent_id FROM quotation_requests WHERE id = ?)
          OR (qr.batch_id IS NOT NULL AND qr.batch_id = ?)
          OR (qr.company_id = ? AND qr.project_name = ? AND ABS(TIMESTAMPDIFF(SECOND, qr.created_at, ?)) < 60)
       ORDER BY qr.version ASC, qr.id ASC`,
      [rootId, rootId, rootId, rootId, id, targetQuote.batch_id, targetQuote.company_id, targetQuote.project_name, targetQuote.created_at]
    );

    // Group items by version
    const versionGroups = [];
    const versionMap = {};

    for (const row of rows) {
      if (!versionMap[row.version]) {
        // Initialize version group
        versionMap[row.version] = {
          id: row.id,
          version: row.version,
          status: row.status,
          created_at: row.created_at,
          // We will sum line totals to get the version grand total
          total_amount: 0,
          received_amount: 0,
          project_name: row.project_name,
          notes: row.notes,
          company_id: row.company_id,
          company_name: row.company_name,
          items: []
        };
        versionGroups.push(versionMap[row.version]);
      }
      
      const group = versionMap[row.version];
      const lineTotal = parseFloat(row.total_amount) || 0;
      const lineTotalInclGst = parseFloat(row.received_amount) || 0;
      
      // Sum line totals into the version's grand total
      group.total_amount += lineTotal;
      group.received_amount += lineTotalInclGst;
      
      const itemRate = parseFloat(lineTotal / (row.item_qty || 1)) || 0;
      const itemTotal = lineTotal;
      
      const itemData = {
        id: row.id,
        sales_order_item_id: row.sales_order_item_id,
        item_code: row.item_code,
        drawing_no: row.drawing_no,
        description: row.item_description,
        quantity: row.item_qty,
        unit: row.item_unit,
        rate: itemRate,
        bom_cost: parseFloat(row.bom_cost) || parseFloat(row.latest_bom_cost) || 0,
        total: itemTotal,
        gst_percentage: row.gst_percentage,
        item_group: row.item_group,
        status: row.status,
        sub_assemblies: []
      };

      // Enrich with sub-assemblies for items with BOM structure
      const itemCodeVer = row.item_code || null;
      const drawingNoVer = (row.drawing_no && row.drawing_no !== '—') ? row.drawing_no : null;
      const soiIdVer = row.sales_order_item_id || null;
      const itemG = (row.item_group || '').toUpperCase();
      const isFG = itemG.includes('FG') || itemG.includes('FINISHED');
      const isSA = itemG.includes('SA') || itemG.includes('SUB') || itemG.includes('ASSEMBLY');

      if (isFG || isSA || soiIdVer || itemCodeVer || drawingNoVer) {
        try {
          // RULE: For historical versions (V1, V2, etc.) or APPROVED records, we must 
          // treat the data as a frozen snapshot.
          // By passing a status-like flag in the itemId parameter (simulating an approved item),
          // we force bomService to stop overriding with latest costs.
          const s = (row.status || '').toUpperCase();
          // Any version that exists in the database is a snapshot of that version's data.
          // We only want "live" calculation for new versions not yet in the DB.
          const isHistoricalVersion = true; 
          
          const components = await bomService.getItemComponents(
            isHistoricalVersion ? `HISTORICAL_${soiIdVer}` : soiIdVer, 
            itemCodeVer, 
            drawingNoVer,
            row.batch_id,
            row.created_at
          );
          
          itemData.sub_assemblies = components.filter(c => {
            const code = (c.item_code || c.component_code || '').toUpperCase();
            const cg = (c.item_group || '').toUpperCase();
            const desc = (c.description || '').toUpperCase();
            return (code.startsWith('SA-') || code.startsWith('SFG-') || 
                    cg.includes('SA') || cg.includes('SUB') || cg.includes('ASSEMBLY') ||
                    desc.includes('ASSEMBLY') || desc.includes('UNIT')) &&
                   !cg.includes('FG');
          });
        } catch (err) {
          console.error(`Error fetching sub-assemblies for QR ${row.id}:`, err);
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
      ['Approved', id]
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
          ['Approved', replyPdfPath, id]
        );
      } else {
        await connection.execute(
          'UPDATE quotation_requests SET status = ?, updated_at = NOW() WHERE id = ?',
          ['Approved', id]
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
    const { clientId, clientEmail, clientName, items, totalAmount, notes, emailRequired = true, status, projectName, clearPendingBomId } = req.body;

    if (!clientId || !items || items.length === 0) {
      return res.status(400).json({ 
        error: 'Missing required fields: clientId, items' 
      });
    }

    if (emailRequired && (!clientEmail || !clientName)) {
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

    const batchId = req.body.batch_id || `BATCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const quotationPromises = [];
    
    for (const item of items) {
      // 1. Save Parent Item
      const parentPromise = new Promise(async (resolve, reject) => {
        try {
          const lineTotal = (item.quotedPrice || 0) * (item.quantity || 1);
          const gstRate = parseFloat(item.gst_percentage) || 18;
          const lineTotalInclGst = lineTotal * (1 + gstRate / 100);
          
          const [result] = await connection.execute(
            `INSERT INTO quotation_requests (
               sales_order_id, sales_order_item_id, item_qty, company_id, 
               status, total_amount, received_amount, rejection_reason, 
               notes, created_at, profit_percentage, gst_percentage,
               version, parent_id, drawing_no, description, item_unit,
               project_name, batch_id, item_group, bom_cost, item_code
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              item.orderId || null, 
              item.salesOrderItemId || null, 
              item.quantity || 0, 
              clientId, 
              status || item.status || 'ACCEPTED', 
              lineTotal, 
              lineTotalInclGst, 
              item.rejection_reason || null, 
              notes || null,
              item.profit_percentage || 0,
              gstRate,
              req.body.version || 1,
              req.body.parentId || null,
              item.drawing_no || null,
              item.description || null,
              item.unit || 'Nos',
              projectName || null,
              batchId,
              item.item_group || item.item_group_calc || null,
              item.bom_cost || 0,
              item.item_code || null
            ]
          );
          resolve(result.insertId);
        } catch (error) {
          reject(error);
        }
      });
      quotationPromises.push(parentPromise);

      // 2. Save Sub-Assemblies (Components) as Cost Snapshots
      // We use status = 'COMPONENT' and total_amount = 0 so they don't show up in lists or totals,
      // but their costs are frozen in this batch for historical accuracy.
      if (item.sub_assemblies && Array.isArray(item.sub_assemblies)) {
        for (const sa of item.sub_assemblies) {
          const saPromise = new Promise(async (resolve, reject) => {
            try {
              await connection.execute(
                `INSERT INTO quotation_requests (
                   company_id, status, total_amount, received_amount, 
                   created_at, version, parent_id, drawing_no, description, 
                   item_unit, item_qty, batch_id, item_group, bom_cost, 
                   project_name, item_code, rejection_reason
                 ) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  clientId,
                  'COMPONENT',
                  0, // Don't affect totals
                  sa.rate || sa.bom_cost || 0, // Store rate in received_amount for components
                  req.body.version || 1,
                  req.body.parentId || null,
                  sa.drawing_no || null,
                  sa.description || null,
                  sa.unit || 'Nos',
                  sa.quantity || 0,
                  batchId,
                  'SUB ASSEMBLY',
                  sa.bom_cost || 0,
                  projectName || null,
                  sa.item_code || sa.component_code || null,
                  item.drawing_no || null // Store parent drawing number to link them
                ]
              );
              resolve(null);
            } catch (error) {
              console.error('[Quotation Controller] Error saving component snapshot:', error.message);
              resolve(null); // Non-critical for parent save
            }
          });
          quotationPromises.push(saPromise);
        }
      }
    }

    const allResults = await Promise.all(quotationPromises);
    const quotationIds = allResults.filter(id => id !== null);

    const uniqueOrderIds = [...new Set(items.map(i => i.orderId))].filter(Boolean);

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
    
    // Refresh connection to ensure we can use it after commit for further queries if needed
    // or use pool for read-only queries later.

    let emailSent = false;
    let emailMessageId = null;
    const firstQuotationId = quotationIds[0];
    const quoteNumber = `QRT-${String(firstQuotationId).padStart(4, '0')}`;
    const totalAmountNum = parseFloat(totalAmount) || 0;

    if (emailRequired) {
      try {
        const emailResult = await emailService.sendQuotationEmail(
          clientEmail,
          clientName,
          items,
          totalAmountNum,
          notes,
          clientId,
          quoteNumber
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
    
    // 2. Fetch all quotations in this batch (same client, same approx timestamp)
    // We use a 10-second window to match the frontend grouping logic
    const [batchQuotes] = await pool.query(
      `SELECT qr.*, 
              COALESCE(soi.drawing_no, qr.drawing_no) as effective_drawing_no, 
              COALESCE(soi.description, qr.description) as effective_description
       FROM quotation_requests qr
       LEFT JOIN sales_order_items soi ON qr.sales_order_item_id = soi.id
       WHERE qr.company_id = ? 
       AND ABS(TIMESTAMPDIFF(SECOND, qr.created_at, ?)) <= 10`,
      [representative.company_id, representative.created_at]
    );

    const items = batchQuotes.map(q => ({
      drawing_no: q.effective_drawing_no || '—',
      description: q.effective_description || '',
      quantity: q.item_qty || 1,
      quotedPrice: (parseFloat(q.total_amount) / (q.item_qty || 1)) || 0,
      profit_percentage: q.profit_percentage || 0,
      gst_percentage: q.gst_percentage || 18,
      status: q.status
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
      quoteNumber
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Quotation_${quoteNumber}.pdf`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('[Quotation Controller] PDF download failed:', error);
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
      `SELECT qr.id, c.company_name, qr.batch_id
       FROM quotation_requests qr
       JOIN companies c ON qr.company_id = c.id
       WHERE (qr.sales_order_item_id = ? 
          OR (qr.item_code IS NOT NULL AND qr.item_code = ? AND qr.drawing_no = ?)
          OR (qr.item_code IS NULL AND qr.drawing_no = ? AND qr.drawing_no IS NOT NULL)
          OR (qr.drawing_no IS NULL AND qr.description = ? AND qr.description IS NOT NULL))
          AND qr.status NOT IN ('COMPLETED', 'REJECTED', 'CANCELLED')`,
      [salesOrderItemId, item_code, drawing_no, drawing_no, description]
    );

    // 2.1 IF NO QUOTATIONS FOUND, check if it's a sub-assembly component of an active FG quotation
    if (qrs.length === 0) {
      console.log(`[requestQuotationUpdateFromBOM] No direct quotations for ${item_code}. Checking parents...`);
      const [parentQrs] = await pool.query(
        `SELECT DISTINCT qr.id, c.company_name, qr.batch_id, qr.description as parent_desc
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

      // Update the quotation request with the pending cost
      await pool.execute(
        'UPDATE quotation_requests SET pending_bom_cost = ? WHERE id = ?',
        [bomCost, qr.id]
      );
    }

    res.json({ 
      message: `Request to update ${qrs.length} quotations has been sent to the Sales/Purchase team.`
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getQuotationRequests,
  getQuotationVersionHistory,
  downloadQuotationPDF,
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
  requestQuotationUpdateFromBOM
};
