const pool = require('../config/db');
const stockService = require('./stockService');
const emailService = require('./emailService');
const puppeteer = require('puppeteer');
const mustache = require('mustache');

/**
 * Helper to find the correct item_code from stock_balance by matching material name/type
 * if the provided item_code is missing or inconsistent.
 */
const getCorrectItemCode = async (item, connection) => {
  let itemCode = item.item_code || item.drawing_no;
  
  // 0. If we already have a specific item code that exists in stock_balance and matches the name, use it!
  if (itemCode && itemCode !== 'auto-generated') {
    const [existing] = await connection.query(
      `SELECT item_code, material_type FROM stock_balance 
       WHERE (item_code = ? OR drawing_no = ?) 
       AND LOWER(TRIM(material_name)) = LOWER(TRIM(?)) 
       LIMIT 1`,
      [itemCode, itemCode, item.material_name]
    );
    if (existing.length > 0) {
      // Update item type to match the existing one if needed
      if (existing[0].material_type) {
        item.material_type = existing[0].material_type;
      }
      return existing[0].item_code;
    }
  }

  if (item.material_name) {
    // 1. Try matching by name and material type
    const [sb] = await connection.query(
      `SELECT item_code FROM stock_balance 
       WHERE LOWER(TRIM(material_name)) = LOWER(TRIM(?)) 
       AND (material_type = ? OR UPPER(REPLACE(material_type, ' ', '_')) = UPPER(REPLACE(?, ' ', '_')))
       LIMIT 1`,
      [item.material_name, item.material_type, item.material_type]
    );
    
    if (sb.length > 0) {
      return sb[0].item_code;
    }
    
    // 2. If not found, try matching by name only (more flexible)
    const [sbNameOnly] = await connection.query(
      `SELECT item_code FROM stock_balance 
       WHERE LOWER(TRIM(material_name)) = LOWER(TRIM(?)) 
       LIMIT 1`,
      [item.material_name]
    );
    
    if (sbNameOnly.length > 0) {
      return sbNameOnly[0].item_code;
    }
  }

  // If we have an item code, return it as is if no match found in stock_balance
  if (itemCode && itemCode !== 'auto-generated') return itemCode;

  // 3. Fallback: Generate a standard item code using stockService logic if we have name/type
  if (item.material_name) {
    return await stockService.generateItemCode(item.material_name, item.material_type);
  }

  return null;
};

const getQCWithDetails = async (qcId) => {
  const [qcs] = await pool.query(
    `SELECT 
      qc.id,
      qc.grn_id,
      qc.inspection_date,
      qc.pass_quantity,
      qc.fail_quantity,
      qc.status,
      qc.defects,
      qc.remarks,
      qc.invoice_url,
      qc.created_at,
      qc.updated_at,
      g.po_number,
      po.id AS po_id,
      po.vendor_id,
      v.vendor_name AS vendor_name,
      v.email AS vendor_email
    FROM qc_inspections qc
    LEFT JOIN grns g ON qc.grn_id = g.id
    LEFT JOIN purchase_orders po ON g.po_number = po.po_number
    LEFT JOIN vendors v ON po.vendor_id = v.id
    WHERE qc.id = ?`,
    [qcId]
  );
  
  if (qcs.length > 0) {
    const qc = qcs[0];
    
    const [qcItems] = await pool.query(
      `SELECT 
        qci.id,
        qci.item_code, 
        qci.po_qty, 
        qci.received_qty,
        qci.accepted_qty, 
        qci.rejected_qty, 
        qci.status,
        poi.material_name,
        poi.description,
        poi.unit_rate,
        w.warehouse_name
       FROM qc_inspection_items qci
       LEFT JOIN grn_items gi ON qci.grn_item_id = gi.id
       LEFT JOIN purchase_order_items poi ON gi.po_item_id = poi.id
       LEFT JOIN warehouses w ON qci.warehouse_id = w.id
       WHERE qci.qc_inspection_id = ?`,
      [qcId]
    );
    
    const orderedQty = qcItems.reduce((sum, item) => sum + (parseFloat(item.po_qty) || 0), 0);
    const acceptedQty = qcItems.reduce((sum, item) => sum + (parseFloat(item.accepted_qty) || 0), 0);
    
    qc.shortage = orderedQty > acceptedQty ? orderedQty - acceptedQty : 0;
    qc.overage = acceptedQty > orderedQty ? acceptedQty - orderedQty : 0;
    qc.items = qcItems.length;
    qc.accepted_quantity = acceptedQty;
    
    qc.items_detail = qcItems.map(item => ({
      id: item.id,
      item_code: item.item_code,
      material_name: item.material_name,
      description: item.description,
      rate: parseFloat(item.unit_rate) || 0,
      warehouse_name: item.warehouse_name,
      ordered_qty: parseFloat(item.po_qty) || 0,
      received_qty: parseFloat(item.received_qty) || 0,
      accepted_qty: parseFloat(item.accepted_qty) || 0,
      rejected_qty: parseFloat(item.rejected_qty) || 0,
      shortage: Math.max(0, (parseFloat(item.po_qty) || 0) - (parseFloat(item.accepted_qty) || 0)),
      overage: Math.max(0, (parseFloat(item.accepted_qty) || 0) - (parseFloat(item.po_qty) || 0))
    }));
  }
  
  return qcs[0] || null;
};

const getAllQCs = async () => {
  const [qcs] = await pool.query(
    `SELECT 
      qc.id,
      qc.grn_id,
      qc.inspection_date,
      qc.pass_quantity,
      qc.fail_quantity,
      qc.status,
      qc.defects,
      qc.remarks,
      qc.invoice_url,
      qc.created_at,
      qc.updated_at,
      g.po_number,
      po.vendor_id,
      v.vendor_name AS vendor_name,
      v.email AS vendor_email
    FROM qc_inspections qc
    LEFT JOIN grns g ON qc.grn_id = g.id
    LEFT JOIN purchase_orders po ON g.po_number = po.po_number
    LEFT JOIN vendors v ON po.vendor_id = v.id
    ORDER BY qc.created_at DESC`
  );
  
  const result = [];
  for (const qc of qcs) {
    const [qcItems] = await pool.query(
      `SELECT 
        qci.id,
        qci.item_code, 
        qci.po_qty, 
        qci.received_qty, 
        qci.accepted_qty, 
        qci.rejected_qty, 
        qci.status,
        poi.material_name,
        poi.description,
        poi.unit_rate,
        w.warehouse_name
       FROM qc_inspection_items qci 
       LEFT JOIN grn_items gi ON qci.grn_item_id = gi.id
       LEFT JOIN purchase_order_items poi ON gi.po_item_id = poi.id
       LEFT JOIN warehouses w ON qci.warehouse_id = w.id
       WHERE qci.qc_inspection_id = ?`,
      [qc.id]
    );
    
    const orderedQty = qcItems.reduce((sum, item) => sum + (parseFloat(item.po_qty) || 0), 0);
    const acceptedQty = qcItems.reduce((sum, item) => sum + (parseFloat(item.accepted_qty) || 0), 0);
    
    result.push({
      ...qc,
      shortage: orderedQty > acceptedQty ? orderedQty - acceptedQty : 0,
      overage: acceptedQty > orderedQty ? acceptedQty - orderedQty : 0,
      items: qcItems.length,
      accepted_quantity: acceptedQty,
      items_detail: qcItems.map(item => ({
        id: item.id,
        item_code: item.item_code,
        material_name: item.material_name,
        description: item.description,
        rate: parseFloat(item.unit_rate) || 0,
        warehouse_name: item.warehouse_name,
        ordered_qty: parseFloat(item.po_qty) || 0,
        received_qty: parseFloat(item.received_qty) || 0,
        accepted_qty: parseFloat(item.accepted_qty) || 0,
        rejected_qty: parseFloat(item.rejected_qty) || 0,
        shortage: Math.max(0, (parseFloat(item.po_qty) || 0) - (parseFloat(item.accepted_qty) || 0)),
        overage: Math.max(0, (parseFloat(item.accepted_qty) || 0) - (parseFloat(item.po_qty) || 0)),
        status: item.status
      }))
    });
  }
  
  return result;
};

const createQC = async (grnId, inspectionDate, passQuantity, failQuantity, defects, remarks, providedConnection = null) => {
  if (!grnId) {
    const error = new Error('GRN ID is required');
    error.statusCode = 400;
    throw error;
  }

  const connection = providedConnection || await pool.getConnection();
  const shouldRelease = !providedConnection;
  const shouldCommit = !providedConnection;

  try {
    if (shouldCommit) await connection.beginTransaction();

    const [grn] = await connection.query(
      'SELECT id FROM grns WHERE id = ?',
      [grnId]
    );

    if (!grn.length) {
      throw new Error('GRN not found');
    }

    const passQty = passQuantity ?? 0;

    const [result] = await connection.execute(
      `INSERT INTO qc_inspections (grn_id, inspection_date, pass_quantity, fail_quantity, status, defects, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [grnId, inspectionDate, passQty, failQuantity || 0, 'PENDING', defects || null, remarks || null]
    );

    const qcId = result.insertId;

    const [grnItems] = await connection.query(
      `SELECT 
        gi.id, 
        poi.item_code, 
        poi.material_name,
        poi.material_type,
        gi.po_qty, 
        gi.received_qty, 
        gi.accepted_qty, 
        gi.rejected_qty, 
        gi.status,
        gi.warehouse_id
       FROM grn_items gi
       LEFT JOIN purchase_order_items poi ON gi.po_item_id = poi.id
       WHERE gi.grn_id = ?`,
      [grnId]
    );

    for (const item of grnItems) {
      const correctedItemCode = await getCorrectItemCode(item, connection);
      
      await connection.execute(
        `INSERT INTO qc_inspection_items 
         (qc_inspection_id, grn_item_id, warehouse_id, item_code, po_qty, received_qty, accepted_qty, rejected_qty, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [qcId, item.id, item.warehouse_id, correctedItemCode, item.po_qty, item.received_qty, item.accepted_qty, item.rejected_qty, 'PENDING']
      );
    }

    if (shouldCommit) await connection.commit();
    return qcId; // Returning ID instead of full details to avoid complex getQCWithDetails with connection
  } catch (error) {
    if (shouldCommit) await connection.rollback();
    throw error;
  } finally {
    if (shouldRelease) connection.release();
  }
};

const updateQC = async (qcId, updates) => {
  const { inspectionDate, passQuantity, failQuantity, status, defects, remarks, items } = updates;
  
  const setClause = [];
  const values = [];

  if (inspectionDate !== undefined) {
    setClause.push('inspection_date = ?');
    values.push(inspectionDate);
  }

  if (passQuantity !== undefined) {
    setClause.push('pass_quantity = ?');
    values.push(passQuantity);
  }

  if (failQuantity !== undefined) {
    setClause.push('fail_quantity = ?');
    values.push(failQuantity);
  }

  if (status !== undefined) {
    setClause.push('status = ?');
    values.push(status);
  }

  if (defects !== undefined) {
    setClause.push('defects = ?');
    values.push(defects);
  }

  if (remarks !== undefined) {
    setClause.push('remarks = ?');
    values.push(remarks);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    if (setClause.length > 0) {
      values.push(qcId);

      await connection.execute(
        `UPDATE qc_inspections SET ${setClause.join(', ')} WHERE id = ?`,
        values
      );
    }

    // Update items if provided
    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (item.id) {
          await connection.execute(
            `UPDATE qc_inspection_items 
             SET accepted_qty = ?, rejected_qty = ?, status = ?, remarks = ? 
             WHERE id = ?`,
            [
              item.accepted_qty || 0,
              item.rejected_qty || 0,
              item.status || status || 'PENDING',
              item.remarks || null,
              item.id
            ]
          );

          // Also update grn_items
          const [qcItem] = await connection.query(
            'SELECT grn_item_id FROM qc_inspection_items WHERE id = ?',
            [item.id]
          );

          if (qcItem.length) {
            await connection.execute(
              'UPDATE grn_items SET accepted_qty = ?, rejected_qty = ?, status = ? WHERE id = ?',
              [
                item.accepted_qty || 0,
                item.rejected_qty || 0,
                item.status || status || 'PENDING',
                qcItem[0].grn_item_id
              ]
            );
          }
        }
      }
    }

    const [qcData] = await connection.query(
      'SELECT grn_id, pass_quantity, status FROM qc_inspections WHERE id = ?',
      [qcId]
    );

    const currentStatus = status !== undefined ? status : (qcData.length > 0 ? qcData[0].status : null);

    if (qcData.length) {
      const grnId = qcData[0].grn_id;

      const [grnItems] = await connection.query(
        'SELECT id, accepted_qty FROM grn_items WHERE grn_id = ?',
        [grnId]
      );

      const totalAcceptedQty = grnItems.reduce((sum, item) => sum + (parseFloat(item.accepted_qty) || 0), 0);

      let grnStatus = 'PENDING';
      if (currentStatus === 'PASSED' || currentStatus === 'ACCEPTED') {
        grnStatus = 'Approved ';
      } else if (currentStatus === 'FAILED') {
        grnStatus = 'REJECTED';
      } else if (currentStatus === 'SHORTAGE') {
        grnStatus = 'INSPECTED';
      } else if (currentStatus === 'IN_PROGRESS') {
        grnStatus = 'INSPECTED';
      } else if (currentStatus === 'PENDING') {
        grnStatus = 'PENDING';
      }

      await connection.execute(
        'UPDATE grns SET received_quantity = ?, status = ? WHERE id = ?',
        [totalAcceptedQty, grnStatus, grnId]
      );
      if (currentStatus === 'PASSED' || currentStatus === 'ACCEPTED') {
        for (const item of grnItems) {
          await connection.execute(
            'UPDATE grn_items SET status = ? WHERE id = ?',
            ['Approved ', item.id]
          );
        }
      } else if (currentStatus === 'FAILED' || currentStatus === 'REJECTED') {
        for (const item of grnItems) {
          await connection.execute(
            'UPDATE grn_items SET status = ? WHERE id = ?',
            ['REJECTED', item.id]
          );
        }
      }
    } else {
      const error = new Error('QC Inspection not found');
      error.statusCode = 404;
      throw error;
    }

    if (currentStatus === 'ACCEPTED' || currentStatus === 'SHORTAGE' || currentStatus === 'PASSED') {
      const [linked] = await connection.query(
        `SELECT po.sales_order_id, po.id as po_id
         FROM qc_inspections qc
         LEFT JOIN grns g ON qc.grn_id = g.id
         LEFT JOIN purchase_orders po ON g.po_number = po.po_number
         WHERE qc.id = ?
         LIMIT 1`,
        [qcId]
      );

      if (linked.length) {
        if (linked[0].sales_order_id) {
          await connection.execute(
            'UPDATE sales_orders SET status = ?, material_available = 1 WHERE id = ?',
            ['MATERIAL_READY', linked[0].sales_order_id]
          );
        }

        // Update PO status to FULFILLED when QC passes
        if (linked[0].po_id && (currentStatus === 'ACCEPTED' || currentStatus === 'PASSED')) {
          await connection.execute(
            'UPDATE purchase_orders SET status = ? WHERE id = ?',
            ['FULFILLED', linked[0].po_id]
          );
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

  return getQCWithDetails(qcId);
};

const updateQCItem = async (qcItemId, updates) => {
  const { acceptedQty, rejectedQty, status, remarks } = updates;

  const setClause = [];
  const values = [];

  if (acceptedQty !== undefined) {
    setClause.push('accepted_qty = ?');
    values.push(acceptedQty);
  }

  if (rejectedQty !== undefined) {
    setClause.push('rejected_qty = ?');
    values.push(rejectedQty);
  }

  if (status !== undefined) {
    setClause.push('status = ?');
    values.push(status);
  }

  if (remarks !== undefined) {
    setClause.push('remarks = ?');
    values.push(remarks);
  }

  if (setClause.length === 0) {
    return null;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    values.push(qcItemId);

    await connection.execute(
      `UPDATE qc_inspection_items SET ${setClause.join(', ')} WHERE id = ?`,
      values
    );

    const [qcItem] = await connection.query(
      'SELECT grn_item_id, accepted_qty, rejected_qty, status FROM qc_inspection_items WHERE id = ?',
      [qcItemId]
    );

    if (qcItem.length) {
      const grnItemId = qcItem[0].grn_item_id;
      const finalAcceptedQty = acceptedQty !== undefined ? acceptedQty : qcItem[0].accepted_qty;
      const finalRejectedQty = rejectedQty !== undefined ? rejectedQty : qcItem[0].rejected_qty;
      const finalStatus = status || qcItem[0].status;

      await connection.execute(
        'UPDATE grn_items SET accepted_qty = ?, rejected_qty = ?, status = ? WHERE id = ?',
        [finalAcceptedQty, finalRejectedQty, finalStatus, grnItemId]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const [updated] = await pool.query(
    'SELECT * FROM qc_inspection_items WHERE id = ?',
    [qcItemId]
  );

  return updated.length ? updated[0] : null;
};

const getQCItems = async (qcId) => {
  const [items] = await pool.query(
    `SELECT 
      qci.id,
      qci.qc_inspection_id,
      qci.grn_item_id,
      qci.item_code,
      qci.po_qty,
      qci.received_qty,
      qci.accepted_qty,
      qci.rejected_qty,
      qci.status,
      qci.remarks,
      qci.created_at,
      qci.updated_at,
      poi.material_name,
      poi.description,
      w.warehouse_name
    FROM qc_inspection_items qci
    LEFT JOIN grn_items gi ON qci.grn_item_id = gi.id
    LEFT JOIN purchase_order_items poi ON gi.po_item_id = poi.id
    LEFT JOIN warehouses w ON qci.warehouse_id = w.id
    WHERE qci.qc_inspection_id = ?
    ORDER BY qci.created_at ASC`,
    [qcId]
  );

  return items;
};

const deleteQC = async (qcId) => {
  const [result] = await pool.execute(
    'DELETE FROM qc_inspections WHERE id = ?',
    [qcId]
  );

  if (result.affectedRows === 0) {
    const error = new Error('QC Inspection not found');
    error.statusCode = 404;
    throw error;
  }

  return { success: true };
};

const getQCStats = async () => {
  const [stats] = await pool.query(
    `SELECT
      COUNT(*) as totalQc,
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pendingQc,
      SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as inProgressQc,
      SUM(CASE WHEN status IN ('PASSED', 'ACCEPTED', 'QC_APPROVED', 'COMPLETED') THEN 1 ELSE 0 END) as passedQc,
      SUM(CASE WHEN status IN ('FAILED', 'REJECTED', 'QC_REJECTED') THEN 1 ELSE 0 END) as failedQc,
      SUM(CASE WHEN status = 'SHORTAGE' THEN 1 ELSE 0 END) as shortageQc,
      SUM(CASE WHEN status = 'ACCEPTED' THEN 1 ELSE 0 END) as acceptedQc
    FROM qc_inspections`
  );

  return stats[0] || {
    totalQc: 0,
    pendingQc: 0,
    inProgressQc: 0,
    passedQc: 0,
    failedQc: 0,
    shortageQc: 0,
    acceptedQc: 0
  };
};

const getQCReports = async () => {
  // 1. KPI Stats
  const stats = await getQCStats();
  
  // Calculate Pass Rate and Rejection Rate
  const totalCompleted = (stats.passedQc || 0) + (stats.failedQc || 0);
  const passRate = totalCompleted > 0 ? Math.round((stats.passedQc / totalCompleted) * 100) : 0;
  const rejectionRate = totalCompleted > 0 ? Math.round((stats.failedQc / totalCompleted) * 100) : 0;
  const qualityScore = passRate; // Simplified for now
  const defectScore = rejectionRate; // Simplified for now

  // 2. Monthly Trend (Last 6 months)
  const [monthlyTrend] = await pool.query(`
    SELECT 
      DATE_FORMAT(month_list.month, '%b') as month,
      COALESCE(SUM(CASE WHEN qc.status IN ('PASSED', 'ACCEPTED', 'QC_APPROVED', 'COMPLETED') THEN 1 ELSE 0 END), 0) as passed,
      COALESCE(SUM(CASE WHEN qc.status IN ('FAILED', 'REJECTED', 'QC_REJECTED') THEN 1 ELSE 0 END), 0) as failed
    FROM (
      SELECT CURRENT_DATE - INTERVAL 5 MONTH as month UNION 
      SELECT CURRENT_DATE - INTERVAL 4 MONTH UNION 
      SELECT CURRENT_DATE - INTERVAL 3 MONTH UNION 
      SELECT CURRENT_DATE - INTERVAL 2 MONTH UNION 
      SELECT CURRENT_DATE - INTERVAL 1 MONTH UNION 
      SELECT CURRENT_DATE
    ) month_list
    LEFT JOIN qc_inspections qc ON DATE_FORMAT(qc.inspection_date, '%Y-%m') = DATE_FORMAT(month_list.month, '%Y-%m')
    GROUP BY month_list.month
    ORDER BY month_list.month ASC
  `);

  // 3. Defect Category Breakdown
  // This would typically come from a more granular defect table, but we'll use defects string parsing or mock for now
  // Since defects is a text column in qc_inspections, we might just use some sample data if it's empty
  const defectBreakdown = [
    { name: 'Damaged', value: 40, color: '#ef4444' },
    { name: 'Incorrect Spec', value: 25, color: '#f59e0b' },
    { name: 'Passed', value: 25, color: '#10b981' }, // "Passed" is weird here but matching user UI
    { name: 'Other', value: 20, color: '#3b82f6' }
  ];

  // 4. Supplier Quality Performance
  const [supplierPerformance] = await pool.query(`
    SELECT 
      v.vendor_name as supplier,
      ROUND((SUM(CASE WHEN qc.status IN ('PASSED', 'ACCEPTED', 'QC_APPROVED', 'COMPLETED') THEN 1 ELSE 0 END) / COUNT(*)) * 100) as qualityScore
    FROM qc_inspections qc
    JOIN grns g ON qc.grn_id = g.id
    JOIN purchase_orders po ON g.po_number = po.po_number
    JOIN vendors v ON po.vendor_id = v.id
    GROUP BY v.id
    ORDER BY qualityScore DESC
    LIMIT 5
  `);

  // 5. Recent Inspection Reports
  const [recentReports] = await pool.query(`
    SELECT 
      qc.id as reportId,
      CONCAT('GRN-', LPAD(qc.grn_id, 4, '0')) as grn,
      qc.inspection_date as date,
      qc.status,
      u.username as inspector
    FROM qc_inspections qc
    LEFT JOIN users u ON 1=1 -- Assuming there might be an inspector_id later, using first user or mock
    ORDER BY qc.created_at DESC
    LIMIT 5
  `);

  return {
    kpis: {
      totalInspections: stats.totalQc,
      passRate: passRate + '%',
      rejectionRate: rejectionRate + '%',
      qualityScore: qualityScore + '%',
      defectScore: defectScore + '%'
    },
    monthlyTrend,
    defectBreakdown,
    supplierPerformance,
    recentReports
  };
};

const sendQCAlertEmail = async (qcId, emailData) => {
  const { to, subject, message, attachPDF } = emailData;

  const qc = await getQCWithDetails(qcId);

  if (!to || !subject || !message) {
    throw new Error('Email recipient, subject, and message are required');
  }

  try {
    let attachments = [];
    if (attachPDF) {
      const pdfBuffer = await generateQCInspectionPDF(qcId);
      attachments.push({
        filename: `QC_Report_GRN-${String(qc.grn_id).padStart(4, '0')}.pdf`,
        content: pdfBuffer
      });
    }

    const emailResult = await emailService.sendEmail(to, subject, message, attachments);
    
    return {
      id: qcId,
      sent_to: to,
      sent_at: new Date(),
      message: emailResult.message,
      messageId: emailResult.messageId
    };
  } catch (error) {
    console.error(`[sendQCAlertEmail] Error: ${error.message}`);
    throw error;
  }
};

const generateQCInspectionPDF = async (qcId) => {
  const qc = await getQCWithDetails(qcId);
  if (!qc) throw new Error('QC Inspection not found');

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Inter', system-ui, Avenir, Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; margin: 40px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
        .company-info h1 { color: #2563eb; margin: 0; font-size: 24px; }
        .report-title { text-align: right; }
        .report-title h2 { margin: 0; color: #64748b; font-size: 18px; }
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
        .section-label { font-weight: bold; color: #64748b; font-size: 12px; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background: #f8fafc; color: #64748b; text-align: left; padding: 12px 8px; font-size: 11px; border-bottom: 1px solid #e2e8f0; }
        td { padding: 12px 8px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 10px; font-weight: bold; text-transform: ; }
        .status-passed { background: #ecfdf5; color: #059669; border: 1px solid #10b981; }
        .status-failed { background: #fef2f2; color: #dc2626; border: 1px solid #ef4444; }
        .status-pending { background: #fffbeb; color: #d97706; border: 1px solid #f59e0b; }
        .notes-section { background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #cbd5e1; margin-bottom: 20px; }
        .footer { margin-top: 50px; text-align: center; color: #94a3b8; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-info">
          <h1>SPTECHPIONEER PVT LTD</h1>
          <p>Industrial Area, Sector 5<br>Pune, Maharashtra - 411026</p>
        </div>
        <div class="report-title">
          <h2>QC Inspection Report</h2>
          <p><strong>GRN No:</strong> GRN-{{grn_padded}}<br>
          <strong>PO No:</strong> {{po_number}}<br>
          <strong>Date:</strong> {{inspection_date}}</p>
        </div>
      </div>

      <div class="details-grid">
        <div>
          <div class="section-label">Vendor Information</div>
          <p><strong>{{vendor_name}}</strong><br>
          Email: {{vendor_email}}</p>
        </div>
        <div style="text-align: right;">
          <div class="section-label">Inspection Status</div>
          <span class="status-badge status-{{status_lower}}">{{status}}</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Item Details</th>
            <th style="text-align: center">Ordered</th>
            <th style="text-align: center">Received</th>
            <th style="text-align: center">Accepted</th>
            <th style="text-align: center">Rejected</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {{#items_detail}}
          <tr>
            <td>
              <strong>{{material_name}}</strong><br>
              <span style="font-size: 10px; color: #64748b">{{item_code}}</span>
            </td>
            <td style="text-align: center">{{ordered_qty}}</td>
            <td style="text-align: center">{{received_qty}}</td>
            <td style="text-align: center; color: #059669; font-weight: bold">{{accepted_qty}}</td>
            <td style="text-align: center; color: #dc2626">{{rejected_qty}}</td>
            <td>{{remarks}}</td>
          </tr>
          {{/items_detail}}
          {{^items_detail}}
          <tr>
            <td colspan="6" style="text-align: center; padding: 20px; color: #64748b; font-style: italic;">
              No shortages or overages detected in this inspection.
            </td>
          </tr>
          {{/items_detail}}
        </tbody>
      </table>

      {{#defects}}
      <div class="notes-section">
        <div class="section-label">Reported Defects</div>
        <p>{{defects}}</p>
      </div>
      {{/defects}}

      {{#remarks}}
      <div class="notes-section">
        <div class="section-label">Overall Remarks</div>
        <p>{{remarks}}</p>
      </div>
      {{/remarks}}

      <div class="footer">
        <p>This is a computer-generated Quality Control report. No signature is required.<br>
        SPTECHPIONEER PVT LTD | Quality Assurance Department</p>
      </div>
    </body>
    </html>
  `;

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const viewData = {
    ...qc,
    grn_padded: String(qc.grn_id).padStart(4, '0'),
    inspection_date: formatDate(qc.inspection_date),
    status_lower: qc.status?.toLowerCase(),
    items_detail: (qc.items_detail || [])
      .filter(i => {
        const ordered = parseFloat(i.ordered_qty) || 0;
        const accepted = parseFloat(i.accepted_qty) || 0;
        const rejected = parseFloat(i.rejected_qty) || 0;
        return Math.abs(ordered - accepted) > 0.001 || rejected > 0.001;
      })
      .map(i => ({
        ...i,
        ordered_qty: parseFloat(i.ordered_qty || 0).toFixed(3),
        received_qty: parseFloat(i.received_qty || 0).toFixed(3),
        accepted_qty: parseFloat(i.accepted_qty || 0).toFixed(3),
        rejected_qty: parseFloat(i.rejected_qty || 0).toFixed(3),
        remarks: i.remarks || '—'
      }))
  };

  const html = mustache.render(htmlTemplate, viewData);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({ 
    format: 'A4', 
    printBackground: true,
    margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
  });
  await browser.close();

  return pdf;
};

const updateQCInvoice = async (qcId, invoiceUrl) => {
  const [result] = await pool.execute(
    'UPDATE qc_inspections SET invoice_url = ? WHERE id = ?',
    [invoiceUrl, qcId]
  );
  if (result.affectedRows === 0) throw new Error('QC Inspection not found');
  return { id: qcId, invoice_url: invoiceUrl };
};

const getRejectedItems = async () => {
  const [items] = await pool.query(
    `(SELECT 
      CONCAT('GRN-', qci.id) as id,
      qci.item_code,
      CASE 
        WHEN COALESCE(qci.accepted_qty, 0) > COALESCE(qci.po_qty, 0) THEN qci.accepted_qty - qci.po_qty
        ELSE GREATEST(COALESCE(qci.rejected_qty, 0), CASE WHEN COALESCE(qci.po_qty, 0) > COALESCE(qci.accepted_qty, 0) THEN qci.po_qty - qci.accepted_qty ELSE 0 END)
      END as rejected_qty,
      CASE 
        WHEN qci.status != 'PENDING' AND qci.status IS NOT NULL THEN qci.status
        WHEN COALESCE(qci.accepted_qty, 0) > COALESCE(qci.po_qty, 0) THEN 'OVERAGE'
        WHEN COALESCE(qci.po_qty, 0) > COALESCE(qci.accepted_qty, 0) THEN 'SHORTAGE'
        ELSE 'REJECTED'
      END as item_status,
      qci.remarks as item_remarks,
      qc.inspection_date as date,
      g.po_number as po_number,
      qc.grn_id as ref_id,
      'GRN' as ref_type,
      v.vendor_name as source_name,
      poi.material_name as material_name
    FROM qc_inspection_items qci
    JOIN qc_inspections qc ON qci.qc_inspection_id = qc.id
    LEFT JOIN grns g ON qc.grn_id = g.id
    LEFT JOIN purchase_orders po ON g.po_number = po.po_number
    LEFT JOIN vendors v ON po.vendor_id = v.id
    LEFT JOIN grn_items gi ON qci.grn_item_id = gi.id
    LEFT JOIN purchase_order_items poi ON gi.po_item_id = poi.id
    WHERE COALESCE(qci.rejected_qty, 0) > 0 OR COALESCE(qci.po_qty, 0) > COALESCE(qci.accepted_qty, 0) OR COALESCE(qci.accepted_qty, 0) > COALESCE(qci.po_qty, 0))
    
    UNION ALL
    
    (SELECT 
      CONCAT('JC-', ql.id) as id,
      wo.item_code as item_code,
      ql.rejected_qty,
      ql.status as item_status,
      ql.rejection_reason as item_remarks,
      ql.check_date as date,
      wo.wo_number as po_number,
      jc.id as ref_id,
      'JOB_CARD' as ref_type,
      CONCAT('Op: ', COALESCE(o.operation_name, jc.operation_name)) as source_name,
      wo.item_name as material_name
    FROM job_card_quality_logs ql
    JOIN job_cards jc ON ql.job_card_id = jc.id
    JOIN work_orders wo ON jc.work_order_id = wo.id
    LEFT JOIN operations o ON jc.operation_id = o.id
    WHERE ql.rejected_qty > 0)
    
    ORDER BY date DESC`
  );
  
  return items.map(item => ({
    ...item,
    reference_number: item.ref_type === 'GRN' 
      ? `GRN-${String(item.ref_id).padStart(4, '0')}` 
      : `JC-${String(item.ref_id).padStart(4, '0')}`
  }));
};

const createShipmentFromQC = async (qcId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Check if shipment order already exists for this QC
    // We'll check by qc_id if we add that column, or just by linking via grn
    const [existingShipment] = await connection.query(
      `SELECT s.id FROM shipment_orders s
       JOIN sales_orders so ON s.sales_order_id = so.id
       JOIN purchase_orders po ON so.id = po.sales_order_id
       JOIN grns g ON po.po_number = g.po_number
       JOIN qc_inspections qc ON g.id = qc.grn_id
       WHERE qc.id = ?`,
      [qcId]
    );

    if (existingShipment.length > 0) {
      throw new Error('Shipment order already exists for the associated sales order');
    }

    // 2. Fetch QC details with linked PO and potentially SO
    const [qcRows] = await connection.query(
      `SELECT 
        qc.id, 
        qc.grn_id,
        g.po_number,
        po.sales_order_id,
        po.vendor_id,
        v.vendor_name,
        so.company_id as so_customer_id,
        c.company_name as so_customer_name,
        so.target_dispatch_date,
        so.production_priority,
        so.status as so_status
       FROM qc_inspections qc
       JOIN grns g ON qc.grn_id = g.id
       JOIN purchase_orders po ON g.po_number = po.po_number
       LEFT JOIN vendors v ON po.vendor_id = v.id
       LEFT JOIN sales_orders so ON po.sales_order_id = so.id
       LEFT JOIN companies c ON so.company_id = c.id
       WHERE qc.id = ?`,
      [qcId]
    );

    if (qcRows.length === 0) {
      throw new Error('QC Inspection or associated Purchase Order not found');
    }

    const qcData = qcRows[0];
    
    // Determine customer_id and snapshot details
    const salesOrderId = qcData.sales_order_id || null;
    const customerId = qcData.so_customer_id || null;
    const customerName = qcData.so_customer_name || qcData.vendor_name || null;
    const targetDate = qcData.target_dispatch_date || new Date();
    const priority = qcData.production_priority || 'NORMAL';

    // 3. Generate Shipment Code
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const shipmentCode = `SHP-${year}${month}-QC${String(qcId).padStart(4, '0')}`;

    // 4. Create Shipment Order
    let result;
    try {
      [result] = await connection.execute(
        `INSERT INTO shipment_orders 
         (shipment_code, sales_order_id, customer_id, customer_name, dispatch_target_date, priority, status)
         VALUES (?, ?, ?, ?, ?, ?, 'PENDING_ACCEPTANCE')`,
        [shipmentCode, salesOrderId, customerId, customerName, targetDate, priority]
      );
    } catch (insertErr) {
      console.error('INSERT FAILED in createShipmentFromQC:', insertErr);
      throw insertErr;
    }

    // 5. Update Sales Order Status if linked
    if (salesOrderId && ['PRODUCTION_COMPLETED', 'QC_IN_PROGRESS', 'QC_APPROVED'].includes(qcData.so_status)) {
      await connection.execute(
        'UPDATE sales_orders SET status = ?, current_department = ?, updated_at = NOW() WHERE id = ?',
        ['READY_FOR_SHIPMENT', 'SHIPMENT', salesOrderId]
      );
    }

    await connection.commit();
    return { success: true, shipmentCode, shipmentId: result.insertId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  getQCWithDetails,
  getAllQCs,
  createQC,
  updateQC,
  updateQCItem,
  getQCItems,
  deleteQC,
  getQCStats,
  getQCReports,
  sendQCAlertEmail,
  updateQCInvoice,
  getRejectedItems,
  createShipmentFromQC
};
