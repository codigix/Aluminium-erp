const pool = require('../config/db');
const emailService = require('./emailService');
const purchaseOrderService = require('./purchaseOrderService');
const puppeteer = require('puppeteer');
const mustache = require('mustache');
const pdfModule = require('pdf-parse');
const PDFParseClass = pdfModule.PDFParse || (pdfModule.default && pdfModule.default.PDFParse) || pdfModule;
const fs = require('fs');
const path = require('path');

const generateQuoteNumber = async () => {
  const timestamp = Date.now();
  return `QT-${timestamp}`;
};

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

const createQuotation = async (payload) => {
  const {
    vendorId,
    salesOrderId,
    mrId,
    rfq_id,
    rfq_group_id,
    validUntil,
    notes,
    items = [],
    status = 'DRAFT'
  } = payload;

  if (!vendorId) {
    const error = new Error('Vendor is required');
    error.statusCode = 400;
    throw error;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const quoteNumber = await generateQuoteNumber();

    const [result] = await connection.execute(
      `INSERT INTO quotations (quote_number, base_quote_number, version, vendor_id, sales_order_id, mr_id, rfq_id, rfq_group_id, status, valid_until, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ,
      [quoteNumber, quoteNumber, 1, vendorId, salesOrderId || null, mrId || null, rfq_id || null, rfq_group_id || null, status, validUntil || null, notes || null]
    );

    const quotationId = result.insertId;

    // Update RFQ status if rfq_id is provided, but only if it's not already SENT
    if (rfq_id) {
      await connection.execute(
        'UPDATE procurement_rfqs SET status = ? WHERE id = ? AND status != ?',
        ['SENT', rfq_id, 'SENT']
      );
    }

    // Update Sales Order status and quotation_id if salesOrderId is provided
    if (salesOrderId) {
      await connection.execute(
        "UPDATE sales_orders SET status = 'QUOTATION_SENT', quotation_id = ?, updated_at = NOW() WHERE id = ?",
        [quotationId, salesOrderId]
      );
    }

    // Update Material Request status to PROCESSING if mrId is provided, but only if it's not already PROCESSING
    if (mrId) {
      await connection.execute(
        'UPDATE material_requests SET status = ? WHERE id = ? AND status != ?',
        ['PROCESSING', mrId, 'PROCESSING']
      );
    }

    let totalAmount = 0;
    let totalTaxAmount = 0;

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const designQty = parseFloat(item.design_qty) || parseFloat(item.quantity) || 0;
        const qty = parseFloat(item.quantity) || designQty || 0;
        const rate = parseFloat(item.unit_rate) || 0;
        const amount = Number((qty * rate).toFixed(2));
        const cgstPercent = 9;
        const sgstPercent = 9;
        const cgstAmount = Number(((amount * cgstPercent) / 100).toFixed(2));
        const sgstAmount = Number(((amount * sgstPercent) / 100).toFixed(2));
        const totalItemAmount = Number((amount + cgstAmount + sgstAmount).toFixed(2));
        
        totalAmount = Number((totalAmount + amount).toFixed(2));
        totalTaxAmount = Number((totalTaxAmount + cgstAmount + sgstAmount).toFixed(2));

        const correctedItemCode = await getCorrectItemCode(item, connection);

        await connection.execute(
          `INSERT INTO quotation_items (quotation_id, item_code, description, material_name, material_type, drawing_no, quantity, design_qty, planned_qty, unit, unit_rate, amount, cgst_percent, cgst_amount, sgst_percent, sgst_amount, total_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ,
          [
            quotationId,
            correctedItemCode,
            item.description || null,
            item.material_name || null,
            item.material_type || null,
            item.drawing_no || correctedItemCode,
            qty,
            designQty,
            parseFloat(item.planned_qty) || designQty || 0,
            item.uom || item.unit || 'NOS',
            rate,
            amount,
            cgstPercent,
            cgstAmount,
            sgstPercent,
            sgstAmount,
            totalItemAmount
          ]
        );
      }
    }

    const grandTotal = totalAmount + totalTaxAmount;

    await connection.execute(
      'UPDATE quotations SET total_amount = ?, tax_amount = ?, grand_total = ? WHERE id = ?',
      [totalAmount, totalTaxAmount, grandTotal, quotationId]
    );

    // If status is RECEIVED, check for single vendor auto-approval
    if (status === 'RECEIVED') {
      await handleAutoApproval(quotationId, connection);
    }

    await connection.commit();
    return { id: quotationId, quote_number: quoteNumber };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getQuotations = async (filters = {}) => {
  const { status, vendorId, latestOnly = true, baseQuoteNumber } = filters;
  
  let query = `
    SELECT q.*, v.vendor_name, so.so_number,
           COALESCE(
             so.project_name, 
             (SELECT so2.project_name FROM sales_orders so2 JOIN production_plans pp ON so2.id = pp.sales_order_id WHERE pp.id = mr.plan_id),
             (SELECT so3.project_name FROM sales_orders so3 WHERE mr.notes LIKE CONCAT('%', so3.project_name, '%') LIMIT 1),
             mr.purpose, 
             'General Procurement'
           ) as project_name,
           COALESCE(
             c.company_name,
             (SELECT c2.company_name FROM companies c2 JOIN sales_orders so2 ON c2.id = so2.company_id JOIN production_plans pp ON so2.id = pp.sales_order_id WHERE pp.id = mr.plan_id),
             'Internal'
           ) as company_name,
           mr.mr_number, r.rfq_number
    FROM quotations q
    LEFT JOIN vendors v ON v.id = q.vendor_id
    LEFT JOIN sales_orders so ON so.id = q.sales_order_id
    LEFT JOIN companies c ON c.id = so.company_id
    LEFT JOIN material_requests mr ON mr.id = q.mr_id
    LEFT JOIN procurement_rfqs r ON r.id = q.rfq_id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ' AND q.status = ?';
    params.push(status);
  } else if (latestOnly) {
    query += " AND q.status != 'SUPERSEDED'";
  }

  if (vendorId) {
    query += ' AND q.vendor_id = ?';
    params.push(vendorId);
  }

  if (baseQuoteNumber) {
    query += ' AND q.base_quote_number = ?';
    params.push(baseQuoteNumber);
  }

  query += ' ORDER BY q.created_at DESC';

  const [quotations] = await pool.query(query, params);

  if (quotations.length === 0) return [];

  const quotationIds = quotations.map(q => q.id);
  const [items] = await pool.query('SELECT * FROM quotation_items WHERE quotation_id IN (?)', [quotationIds]);

  return quotations.map(q => ({
    ...q,
    items: items.filter(i => i.quotation_id === q.id)
  }));
};

const getQuotationById = async (quotationId) => {
  const [rows] = await pool.query(
    `SELECT q.*, mr.mr_number, so.so_number,
            COALESCE(
              so.project_name, 
              (SELECT so2.project_name FROM sales_orders so2 JOIN production_plans pp ON so2.id = pp.sales_order_id WHERE pp.id = mr.plan_id),
              (SELECT so3.project_name FROM sales_orders so3 WHERE mr.notes LIKE CONCAT('%', so3.project_name, '%') LIMIT 1),
              mr.purpose, 
              'General Procurement'
            ) as project_name, 
            COALESCE(
              c.company_name,
              (SELECT c2.company_name FROM companies c2 JOIN sales_orders so2 ON c2.id = so2.company_id JOIN production_plans pp ON so2.id = pp.sales_order_id WHERE pp.id = mr.plan_id),
              'Internal'
            ) as company_name,
            r.rfq_number
     FROM quotations q 
     LEFT JOIN material_requests mr ON mr.id = q.mr_id
     LEFT JOIN sales_orders so ON so.id = q.sales_order_id
     LEFT JOIN companies c ON c.id = so.company_id
     LEFT JOIN procurement_rfqs r ON r.id = q.rfq_id
     WHERE q.id = ?`,
    [quotationId]
  );

  if (!rows.length) {
    const error = new Error('Quotation not found');
    error.statusCode = 404;
    throw error;
  }

  const [items] = await pool.query(
    'SELECT * FROM quotation_items WHERE quotation_id = ?',
    [quotationId]
  );

  return { ...rows[0], items };
};

const handleAutoApproval = async (quotationId, connection) => {
  const [q] = await connection.query(
    'SELECT rfq_group_id, rfq_id, sales_order_id, mr_id, base_quote_number FROM quotations WHERE id = ?',
    [quotationId]
  );

  if (q.length > 0) {
    const { rfq_group_id, rfq_id, sales_order_id, mr_id, base_quote_number } = q[0];
    let whereClause = '';
    let params = [];
    
    if (rfq_group_id) {
      whereClause = 'rfq_group_id = ?';
      params = [rfq_group_id];
    } else if (rfq_id) {
      whereClause = 'rfq_id = ?';
      params = [rfq_id];
    } else {
      whereClause = 'sales_order_id <=> ? AND mr_id <=> ?';
      params = [sales_order_id, mr_id];
    }

    const [countRows] = await connection.query(
      `SELECT COUNT(DISTINCT vendor_id) as count FROM quotations WHERE ${whereClause} AND status != 'SUPERSEDED'`,
      params
    );

    if (countRows[0].count === 1) {
      console.log(`[AutoApprove] Single vendor detected for quotation ${quotationId}. Setting status to REVIEWED.`);
      
      await connection.execute(
        'UPDATE quotations SET status = ? WHERE id = ?',
        ['REVIEWED', quotationId]
      );

      // Check if PO already exists for this quotation or its base versions to avoid duplicates
      const [existingPO] = await connection.query(
        `SELECT po.id FROM purchase_orders po
         JOIN quotations q ON po.quotation_id = q.id
         WHERE q.id = ? OR q.base_quote_number = ?`,
        [quotationId, base_quote_number]
      );

      if (existingPO.length === 0) {
        await purchaseOrderService.createPurchaseOrder({
          quotationId: quotationId
        }, connection);
      } else {
        // If PO exists, we might want to update it with the new quotation_id to link it to the latest version
        await connection.execute(
          'UPDATE purchase_orders SET quotation_id = ? WHERE id = ?',
          [quotationId, existingPO[0].id]
        );
      }
      return true;
    }
  }
  return false;
};

const updateQuotationStatus = async (quotationId, status) => {
  const validStatuses = ['DRAFT', 'SENT', 'EMAIL_RECEIVED', 'RECEIVED', 'REVIEWED', 'CLOSED', 'PENDING'];
  if (!validStatuses.includes(status)) {
    const error = new Error('Invalid status');
    error.statusCode = 400;
    throw error;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      'UPDATE quotations SET status = ? WHERE id = ?',
      [status, quotationId]
    );

    // If status is RECEIVED, check for auto-approval
    if (status === 'RECEIVED') {
      await handleAutoApproval(quotationId, connection);
    } else if (status === 'REVIEWED') {
      // Manual approval - create PO if not exists
      // Check if PO already exists for this quotation or its base versions to avoid duplicates
      const [qInfo] = await connection.query('SELECT base_quote_number FROM quotations WHERE id = ?', [quotationId]);
      const baseQuoteNumber = qInfo[0]?.base_quote_number;

      const [existingPO] = await connection.query(
        `SELECT po.id FROM purchase_orders po
         JOIN quotations q ON po.quotation_id = q.id
         WHERE q.id = ? OR q.base_quote_number = ?`,
        [quotationId, baseQuoteNumber]
      );

      if (existingPO.length === 0) {
        await purchaseOrderService.createPurchaseOrder({
          quotationId: quotationId
        }, connection);
      } else {
        // Link existing PO to new quotation version
        await connection.execute(
          'UPDATE purchase_orders SET quotation_id = ? WHERE id = ?',
          [quotationId, existingPO[0].id]
        );
      }
    }

    await connection.commit();
    
    // Get final status (might have changed to REVIEWED via auto-approval)
    const [finalRow] = await connection.query('SELECT status FROM quotations WHERE id = ?', [quotationId]);
    return finalRow[0].status;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateQuotation = async (quotationId, payload) => {
  const { validUntil, notes, items, received_pdf_path, status } = payload;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Get the current quotation to find base_quote_number and current version
    const [current] = await connection.query(
      'SELECT * FROM quotations WHERE id = ?',
      [quotationId]
    );

    if (current.length === 0) {
      throw new Error('Quotation not found');
    }

    const oldQuote = current[0];
    const newVersion = (oldQuote.version || 1) + 1;
    const baseQuoteNumber = oldQuote.base_quote_number || oldQuote.quote_number;
    
    // New quote number reflects version
    const newQuoteNumber = `${baseQuoteNumber}-V${newVersion}`;

    // 2. Insert new version of quotation
    const [result] = await connection.execute(
      `INSERT INTO quotations (
        quote_number, base_quote_number, version, vendor_id, sales_order_id, 
        mr_id, rfq_id, rfq_group_id, status, valid_until, notes, received_pdf_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newQuoteNumber,
        baseQuoteNumber,
        newVersion,
        oldQuote.vendor_id,
        oldQuote.sales_order_id,
        oldQuote.mr_id,
        oldQuote.rfq_id,
        oldQuote.rfq_group_id,
        status || 'RECEIVED',
        validUntil !== undefined ? validUntil : oldQuote.valid_until,
        notes !== undefined ? notes : oldQuote.notes,
        received_pdf_path !== undefined ? received_pdf_path : oldQuote.received_pdf_path
      ]
    );

    const newQuotationId = result.insertId;

    // 3. Handle items
    let finalItems = items;
    if (!finalItems) {
      // If items not provided in payload, copy from old version
      const [oldItems] = await connection.query(
        'SELECT * FROM quotation_items WHERE quotation_id = ?',
        [quotationId]
      );
      finalItems = oldItems;
    }

    let totalAmount = 0;
    let totalTaxAmount = 0;

    if (Array.isArray(finalItems) && finalItems.length > 0) {
      for (const item of finalItems) {
        const designQty = parseFloat(item.design_qty) || parseFloat(item.quantity) || 0;
        const qty = parseFloat(item.quantity) || designQty || 0;
        const rate = parseFloat(item.unit_rate) || 0;
        const amount = Number((qty * rate).toFixed(2));
        const cgstPercent = parseFloat(item.cgst_percent) || 9;
        const sgstPercent = parseFloat(item.sgst_percent) || 9;
        const cgstAmount = Number(((amount * cgstPercent) / 100).toFixed(2));
        const sgstAmount = Number(((amount * sgstPercent) / 100).toFixed(2));
        const totalItemAmount = Number((amount + cgstAmount + sgstAmount).toFixed(2));
        
        totalAmount = Number((totalAmount + amount).toFixed(2));
        totalTaxAmount = Number((totalTaxAmount + cgstAmount + sgstAmount).toFixed(2));

        const correctedItemCode = await getCorrectItemCode(item, connection);

        await connection.execute(
          `INSERT INTO quotation_items (
            quotation_id, item_code, description, material_name, material_type, 
            drawing_no, quantity, design_qty, planned_qty, unit, unit_rate, 
            amount, cgst_percent, cgst_amount, sgst_percent, sgst_amount, total_amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newQuotationId,
            correctedItemCode,
            item.description || null,
            item.material_name || null,
            item.material_type || null,
            item.drawing_no || correctedItemCode,
            qty,
            designQty,
            parseFloat(item.planned_qty) || designQty || 0,
            item.uom || item.unit || 'NOS',
            rate,
            amount,
            cgstPercent,
            cgstAmount,
            sgstPercent,
            sgstAmount,
            totalItemAmount
          ]
        );
      }
    }

    const grandTotal = totalAmount + totalTaxAmount;

    await connection.execute(
      'UPDATE quotations SET total_amount = ?, tax_amount = ?, grand_total = ? WHERE id = ?',
      [totalAmount, totalTaxAmount, grandTotal, newQuotationId]
    );

    // Optional: Mark old version as superseded if it was the previous latest
    await connection.execute(
      "UPDATE quotations SET status = 'SUPERSEDED' WHERE id = ? AND status != 'SUPERSEDED'",
      [quotationId]
    );

    // If the new version is RECEIVED, check for single vendor auto-approval
    const currentStatus = status || 'RECEIVED';
    if (currentStatus === 'RECEIVED') {
      await handleAutoApproval(newQuotationId, connection);
    }

    await connection.commit();
    return { id: newQuotationId, quote_number: newQuoteNumber, version: newVersion };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const deleteQuotation = async (quotationId) => {
  try {
    await getQuotationById(quotationId);
  } catch (error) {
    if (error.statusCode === 404) {
      return; // Already deleted, consider success
    }
    throw error;
  }

  // Check if any purchase orders reference this quotation
  const [poRefs] = await pool.query('SELECT po_number FROM purchase_orders WHERE quotation_id = ?', [quotationId]);
  if (poRefs.length > 0) {
    const poNumbers = poRefs.map(p => p.po_number).join(', ');
    const error = new Error(`Cannot delete quotation because it is referenced by Purchase Order(s): ${poNumbers}. Please delete the PO(s) first.`);
    error.statusCode = 400;
    throw error;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Delete related items first
    await connection.execute('DELETE FROM quotation_items WHERE quotation_id = ?', [quotationId]);
    
    // Delete the quotation
    await connection.execute('DELETE FROM quotations WHERE id = ?', [quotationId]);

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getQuotationStats = async () => {
  const [stats] = await pool.query(`
    SELECT 
      COUNT(*) as total_quotations,
      SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as sent_quotations,
      SUM(CASE WHEN status = 'EMAIL_RECEIVED' THEN 1 ELSE 0 END) as email_received_quotations,
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_quotations,
      SUM(CASE WHEN status = 'REVIEWED' THEN 1 ELSE 0 END) as approved_quotations,
      SUM(CASE WHEN status = 'RECEIVED' THEN 1 ELSE 0 END) as received_quotations,
      SUM(total_amount) as total_value
    FROM quotations
  `);

  return stats[0] || {
    total_quotations: 0,
    sent_quotations: 0,
    pending_quotations: 0,
    approved_quotations: 0,
    received_quotations: 0,
    total_value: 0
  };
};

const sendQuotationEmail = async (quotationId, emailData) => {
  const { to, subject, message, attachPDF } = emailData;

  const quotation = await getQuotationById(quotationId);
  const [vendorRows] = await pool.query('SELECT * FROM vendors WHERE id = ?', [quotation.vendor_id]);
  const vendor = vendorRows[0];

  if (!to || !subject || !message) {
    const error = new Error('Email recipient, subject, and message are required');
    error.statusCode = 400;
    throw error;
  }

  if (!to.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    const error = new Error('Invalid email address');
    error.statusCode = 400;
    throw error;
  }

  try {
    let attachments = [];
    if (attachPDF) {
      const pdfBuffer = await generateQuotationPDF(quotationId);
      attachments.push({
        filename: `Quotation_${quotation.quote_number}.pdf`,
        content: pdfBuffer
      });
    }

    let finalSubject = subject;
    if (!subject.includes(quotation.quote_number)) {
      finalSubject = `[${quotation.quote_number}] ${subject}`;
    }

    const emailResult = await emailService.sendEmail(to, finalSubject, message, attachments);
    
    console.log(`[sendQuotationEmail] Email sent successfully to ${to}`);
    
    await pool.execute(
      'UPDATE quotations SET status = ? WHERE id = ?',
      ['SENT', quotationId]
    );

    return {
      id: quotationId,
      sent_to: to,
      sent_at: new Date(),
      message: emailResult.message,
      messageId: emailResult.messageId
    };
  } catch (error) {
    console.error(`[sendQuotationEmail] Error: ${error.message}`);
    throw error;
  }
};

const generateQuotationPDF = async (quotationId) => {
  const adminCompanyMasterService = require('./adminCompanyMasterService');
  const activeCompany = await adminCompanyMasterService.getActiveCompany();

  const hostCompanyName = activeCompany?.company_name || 'SPTECHPIONEER PVT LTD';
  const hostCompanyAddress = activeCompany?.company_address || 'Industrial Area, Sector 5, Pune, Maharashtra - 411026';
  const hostGSTIN = activeCompany?.gstin || '';
  const invoiceFooterNotes = activeCompany?.invoice_footer_notes || '';

  const fs = require('fs');
  const path = require('path');
  let logoBase64 = null;
  if (activeCompany && activeCompany.company_logo) {
    const logoPath = path.join(__dirname, '../../', activeCompany.company_logo);
    if (fs.existsSync(logoPath)) {
      logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
    }
  }

  const quotation = await getQuotationById(quotationId);
  const [vendorRows] = await pool.query('SELECT * FROM vendors WHERE id = ?', [quotation.vendor_id]);
  const vendor = vendorRows[0];

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        body { 
          font-family: 'Inter', sans-serif; 
          color: #1e293b; 
          line-height: 1.5; 
          margin: 0;
          padding: 0;
          background-color: #fff;
        }
        
        .page {
          padding: 40px;
        }

        .header-top {
          text-align: center;
          margin-bottom: 30px;
        }

        .company-name {
          color: #1d4ed8;
          font-size: 32px;
          font-weight: 700;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .company-address {
          color: #64748b;
          font-size: 14px;
          margin: 5px 0;
        }

        .divider {
          height: 2px;
          background: linear-gradient(to right, transparent, #1d4ed8, transparent);
          margin: 20px 0;
        }

        .rfq-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          margin-bottom: 30px;
        }

        .rfq-title {
          font-size: 24px;
          font-weight: 700;
          color: #1e3a8a;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin: 0;
        }

        .dot {
          width: 8px;
          height: 8px;
          background-color: #1d4ed8;
          border-radius: 50%;
        }

        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 15px;
          margin-bottom: 30px;
        }

        .info-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .icon-box {
          width: 32px;
          height: 32px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #1d4ed8;
          flex-shrink: 0;
        }

        .info-label {
          font-size: 9px;
          font-weight: 600;
          color: #1d4ed8;
          text-transform: uppercase;
          margin-bottom: 1px;
          letter-spacing: 0.5px;
        }

        .info-value {
          font-size: 12px;
          font-weight: 700;
          color: #1e293b;
          word-break: break-all;
        }

        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 30px;
        }

        .section-card {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
        }

        .section-header {
          background: #1e40af;
          color: #fff;
          padding: 8px 15px;
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          text-transform: uppercase;
        }

        .section-content {
          padding: 15px;
          font-size: 13px;
        }

        .section-content p {
          margin: 0;
          line-height: 1.6;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
        }

        th {
          background: #eff6ff;
          color: #1e40af;
          text-align: left;
          padding: 12px 15px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          border-bottom: 2px solid #dbeafe;
        }

        td {
          padding: 10px 15px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 12px;
          color: #334155;
        }

        tr:nth-child(even) {
          background-color: #fcfcfc;
        }

        .amount-col {
          text-align: right;
          font-weight: 500;
        }

        .summary-container {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 30px;
        }

        .summary-table {
          width: 300px;
          border: 1px solid #e2e8f0;
          margin-bottom: 0;
        }

        .summary-table td {
          padding: 8px 15px;
        }

        .summary-label {
          color: #64748b;
          font-weight: 500;
        }

        .summary-value {
          text-align: right;
          font-weight: 600;
        }

        .grand-total-row {
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 14px !important;
          font-weight: 700 !important;
        }

        .notes-card {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          margin-bottom: 40px;
        }

        .notes-header {
          padding: 10px 15px;
          font-size: 11px;
          font-weight: 600;
          color: #1d4ed8;
          text-transform: uppercase;
          border-bottom: 1px solid #f1f5f9;
        }

        .notes-content {
          padding: 15px;
          font-size: 12px;
          color: #475569;
          background: #fbfbfb;
        }

        .footer {
          margin-top: auto;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          color: #94a3b8;
          font-size: 10px;
        }

        .footer-left {
          font-style: italic;
        }

        .badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          background: #f1f5f9;
          color: #64748b;
          margin-top: 5px;
        }

        @media print {
          body { margin: 0; }
          .page { padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header-top">
          {{#logoBase64}}
          <img src="{{logoBase64}}" style="max-height: 45px; margin-bottom: 10px;" />
          {{/logoBase64}}
          <h1 class="company-name">{{hostCompanyName}}</h1>
          <p class="company-address">{{hostCompanyAddress}}</p>
          {{#hostGSTIN}}
          <p class="company-address">GSTIN/UIN: {{hostGSTIN}}</p>
          {{/hostGSTIN}}
        </div>

        <div class="divider"></div>

        <div class="rfq-header">
          <div class="dot"></div>
          <h2 class="rfq-title">Request for Quotation</h2>
          <div class="dot"></div>
        </div>

        <div class="info-grid">
          <div class="info-card">
            <div class="icon-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </div>
            <div>
              <div class="info-label">RFQ No:</div>
              <div class="info-value">{{quote_number}}</div>
            </div>
          </div>
          <div class="info-card">
            <div class="icon-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            </div>
            <div>
              <div class="info-label">Date:</div>
              <div class="info-value">{{created_at}}</div>
            </div>
          </div>
          <div class="info-card">
            <div class="icon-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
            <div>
              <div class="info-label">Valid Till:</div>
              <div class="info-value">{{valid_until}}</div>
            </div>
          </div>
        </div>

        <div class="details-grid">
          <div class="section-card">
            <div class="section-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              Vendor Information
            </div>
            <div class="section-content">
              <p><strong>{{vendor_name}}</strong></p>
              <p>{{location}}</p>
              <p style="margin-top: 5px; color: #64748b;">Email: {{vendor_email}}</p>
              <p style="color: #64748b;">Phone: {{phone}}</p>
            </div>
          </div>
          <div class="section-card">
            <div class="section-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
              Project Reference
            </div>
            <div class="section-content">
              <p><strong>{{project_ref}}</strong></p>
              {{#project_name}}
              <p style="margin-top: 5px; color: #64748b; font-size: 11px;">Project: {{project_name}}</p>
              {{/project_name}}
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 5%">#</th>
              <th style="width: 20%">Drawing No</th>
              <th style="width: 30%">Material Name</th>
              <th style="width: 15%">Type</th>
              <th style="width: 15%">Design Qty</th>
              <th style="width: 15%" class="amount-col">Rate (₹)</th>
              <th style="width: 15%" class="amount-col">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {{#items}}
            <tr>
              <td>{{sr}}</td>
              <td style="font-family: monospace; font-weight: 500;">{{drawing_no}}</td>
              <td>
                {{material_name}}
                {{#material_description}}<br><span style="font-size: 10px; color: #64748b;">{{material_description}}</span>{{/material_description}}
              </td>
              <td><span class="badge">{{material_type}}</span></td>
              <td><strong>{{quantity}}</strong> {{unit}}</td>
              <td class="amount-col">{{unit_rate}}</td>
              <td class="amount-col">{{amount}}</td>
            </tr>
            {{/items}}
          </tbody>
        </table>

        <div class="summary-container">
          <table class="summary-table">
            <tr>
              <td class="summary-label">Subtotal:</td>
              <td class="summary-value">₹{{total_amount}}</td>
            </tr>
            <tr>
              <td class="summary-label">CGST (9%):</td>
              <td class="summary-value">₹{{cgst_total}}</td>
            </tr>
            <tr>
              <td class="summary-label">SGST (9%):</td>
              <td class="summary-value">₹{{sgst_total}}</td>
            </tr>
            <tr class="grand-total-row">
              <td style="border-bottom: none;">Grand Total:</td>
              <td class="summary-value" style="border-bottom: none;">₹{{grand_total}}</td>
            </tr>
          </table>
        </div>

        {{#notes}}
        <div class="notes-card">
          <div class="notes-header">Special Instructions & Notes</div>
          <div class="notes-content">{{notes}}</div>
        </div>
        {{/notes}}

        {{#invoiceFooterNotes}}
        <div class="notes-card" style="margin-top: 20px;">
          <div class="notes-header">Declaration & Terms</div>
          <div class="notes-content">{{invoiceFooterNotes}}</div>
        </div>
        {{/invoiceFooterNotes}}

        <div class="footer">
          <div class="footer-left">This is a computer-generated document. No signature is required.</div>
          <div class="footer-right">{{hostCompanyName}} | Confidential</div>
        </div>
      </div>
    </body>
    </html>
  `;

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const viewData = {
    ...quotation,
    isRFQ: ['DRAFT', 'SENT', 'EMAIL_RECEIVED', 'PENDING'].includes(quotation.status),
    created_at: formatDate(quotation.created_at),
    valid_until: formatDate(quotation.valid_until),
    vendor_name: vendor?.vendor_name || 'N/A',
    vendor_email: vendor?.email || 'N/A',
    location: vendor?.location || 'N/A',
    phone: vendor?.phone || 'N/A',
    project_name: quotation.project_name,
    project_ref: quotation.mr_id ? `MR: ${quotation.mr_number}` : (quotation.sales_order_id ? `SO: ${quotation.so_number || quotation.sales_order_id}` : 'General Requirement'),
    total_amount: parseFloat(quotation.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    cgst_total: (parseFloat(quotation.tax_amount || 0) / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    sgst_total: (parseFloat(quotation.tax_amount || 0) / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    grand_total: parseFloat(quotation.grand_total || quotation.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    items: (quotation.items || []).map((i, idx) => {
      const qty = parseFloat(i.quantity || 0);
      const rate = parseFloat(i.unit_rate || 0);
      const amt = parseFloat(i.amount || qty * rate);
      
      return {
        ...i,
        sr: idx + 1,
        drawing_no: i.drawing_no || i.item_code || '—',
        material_name: i.material_name || i.description || '—',
        material_description: i.material_name ? i.description : null,
        material_type: i.material_type || '—',
        quantity: qty.toFixed(3),
        unit: i.unit || 'NOS',
        unit_rate: rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        amount: amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      };
    }),
    hostCompanyName,
    hostCompanyAddress,
    hostGSTIN,
    invoiceFooterNotes,
    logoBase64
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

const parseVendorQuotationPDF = async (filePath) => {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error('PDF file not found');
  }

  const dataBuffer = fs.readFileSync(absolutePath);
  
  // Use mehmet-kozan/pdf-parse (v2.4.5) style
  let pdf;
  try {
    pdf = new PDFParseClass(new Uint8Array(dataBuffer));
    await pdf.load();
  } catch (e) {
    console.error('[PDF Parse] Error loading PDF:', e.message);
    throw new Error('Could not load PDF structure: ' + e.message);
  }
  
  let text = '';
  try {
    const result = await pdf.getText();
    text = typeof result === 'string' ? result : (result?.text || '');
  } catch (e) {
    console.error('[PDF Parse] Error getting text:', e.message);
    throw new Error('Could not extract text from PDF: ' + e.message);
  }
  
  console.log('[PDF Parse] Extracted text length:', text.length);
  
  const items = [];
  const lines = text.split('\n');

  let tableStarted = false;
  let hasDrawingNoColumn = true;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Detect table start and column structure
    if (line.includes('Drawing No') || line.includes('Material Name') || (line.includes('Qty') && line.includes('Rate')) || line.includes('Material')) {
      tableStarted = true;
      if (line.includes('Material') && !line.includes('Drawing No')) {
        hasDrawingNoColumn = false;
      }
      continue;
    }

    if (tableStarted) {
      if (line.toLowerCase().includes('total value') || line.toLowerCase().includes('total amount') || line.toLowerCase().includes('subtotal')) {
        break;
      }

      // More robust numeric extraction: find all parts that look like numbers
      const numericParts = [];
      const parts = line.split(/\s+/);
      
      for (let i = parts.length - 1; i >= 0; i--) {
        const rawVal = parts[i].replace(/[^\d.,]/g, '');
        if (rawVal && !isNaN(parseFloat(rawVal.replace(/,/g, '')))) {
          numericParts.push({ val: rawVal.replace(/,/g, ''), index: i });
        }
        if (numericParts.length >= 3) break; // Qty, Rate, Amount
      }

      if (numericParts.length >= 2) {
        // Amount is usually the last one, Rate is second to last
        const amount = parseFloat(numericParts[0].val);
        const rate = parseFloat(numericParts[1].val);
        
        let qty = 0;
        let unit = '';
        
        if (numericParts.length >= 3) {
          qty = parseFloat(numericParts[2].val);
          const qtyIdx = numericParts[2].index;
          const rateIdx = numericParts[1].index;
          // Unit is usually between qty and rate
          if (rateIdx > qtyIdx + 1) {
            unit = parts.slice(qtyIdx + 1, rateIdx).join(' ');
          }
        }

        const firstNumericIdx = numericParts[numericParts.length - 1].index;
        let drawingNo = '—';
        let materialName = '';

        if (hasDrawingNoColumn && firstNumericIdx > 1) {
          drawingNo = parts[0];
          materialName = parts.slice(1, firstNumericIdx).join(' ');
        } else {
          materialName = parts.slice(0, firstNumericIdx).join(' ');
        }
        
        if (materialName) {
          items.push({
            drawing_no: drawingNo,
            material_name: materialName,
            quantity: qty,
            unit: unit,
            unit_rate: rate,
            amount: amount
          });
        }
        continue;
      }
    }
  }

  console.log(`[PDF Parse] Found ${items.length} items`);
  return items;
};

module.exports = {
  createQuotation,
  getQuotations,
  getQuotationById,
  updateQuotationStatus,
  updateQuotation,
  deleteQuotation,
  getQuotationStats,
  sendQuotationEmail,
  generateQuotationPDF,
  parseVendorQuotationPDF
};
