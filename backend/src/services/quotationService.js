const pool = require('../config/db');
const emailService = require('./emailService');
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

const createQuotation = async (payload) => {
  const {
    vendorId,
    salesOrderId,
    mrId,
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
      `INSERT INTO quotations (quote_number, vendor_id, sales_order_id, mr_id, status, valid_until, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
      ,
      [quoteNumber, vendorId, salesOrderId || null, mrId || null, status, validUntil || null, notes || null]
    );

    const quotationId = result.insertId;
    let totalAmount = 0;

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const amount = (item.quantity || 0) * (item.unit_rate || 0);
        totalAmount += amount;

        await connection.execute(
          `INSERT INTO quotation_items (quotation_id, item_code, description, material_name, material_type, drawing_no, quantity, unit, unit_rate, amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ,
          [
            quotationId,
            item.item_code || null,
            item.description || null,
            item.material_name || null,
            item.material_type || null,
            item.drawing_no || null,
            item.quantity || 0,
            item.uom || item.unit || 'NOS',
            item.unit_rate || 0,
            amount
          ]
        );
      }
    }

    await connection.execute(
      'UPDATE quotations SET total_amount = ? WHERE id = ?',
      [totalAmount, quotationId]
    );

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
  let query = `
    SELECT q.*, so.project_name, mr.mr_number 
    FROM quotations q
    LEFT JOIN sales_orders so ON so.id = q.sales_order_id
    LEFT JOIN material_requests mr ON mr.id = q.mr_id
    WHERE 1=1
  `;
  const params = [];

  if (filters.status) {
    query += ' AND q.status = ?';
    params.push(filters.status);
  }

  if (filters.vendorId) {
    query += ' AND q.vendor_id = ?';
    params.push(filters.vendorId);
  }

  query += ' ORDER BY q.created_at DESC';

  const [quotations] = await pool.query(query, params);

  const [items] = await pool.query('SELECT * FROM quotation_items');

  return quotations.map(q => ({
    ...q,
    items: items.filter(i => i.quotation_id === q.id)
  }));
};

const getQuotationById = async (quotationId) => {
  const [rows] = await pool.query(
    `SELECT q.*, mr.mr_number, so.project_name 
     FROM quotations q 
     LEFT JOIN material_requests mr ON mr.id = q.mr_id
     LEFT JOIN sales_orders so ON so.id = q.sales_order_id
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

const updateQuotationStatus = async (quotationId, status) => {
  const validStatuses = ['DRAFT', 'SENT', 'EMAIL_RECEIVED', 'RECEIVED', 'REVIEWED', 'CLOSED', 'PENDING'];
  if (!validStatuses.includes(status)) {
    const error = new Error('Invalid status');
    error.statusCode = 400;
    throw error;
  }

  await getQuotationById(quotationId);

  await pool.execute(
    'UPDATE quotations SET status = ? WHERE id = ?',
    [status, quotationId]
  );

  return status;
};

const updateQuotation = async (quotationId, payload) => {
  const { validUntil, notes, items, received_pdf_path } = payload;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const updateFields = [];
    const updateParams = [];

    if (validUntil !== undefined) {
      updateFields.push('valid_until = ?');
      updateParams.push(validUntil);
    }

    if (notes !== undefined) {
      updateFields.push('notes = ?');
      updateParams.push(notes);
    }

    if (received_pdf_path !== undefined) {
      updateFields.push('received_pdf_path = ?');
      updateParams.push(received_pdf_path);
    }

    if (updateFields.length > 0) {
      updateParams.push(quotationId);
      await connection.execute(
        `UPDATE quotations SET ${updateFields.join(', ')} WHERE id = ?`,
        updateParams
      );
    }

    if (Array.isArray(items) && items.length > 0) {
      await connection.execute('DELETE FROM quotation_items WHERE quotation_id = ?', [quotationId]);

      let totalAmount = 0;

      for (const item of items) {
        const amount = (item.quantity || 0) * (item.unit_rate || 0);
        totalAmount += amount;

        await connection.execute(
          `INSERT INTO quotation_items (quotation_id, item_code, description, material_name, material_type, drawing_no, quantity, unit, unit_rate, amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ,
          [
            quotationId,
            item.item_code || null,
            item.description || null,
            item.material_name || null,
            item.material_type || null,
            item.drawing_no || null,
            item.quantity || 0,
            item.uom || item.unit || 'NOS',
            item.unit_rate || 0,
            amount
          ]
        );
      }

      await connection.execute(
        'UPDATE quotations SET total_amount = ? WHERE id = ?',
        [totalAmount, quotationId]
      );
    }

    await connection.commit();
    return { id: quotationId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const deleteQuotation = async (quotationId) => {
  await getQuotationById(quotationId);

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
  const quotation = await getQuotationById(quotationId);
  const [vendorRows] = await pool.query('SELECT * FROM vendors WHERE id = ?', [quotation.vendor_id]);
  const vendor = vendorRows[0];

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Helvetica', 'Arial', sans-serif; color: #333; line-height: 1.6; margin: 40px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
        .company-info h1 { color: #2563eb; margin: 0; font-size: 24px; }
        .quote-title { text-align: right; }
        .quote-title h2 { margin: 0; color: #64748b; font-size: 18px; text-transform: ; }
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
        .section-label { font-weight: bold; color: #64748b; font-size: 12px; text-transform: ; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background: #f8fafc; color: #64748b; text-align: left; padding: 12px 8px; font-size: 11px; text-transform: ; border-bottom: 1px solid #e2e8f0; }
        td { padding: 12px 8px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
        .notes-section { background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #cbd5e1; }
        .footer { margin-top: 50px; text-align: center; color: #94a3b8; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
        .total-row { font-weight: bold; background: #eff6ff; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-info">
          <h1>SPTECHPIONEER PVT LTD</h1>
          <p>Industrial Area, Sector 5<br>Pune, Maharashtra - 411026</p>
        </div>
        <div class="quote-title">
          <h2>Request for Quotation</h2>
          <p><strong>RFQ No:</strong> {{quote_number}}<br>
          <strong>Date:</strong> {{created_at}}<br>
          <strong>Valid Till:</strong> {{valid_until}}</p>
        </div>
      </div>

      <div class="details-grid">
        <div>
          <div class="section-label">Vendor Information</div>
          <p><strong>{{vendor_name}}</strong><br>
          {{location}}<br>
          Email: {{vendor_email}}<br>
          Phone: {{phone}}</p>
        </div>
        <div style="text-align: right;">
          <div class="section-label">Project Reference</div>
          <p>{{project_ref}}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 20%">Drawing No</th>
            <th style="width: 25%">Material Name</th>
            <th style="width: 15%">Type</th>
            <th style="width: 10%">Design Qty</th>
            <th style="width: 15%">Rate (₹)</th>
            <th style="width: 15%">Amount</th>
          </tr>
        </thead>
        <tbody>
          {{#items}}
          <tr>
            <td>{{drawing_no}}</td>
            <td>{{material_name}}</td>
            <td>{{material_type}}</td>
            <td>{{quantity}} {{unit}}</td>
            <td>{{unit_rate}}</td>
            <td>{{amount}}</td>
          </tr>
          {{/items}}
        </tbody>
        <tfoot style="background: #f8fafc; font-weight: bold;">
          <tr>
            <td colspan="5" style="text-align: right; padding: 12px 8px;">Total Value:</td>
            <td style="padding: 12px 8px;">₹{{total_amount}}</td>
          </tr>
        </tfoot>
      </table>

      {{#notes}}
      <div class="notes-section">
        <div class="section-label">Special Instructions & Notes</div>
        <p>{{notes}}</p>
      </div>
      {{/notes}}

      <div class="footer">
        <p>This is a computer-generated document. No signature is required.<br>
        SPTECHPIONEER PVT LTD | Confidential | Page 1 of 1</p>
      </div>
    </body>
    </html>
  `;

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const viewData = {
    ...quotation,
    created_at: formatDate(quotation.created_at),
    valid_until: formatDate(quotation.valid_until),
    vendor_name: vendor?.vendor_name || 'N/A',
    vendor_email: vendor?.email || 'N/A',
    location: vendor?.location || 'N/A',
    phone: vendor?.phone || 'N/A',
    project_ref: quotation.mr_id ? `MR: ${quotation.mr_number}` : (quotation.sales_order_id ? `SO: ${quotation.project_name || quotation.sales_order_id}` : 'General Requirement'),
    total_amount: parseFloat(quotation.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    items: (quotation.items || []).map(i => {
      const qty = parseFloat(i.quantity || 0);
      const rate = parseFloat(i.unit_rate || 0);
      const amt = parseFloat(i.amount || qty * rate);
      
      return {
        ...i,
        drawing_no: i.drawing_no || i.item_code || '—',
        material_name: i.material_name || i.description || '—',
        material_type: i.material_type || '—',
        quantity: qty.toFixed(3),
        unit: i.unit || 'NOS',
        unit_rate: rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        amount: amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      };
    })
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
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Detect table start
    if (line.includes('Drawing No') || line.includes('Material Name') || (line.includes('Qty') && line.includes('Rate'))) {
      tableStarted = true;
      continue;
    }

    if (tableStarted) {
      if (line.toLowerCase().includes('total value') || line.toLowerCase().includes('total amount')) {
        break;
      }

      // More robust numeric extraction: find all parts that look like numbers
      const numericParts = [];
      const parts = line.split(/\s+/);
      
      for (let i = parts.length - 1; i >= 0; i--) {
        const val = parts[i].replace(/[^\d.,]/g, '');
        if (val && !isNaN(parseFloat(val.replace(/,/g, '')))) {
          numericParts.push({ val: val.replace(/,/g, ''), index: i });
        }
        if (numericParts.length >= 3) break; // Qty, Rate, Amount
      }

      if (numericParts.length >= 2) {
        // Amount is usually the last one, Rate is second to last
        const amount = parseFloat(numericParts[0].val);
        const rate = parseFloat(numericParts[1].val);
        
        // Try to find quantity - it should be the one before rate or the 3rd numeric part
        let qty = 0;
        let unit = '';
        
        if (numericParts.length >= 3) {
          qty = parseFloat(numericParts[2].val);
          // Unit is usually between qty and rate
          const qtyIdx = numericParts[2].index;
          const rateIdx = numericParts[1].index;
          if (rateIdx > qtyIdx + 1) {
            unit = parts[qtyIdx + 1];
          }
        }

        // The rest (everything before the first numeric part) is DrawingNo and MaterialName
        const firstNumericIdx = numericParts[numericParts.length - 1].index;
        const drawingNo = parts[0];
        const materialName = parts.slice(1, firstNumericIdx).join(' ');
        
        items.push({
          drawing_no: drawingNo,
          material_name: materialName,
          quantity: qty,
          unit: unit,
          unit_rate: rate,
          amount: amount
        });
        continue;
      }

      // Fallback to original regex
      const match = line.match(/^(\S+)\s+(.+?)\s+([\d.]+)\s+(\w+)\s+([\d,.]+)\s+([\d,.]+)$/);
      if (match) {
        items.push({
          drawing_no: match[1],
          material_name: match[2],
          quantity: parseFloat(match[3]),
          unit: match[4],
          unit_rate: parseFloat(match[5].replace(/,/g, '')),
          amount: parseFloat(match[6].replace(/,/g, ''))
        });
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
