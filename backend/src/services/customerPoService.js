const path = require('path');
const mustache = require('mustache');
const puppeteer = require('puppeteer');
const pool = require('../config/db');
const bomService = require('./bomService');

const calculateAmounts = items => {
  let subtotal = 0;
  let taxTotal = 0;
  for (const item of items) {
    const basic = Number(item.quantity || 0) * Number(item.rate || 0);
    const cgstAmount = basic * (Number(item.cgstPercent || 0) / 100);
    const sgstAmount = basic * (Number(item.sgstPercent || 0) / 100);
    const igstAmount = basic * (Number(item.igstPercent || 0) / 100);
    subtotal += basic;
    taxTotal += cgstAmount + sgstAmount + igstAmount;
    item.basicAmount = basic;
    item.cgstAmount = cgstAmount;
    item.sgstAmount = sgstAmount;
    item.igstAmount = igstAmount;
  }
  return { subtotal, taxTotal, netTotal: subtotal + taxTotal };
};

const numberToWords = (num) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const convert = (n) => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : '');
    return '';
  };

  const formatWords = (n) => {
    if (n === 0) return 'Zero';
    let words = '';
    if (n >= 10000000) {
      words += convert(Math.floor(n / 10000000)) + ' Crore ';
      n %= 10000000;
    }
    if (n >= 100000) {
      words += convert(Math.floor(n / 100000)) + ' Lakh ';
      n %= 100000;
    }
    if (n >= 1000) {
      words += convert(Math.floor(n / 1000)) + ' Thousand ';
      n %= 1000;
    }
    words += convert(n);
    return words.trim();
  };

  const amount = Math.floor(num);
  const paisa = Math.round((num - amount) * 100);
  
  let result = 'INR ' + formatWords(amount) + ' Only';
  if (paisa > 0) {
    result = 'INR ' + formatWords(amount) + ' and ' + formatWords(paisa) + ' Paisa Only';
  }
  return result;
};

const createCustomerPo = async payload => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const {
      companyId,
      projectName,
      header = {},
      items = [],
      pdfFile,
      remarks,
      termsAndConditions,
      specialNotes,
      inspectionClause,
      testCertificate,
      hostCompanyId
    } = payload;

    const totals = calculateAmounts(items);

    const [poResult] = await connection.execute(
      `INSERT INTO customer_pos
        (company_id, project_name, po_number, po_date, po_version, order_type, plant, currency, payment_terms,
         credit_days, freight_terms, packing_forwarding, insurance_terms, delivery_terms, status,
         pdf_path, subtotal, tax_total, net_total, remarks, terms_and_conditions, special_notes,
         inspection_clause, test_certificate, host_company_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ,
      [
        companyId,
        projectName || null,
        header.poNumber || null,
        header.poDate || null,
        header.poVersion || '1.0',
        header.orderType || 'STANDARD',
        header.plant || null,
        header.currency || 'INR',
        header.paymentTerms || null,
        header.creditDays ? Number(header.creditDays) : null,
        header.freightTerms || null,
        header.packingForwarding || null,
        header.insuranceTerms || null,
        header.deliveryTerms || null,
        'DRAFT',
        pdfFile ? path.relative(process.cwd(), pdfFile) : null,
        totals.subtotal,
        totals.taxTotal,
        totals.netTotal,
        remarks || null,
        termsAndConditions || null,
        specialNotes || null,
        inspectionClause || null,
        testCertificate || null,
        hostCompanyId ? Number(hostCompanyId) : null
      ]
    );

    const customerPoId = poResult.insertId;

    for (const item of items) {
      const [itemResult] = await connection.execute(
        `INSERT INTO customer_po_items
          (customer_po_id, item_code, description, hsn_code, drawing_no, revision_no, quantity,
           unit, rate, basic_amount, discount, cgst_percent, cgst_amount, sgst_percent, sgst_amount,
           igst_percent, igst_amount, delivery_date, purchase_req_no, customer_reference)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ,
        [
          customerPoId,
          item.itemCode || null,
          item.description,
          item.hsnCode || null,
          item.drawingNo || null,
          item.revisionNo || null,
          item.quantity,
          item.unit || 'NOS',
          item.rate,
          item.basicAmount,
          item.discount || 0,
          item.cgstPercent || 0,
          item.cgstAmount,
          item.sgstPercent || 0,
          item.sgstAmount,
          item.igstPercent || 0,
          item.igstAmount,
          item.deliveryDate || null,
          item.purchaseReqNo || null,
          item.customerReference || null
        ]
      );

      const poItemId = itemResult.insertId;

      if (item.sub_assemblies && Array.isArray(item.sub_assemblies)) {
        for (const sa of item.sub_assemblies) {
          await connection.execute(
            `INSERT INTO customer_po_item_subassemblies
              (po_item_id, drawing_no, description, quantity, unit, rate, hsn_code, delivery_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ,
            [
              poItemId,
              sa.drawingNo || null,
              sa.description || null,
              sa.quantity || 0,
              sa.unit || 'NOS',
              sa.rate || 0,
              sa.hsn_code || null,
              sa.delivery_date || null
            ]
          );
        }
      }
    }

    await connection.commit();

    return { customerPoId, totals };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const listCustomerPos = async (filters = {}) => {
  let query = `
    SELECT cp.*, c.company_name, 
           COALESCE(cp.project_name, (SELECT project_name FROM sales_orders WHERE customer_po_id = cp.id LIMIT 1)) as project_name,
           (SELECT SUM(quantity) FROM customer_po_items WHERE customer_po_id = cp.id) as total_qty,
           (SELECT email FROM contacts WHERE company_id = c.id ORDER BY contact_type = 'PRIMARY' DESC, id ASC LIMIT 1) as company_email
    FROM customer_pos cp
    JOIN companies c ON c.id = cp.company_id
    WHERE 1=1
  `;
  const params = [];

  if (filters.companyId) {
    query += ' AND cp.company_id = ?';
    params.push(filters.companyId);
  }

  query += ' ORDER BY cp.created_at DESC';

  const [rows] = await pool.query(query, params);
  return rows;
};

const getCustomerPoById = async id => {
  const [rows] = await pool.query(
    `SELECT cp.*, c.company_name, c.company_code, c.customer_type, c.gstin, c.cin, c.pan,
            (SELECT email FROM contacts WHERE company_id = c.id ORDER BY contact_type = 'PRIMARY' DESC, id ASC LIMIT 1) as company_email
     FROM customer_pos cp
     JOIN companies c ON c.id = cp.company_id
     WHERE cp.id = ?`,
    [id]
  );
  if (!rows.length) {
    return null;
  }
  const po = rows[0];

  const companyService = require('./companyService');
  let companyDetails = null;
  try {
    companyDetails = await companyService.getCompanyById(po.company_id);
  } catch (err) {
    console.error('Error fetching company details for PO:', err);
  }

  const billing = companyDetails?.addresses?.find(a => a.address_type === 'BILLING') || {};
  const shipping = companyDetails?.addresses?.find(a => a.address_type === 'SHIPPING') || {};
  const billingContact = companyDetails?.contacts?.find(c => c.contact_type === 'ACCOUNTS') ||
                         companyDetails?.contacts?.find(c => c.contact_type === 'PRIMARY') ||
                         companyDetails?.contacts?.[0] || {};
  const shippingContact = companyDetails?.contacts?.find(c => c.contact_type === 'PURCHASE') ||
                          companyDetails?.contacts?.find(c => c.contact_type === 'TECHNICAL') ||
                          companyDetails?.contacts?.find(c => c.contact_type === 'PRIMARY') ||
                          companyDetails?.contacts?.[0] || {};

  // Format billing address
  let billingAddrParts = [
    billing.line1,
    billing.line2,
    billing.city,
    billing.state,
    billing.pincode ? `Pincode: ${billing.pincode}` : null
  ].filter(part => part && String(part).trim() !== '' && String(part).toUpperCase() !== 'N/A');
  po.billing_address = billingAddrParts.join(', ') || 'N/A';
  po.billing_state = billing.state || 'N/A';
  po.billing_state_code = ''; // Fallback since state_code is missing in schema

  // Format shipping address
  let shippingAddrParts = [
    shipping.line1,
    shipping.line2,
    shipping.city,
    shipping.state,
    shipping.pincode ? `Pincode: ${shipping.pincode}` : null
  ].filter(part => part && String(part).trim() !== '' && String(part).toUpperCase() !== 'N/A');
  po.shipping_address = shippingAddrParts.join(', ') || po.billing_address;
  po.shipping_state = shipping.state || po.billing_state;

  // Contacts
  po.billing_contact_name = billingContact.name || '';
  po.billing_contact_phone = billingContact.phone || '';
  po.shipping_contact_name = shippingContact.name || '';
  po.shipping_contact_phone = shippingContact.phone || '';

  // GSTIN / PAN / CIN
  po.gstin = companyDetails?.gstin || po.gstin || '';
  po.pan = companyDetails?.pan || po.pan || '';
  po.cin = companyDetails?.cin || po.cin || '';

  const [items] = await pool.query(
    `SELECT id, item_code, drawing_no, description, quantity, unit, rate, basic_amount, discount, 
            cgst_percent, sgst_percent, igst_percent, cgst_amount, sgst_amount, igst_amount, hsn_code, delivery_date
     FROM customer_po_items
     WHERE customer_po_id = ?
     ORDER BY id ASC`,
    [id]
  );

  const enrichedItems = await Promise.all(items.map(async (item) => {
    // 1. Try to fetch stored sub-assemblies first (as a snapshot)
    const [storedSA] = await pool.query(
      `SELECT drawing_no as drawingNo, description, quantity, unit, rate, hsn_code, delivery_date 
       FROM customer_po_item_subassemblies 
       WHERE po_item_id = ?`,
      [item.id]
    );

    if (storedSA.length > 0) {
      return { ...item, sub_assemblies: storedSA };
    }

    // 2. Fallback to dynamic BOM fetching ONLY for legacy records that have NO stored sub-assemblies
    // and are clearly Finished Goods.
    const isFG = (item.item_code || '').startsWith('FG-') || 
                 (item.drawing_no && item.drawing_no !== '—');
    
    if (isFG && storedSA.length === 0) {
      // Check if we already have some sub-assemblies for other items in this PO. 
      // If we do, it means this is a modern record and we should NOT fallback.
      const [anyStoredSA] = await pool.query(
        'SELECT id FROM customer_po_item_subassemblies WHERE po_item_id IN (SELECT id FROM customer_po_items WHERE customer_po_id = ?)',
        [id]
      );

      if (anyStoredSA.length > 0) {
        return item; // Modern record, trust the (empty) snapshot
      }

      const sub_assemblies = await bomService.getItemComponents(null, item.item_code, item.drawing_no);
      return { 
        ...item, 
        sub_assemblies: sub_assemblies.map(sa => ({
          drawingNo: sa.drawing_no || sa.component_code,
          description: sa.description,
          quantity: sa.quantity || sa.qty,
          unit: sa.unit || sa.uom || 'Nos',
          rate: sa.rate || sa.selling_rate || 0
        }))
      };
    }
    return item;
  }));

  return { ...rows[0], items: enrichedItems };
};

const updateCustomerPo = async (id, payload) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const {
      projectName,
      header = {},
      items = [],
      remarks,
      termsAndConditions,
      specialNotes,
      inspectionClause,
      testCertificate,
      hostCompanyId
    } = payload;

    const totals = calculateAmounts(items);

    await connection.execute(
      `UPDATE customer_pos
       SET project_name = ?, po_number = ?, po_date = ?, po_version = ?, order_type = ?, plant = ?, currency = ?, 
           payment_terms = ?, credit_days = ?, freight_terms = ?, packing_forwarding = ?, 
           insurance_terms = ?, delivery_terms = ?, subtotal = ?, tax_total = ?, net_total = ?, 
           remarks = ?, terms_and_conditions = ?, special_notes = ?, inspection_clause = ?, 
           test_certificate = ?, host_company_id = ?
       WHERE id = ?`
      ,
      [
        projectName || null,
        header.poNumber || null,
        header.poDate || null,
        header.poVersion || '1.0',
        header.orderType || 'STANDARD',
        header.plant || null,
        header.currency || 'INR',
        header.paymentTerms || null,
        header.creditDays ? Number(header.creditDays) : null,
        header.freightTerms || null,
        header.packingForwarding || null,
        header.insuranceTerms || null,
        header.deliveryTerms || null,
        totals.subtotal,
        totals.taxTotal,
        totals.netTotal,
        remarks || null,
        termsAndConditions || null,
        specialNotes || null,
        inspectionClause || null,
        testCertificate || null,
        hostCompanyId ? Number(hostCompanyId) : null,
        id
      ]
    );

    // Delete existing items and re-insert
    await connection.execute('DELETE FROM customer_po_item_subassemblies WHERE po_item_id IN (SELECT id FROM customer_po_items WHERE customer_po_id = ?)', [id]);
    await connection.execute('DELETE FROM customer_po_items WHERE customer_po_id = ?', [id]);

    for (const item of items) {
      const [itemResult] = await connection.execute(
        `INSERT INTO customer_po_items
          (customer_po_id, item_code, description, hsn_code, drawing_no, revision_no, quantity,
           unit, rate, basic_amount, discount, cgst_percent, cgst_amount, sgst_percent, sgst_amount,
           igst_percent, igst_amount, delivery_date, purchase_req_no, customer_reference)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ,
        [
          id,
          item.itemCode || null,
          item.description,
          item.hsnCode || null,
          item.drawingNo || null,
          item.revisionNo || null,
          item.quantity,
          item.unit || 'NOS',
          item.rate,
          item.basicAmount,
          item.discount || 0,
          item.cgstPercent || 0,
          item.cgstAmount,
          item.sgstPercent || 0,
          item.sgstAmount,
          item.igstPercent || 0,
          item.igstAmount,
          item.deliveryDate || null,
          item.purchaseReqNo || null,
          item.customerReference || null
        ]
      );

      const poItemId = itemResult.insertId;

      if (item.sub_assemblies && Array.isArray(item.sub_assemblies)) {
        for (const sa of item.sub_assemblies) {
          await connection.execute(
            `INSERT INTO customer_po_item_subassemblies
              (po_item_id, drawing_no, description, quantity, unit, rate, hsn_code, delivery_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ,
            [
              poItemId,
              sa.drawingNo || null,
              sa.description || null,
              sa.quantity || 0,
              sa.unit || 'NOS',
              sa.rate || 0,
              sa.hsn_code || null,
              sa.delivery_date || null
            ]
          );
        }
      }
    }

    await connection.commit();
    return { id, totals };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const deleteCustomerPo = async id => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Delete items first
    await connection.execute('DELETE FROM customer_po_items WHERE customer_po_id = ?', [id]);
    
    // Find linked sales orders
    const [soRows] = await connection.execute('SELECT id FROM sales_orders WHERE customer_po_id = ?', [id]);
    
    for (const so of soRows) {
      // Find and delete related production plans, work orders, and job cards
      const [planRows] = await connection.execute('SELECT id FROM production_plans WHERE sales_order_id = ?', [so.id]);
      for (const plan of planRows) {
        // Delete job cards linked via work orders
        await connection.execute(
          `DELETE FROM job_cards 
           WHERE work_order_id IN (SELECT id FROM work_orders WHERE plan_id = ?)`,
          [plan.id]
        );
        // Delete work orders
        await connection.execute('DELETE FROM work_orders WHERE plan_id = ?', [plan.id]);
        
        // Delete material requests linked to this plan
        await connection.execute('DELETE FROM material_request_items WHERE mr_id IN (SELECT id FROM material_requests WHERE plan_id = ?)', [plan.id]);
        await connection.execute('DELETE FROM material_requests WHERE plan_id = ?', [plan.id]);

        // Delete production plan (cascades to production_plan_items, materials, operations, etc. in many schemas)
        await connection.execute('DELETE FROM production_plans WHERE id = ?', [plan.id]);
      }

      // Find sales order items to clean up their BOM components
      const [soiRows] = await connection.execute('SELECT id FROM sales_order_items WHERE sales_order_id = ?', [so.id]);
      for (const soi of soiRows) {
        await connection.execute('DELETE FROM sales_order_item_materials WHERE sales_order_item_id = ?', [soi.id]);
        await connection.execute('DELETE FROM sales_order_item_components WHERE sales_order_item_id = ?', [soi.id]);
        await connection.execute('DELETE FROM sales_order_item_operations WHERE sales_order_item_id = ?', [soi.id]);
        await connection.execute('DELETE FROM sales_order_item_scrap WHERE sales_order_item_id = ?', [soi.id]);
      }

      // Delete linked sales order items
      await connection.execute('DELETE FROM sales_order_items WHERE sales_order_id = ?', [so.id]);
      // Delete the sales order
      await connection.execute('DELETE FROM sales_orders WHERE id = ?', [so.id]);
    }

    // Also check for direct orders in the new system linked to this PO (if any)
    const [orderRows] = await connection.execute('SELECT id FROM orders WHERE quotation_id IN (SELECT id FROM sales_orders WHERE customer_po_id = ?)', [id]);
    for (const order of orderRows) {
       // Cleanup production plans for direct orders
       const [planRows] = await connection.execute('SELECT id FROM production_plans WHERE sales_order_id = ?', [order.id]);
       for (const plan of planRows) {
         await connection.execute(`DELETE FROM job_cards WHERE work_order_id IN (SELECT id FROM work_orders WHERE plan_id = ?)`, [plan.id]);
         await connection.execute('DELETE FROM work_orders WHERE plan_id = ?', [plan.id]);
         await connection.execute('DELETE FROM material_request_items WHERE mr_id IN (SELECT id FROM material_requests WHERE plan_id = ?)', [plan.id]);
         await connection.execute('DELETE FROM material_requests WHERE plan_id = ?', [plan.id]);
         await connection.execute('DELETE FROM production_plans WHERE id = ?', [plan.id]);
       }
       // Note: order_items usually don't have separate BOM tables like sales_order_items yet, 
       // they often link back to sales_order_items for BOM.
       await connection.execute('DELETE FROM order_items WHERE order_id = ?', [order.id]);
       await connection.execute('DELETE FROM orders WHERE id = ?', [order.id]);
    }

    // Delete the PO
    const [result] = await connection.execute('DELETE FROM customer_pos WHERE id = ?', [id]);

    await connection.commit();
    return result.affectedRows > 0;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const generateCustomerPoPDF = async (poId, currentUser = null) => {
  const po = await getCustomerPoById(poId);
  if (!po) throw new Error('Customer PO not found');

  let creator = null;
  if (currentUser && currentUser.id) {
    try {
      const [userRows] = await pool.query('SELECT first_name, last_name, phone, email FROM users WHERE id = ?', [currentUser.id]);
      if (userRows.length > 0) {
        creator = userRows[0];
      }
    } catch (err) {
      console.error('Error fetching current user for PO PDF:', err);
    }
  }

  if (!creator) {
    try {
      const [userRows] = await pool.query('SELECT first_name, last_name, phone, email FROM users WHERE status = ? LIMIT 1', ['ACTIVE']);
      if (userRows.length > 0) {
        creator = userRows[0];
      }
    } catch (err) {
      console.error('Error fetching fallback user for PO PDF:', err);
    }
  }

  const adminCompanyMasterService = require('./adminCompanyMasterService');
  let activeCompany = null;

  // Try to find the host_company_id directly from the customer PO
  if (po && po.host_company_id) {
    try {
      activeCompany = await adminCompanyMasterService.getCompanyById(po.host_company_id);
    } catch (err) {
      console.error('Error fetching host company directly from customer PO:', err);
    }
  }

  // Try to find the host_company_id from a linked sales order
  if (!activeCompany) {
    try {
      const [soRow] = await pool.query('SELECT host_company_id FROM sales_orders WHERE customer_po_id = ? LIMIT 1', [poId]);
      if (soRow.length > 0 && soRow[0].host_company_id) {
        activeCompany = await adminCompanyMasterService.getCompanyById(soRow[0].host_company_id);
      }
    } catch (err) {
      console.error('Error fetching sales order host_company_id for customer PO:', err);
    }
  }

  // Fallback to active company
  if (!activeCompany) {
    try {
      activeCompany = await adminCompanyMasterService.getActiveCompany();
    } catch (err) {
      console.error('Error fetching active company:', err);
    }
  }

  const hostCompanyName = activeCompany?.company_name || 'SP TECHPIONEER PRIVATE LIMITED';
  const hostCompanyAddress = activeCompany?.company_address || 'Plot No. 97, Sector 7, PCNTDA,\nBhosari, Pune - 411026, Maharashtra, India';
  const hostCompanyAddressHtml = hostCompanyAddress ? hostCompanyAddress.replace(/\n/g, '<br/>') : 'Plot No. 97, Sector 7, PCNTDA,<br/>Bhosari, Pune - 411026, Maharashtra, India';
  const hostGSTIN = activeCompany?.gstin || '27AAPCS1193L1ZQ';
  const hostCIN = activeCompany?.cin || 'U29309PN2021PTC201234';
  const hostPAN = activeCompany?.pan || 'N/A';

  const fs = require('fs');
  const path = require('path');
  let logoBase64 = null;
  let signatureBase64 = null;

  if (activeCompany && activeCompany.company_logo) {
    const logoPath = path.join(__dirname, '../../', activeCompany.company_logo);
    if (fs.existsSync(logoPath)) {
      logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
    }
  }
  if (activeCompany && activeCompany.authorized_signature) {
    const signaturePath = path.join(__dirname, '../../', activeCompany.authorized_signature);
    if (fs.existsSync(signaturePath)) {
      signatureBase64 = `data:image/png;base64,${fs.readFileSync(signaturePath).toString('base64')}`;
    }
  }

  const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Purchase Order - {{hostCompanyName}}</title>
<style>
  @page {
    size: A4 landscape;
    margin: 8mm;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: Arial, Helvetica, sans-serif;
  }

  body {
    background: #fff;
    -webkit-print-color-adjust: exact;
  }

  .po-container {
    width: 100%;
    border: 1.5px solid #000;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
  }

  .header-table {
    width: 100%;
    border-collapse: collapse;
    border-bottom: 1.5px solid #000;
  }
  
  .header-table td {
    vertical-align: top;
    padding: 6px;
  }

  .logo-box {
    width: 60px;
    height: 70px;
    border: 1px solid #000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f4dca3;
    font-weight: bold;
    flex-direction: column;
    overflow: hidden;
    margin-right: 12px;
  }

  .company-title {
    font-size: 11px;
    font-weight: bold;
    margin-bottom: 4px;
    color: #000;
    text-transform: uppercase;
  }

  .company-address {
    font-size: 7.5px;
    line-height: 1.3;
    color: #333;
    margin-bottom: 4px;
  }

  .company-meta {
    font-size: 7.5px;
    margin-bottom: 1px;
    color: #000;
  }

  .created-by-table {
    width: 100%;
    font-size: 7.5px;
    border-collapse: collapse;
  }

  .created-by-table td {
    padding: 1px 0;
    vertical-align: top;
  }

  .po-title-block {
    text-align: center;
    font-weight: bold;
    font-size: 11px;
    padding: 4px;
    border-bottom: 1.5px solid #000;
    letter-spacing: 0.5px;
    background: #fff;
  }

  .po-details-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 7.5px;
  }

  .po-details-table td {
    border-bottom: 0.5px solid #000;
    border-right: 0.5px solid #000;
    padding: 2.5px 4px;
    vertical-align: middle;
  }

  .po-details-table tr:last-child td {
    border-bottom: none;
  }

  .po-details-table td:last-child {
    border-right: none;
  }

  .middle-table {
    width: 100%;
    border-collapse: collapse;
    border-bottom: 1.5px solid #000;
  }

  .middle-table td {
    vertical-align: top;
    padding: 6px;
  }

  .section-title {
    font-size: 8px;
    font-weight: bold;
    color: #000;
    margin-bottom: 5px;
    border-bottom: 0.5px solid #000;
    padding-bottom: 2px;
    text-transform: uppercase;
  }

  .vendor-name {
    font-size: 8px;
    font-weight: bold;
    margin-bottom: 4px;
    color: #000;
  }

  .address-text {
    font-size: 7.5px;
    line-height: 1.3;
    color: #333;
  }

  .details-subtable {
    width: 100%;
    border-collapse: collapse;
    font-size: 7.5px;
  }

  .details-subtable td {
    padding: 1.5px 0 !important;
    border: none !important;
    vertical-align: top;
  }

  .items-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: -0.5px;
  }

  .items-table th {
    border: 0.5px solid #000;
    padding: 3.5px 4px;
    font-size: 7.5px;
    vertical-align: middle;
    background: #f2f2f2;
    font-weight: bold;
    text-align: center;
    text-transform: uppercase;
  }

  .items-table td {
    border: none;
    border-bottom: 0.5px solid #000;
    padding: 3.5px 4px;
    font-size: 7.5px;
    vertical-align: top;
  }

  .items-table tr.sub-assembly-row td {
    border-bottom: none;
  }

  .items-table tr.parent-with-subs td {
    border-bottom: none;
  }

  .items-table tr.last-sub-assembly td {
    border-bottom: 0.5px solid #000;
  }

  .summary-table {
    width: 100%;
    border-collapse: collapse;
    border-top: 1.5px solid #000;
    border-bottom: 1.5px solid #000;
    margin-top: -0.5px;
  }

  .summary-table td {
    vertical-align: top;
    padding: 6px;
  }

  .totals-subtable {
    width: 100%;
    border-collapse: collapse;
    font-size: 7.5px;
  }

  .totals-subtable td {
    padding: 2.5px 4px;
    border: none;
  }

  .totals-subtable tr.grand-total-row td {
    border-top: 1px solid #000;
    font-size: 9px;
    font-weight: bold;
  }

  .bottom-table {
    width: 100%;
    border-collapse: collapse;
  }

  .bottom-table td {
    vertical-align: top;
    padding: 6px;
  }

  .declaration-text {
    font-size: 7.5px;
    line-height: 1.3;
    color: #333;
    margin-bottom: 8px;
  }

  .signature-section {
    text-align: right;
    font-size: 7.5px;
  }

  .signature-box {
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  .signature-img {
    max-height: 40px;
    max-width: 100px;
    object-fit: contain;
  }

  .footer-row {
    border-top: 1.5px solid #000;
    text-align: center;
    padding: 5px;
    font-size: 7.5px;
    font-weight: bold;
    letter-spacing: 0.5px;
    background: #fff;
  }

  .page-number-row {
    text-align: center;
    padding: 1px 0 3px 0;
    font-size: 7.5px;
    color: #555;
  }

  @media print {
    body {
      background: #fff !important;
      -webkit-print-color-adjust: exact !important;
    }
  }
</style>
</head>
<body>

<div class="po-container">

  <!-- HEADER -->
  <table class="header-table">
    <tr>
      <td style="width: 70%; padding: 6px;">
        <div style="display: flex; align-items: flex-start; justify-content: space-between;">
          <div style="display: flex; align-items: flex-start;">
            <div class="logo-box">
              {{#logoBase64}}
              <img src="{{logoBase64}}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
              {{/logoBase64}}
              {{^logoBase64}}
              <div style="font-size: 9px;">S P</div>
              <div style="font-size: 12px; margin: 1px 0;">⚙</div>
              <div style="font-size: 9px;">T P</div>
              {{/logoBase64}}
            </div>
            <div>
              <div class="company-title">{{hostCompanyName}}</div>
              <div class="company-address">{{{hostCompanyAddressHtml}}}</div>
              <div class="company-meta"><strong>GSTIN NO.</strong> : {{hostGSTIN}}</div>
              {{#hostCIN}}
              <div class="company-meta"><strong>CIN NO.</strong> : {{hostCIN}}</div>
              {{/hostCIN}}
            </div>
          </div>
          
          <div style="width: 220px; margin-left: 10px;">
            <table class="created-by-table">
              <tr>
                <td style="width: 38%; font-weight: bold;">Created By</td>
                <td style="width: 5%;">:</td>
                <td>{{created_by_name}}</td>
              </tr>
              <tr>
                <td style="font-weight: bold;">Mobile</td>
                <td>:</td>
                <td>{{created_by_mobile}}</td>
              </tr>
              <tr>
                <td style="font-weight: bold;">Telephone</td>
                <td>:</td>
                <td>{{created_by_phone}}</td>
              </tr>
              <tr>
                <td style="font-weight: bold;">Email</td>
                <td>:</td>
                <td style="word-break: break-all;">{{created_by_email}}</td>
              </tr>
            </table>
          </div>
        </div>
      </td>
      
      <td style="width: 30%; border-left: 1.5px solid #000; padding: 0;">
        <div class="po-title-block">PURCHASE ORDER</div>
        <table class="po-details-table">
          <tr>
            <td style="width: 45%; font-weight: bold;">Purchase Order No.</td>
            <td style="width: 5%;">:</td>
            <td>{{po_number}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">PO Date</td>
            <td>:</td>
            <td>{{po_date}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Customer Code</td>
            <td>:</td>
            <td>{{customer_code}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Plant</td>
            <td>:</td>
            <td>{{plant}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Version No.</td>
            <td>:</td>
            <td>{{version_no}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Version Date</td>
            <td>:</td>
            <td>{{po_date}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Your Reference No.</td>
            <td>:</td>
            <td style="word-break: break-all;">{{project_ref}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Order Type</td>
            <td>:</td>
            <td>{{order_type}}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- MIDDLE SECTION -->
  <table class="middle-table">
    <tr>
      <td style="width: 35%; border-right: 1.5px solid #000;">
        <div class="section-title">CUSTOMER DETAILS</div>
        <div class="vendor-name">{{vendor_name}}</div>
        <div class="address-text">{{{vendor_address_html}}}</div>
        <table class="details-subtable" style="margin-top: 6px;">
          <tr>
            <td style="width: 32%; font-weight: bold;">Telephone</td>
            <td style="width: 5%;">:</td>
            <td>{{phone}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">GSTIN NO.</td>
            <td>:</td>
            <td>{{vendor_gstin}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Contact Person</td>
            <td>:</td>
            <td>{{contact_person}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Email</td>
            <td>:</td>
            <td style="word-break: break-all;">{{vendor_email}}</td>
          </tr>
        </table>
      </td>
      
      <td style="width: 35%; border-right: 1.5px solid #000;">
        <div class="section-title">DISPATCH / SHIP TO ADDRESS</div>
        <div class="vendor-name">{{vendor_name}}</div>
        <div class="address-text">{{{shipping_address_html}}}</div>
        <table class="details-subtable" style="margin-top: 6px;">
          <tr>
            <td style="width: 32%; font-weight: bold;">GSTIN NO.</td>
            <td style="width: 5%;">:</td>
            <td>{{vendor_gstin}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">State</td>
            <td>:</td>
            <td>{{shipping_state}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Contact Person</td>
            <td>:</td>
            <td>{{shipping_contact_person}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Telephone</td>
            <td>:</td>
            <td>{{shipping_phone}}</td>
          </tr>
        </table>
      </td>
      
      <td style="width: 30%;">
        <div class="section-title">TERMS & CONDITIONS</div>
        <table class="details-subtable">
          <tr>
            <td style="width: 40%; font-weight: bold;">Payment Terms</td>
            <td style="width: 5%;">:</td>
            <td>{{payment_terms}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Freight</td>
            <td>:</td>
            <td>{{freight}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">P & F</td>
            <td>:</td>
            <td>{{p_and_f}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Insurance</td>
            <td>:</td>
            <td>{{insurance}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Purchase Term</td>
            <td>:</td>
            <td>{{purchase_term}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Delivery Terms</td>
            <td>:</td>
            <td>{{delivery_terms}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Delivery Date</td>
            <td>:</td>
            <td>{{expected_delivery_date}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Your Ref No.</td>
            <td>:</td>
            <td style="word-break: break-all;">{{project_ref}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Our Ref No.</td>
            <td>:</td>
            <td>{{our_ref_no}}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- ITEMS TABLE -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 3%;">SL No.</th>
        <th style="width: 25%; text-align: left; vertical-align: top; line-height: 1.3;">Item No.<br/>Item Description</th>
        <th style="width: 5%;">HSN Code</th>
        <th style="width: 7%;">Item Dlv. Dt.</th>
        <th style="width: 7%;">Pur. Req. No.</th>
        <th style="width: 6%; text-align: right;">Rate</th>
        <th style="width: 6%; text-align: right;">Qty</th>
        <th style="width: 4%;">Unit</th>
        <th style="width: 6%; text-align: right;">Amount</th>
        <th style="width: 5%; text-align: right;">Discount</th>
        <th style="width: 6%; text-align: right;">Transaction Amount</th>
        <th style="width: 3%; text-align: right; line-height: 1.2;">CGST<br/>%</th>
        <th style="width: 6%; text-align: right;">CGST Amt</th>
        <th style="width: 3%; text-align: right; line-height: 1.2;">SGST<br/>%</th>
        <th style="width: 6%; text-align: right;">SGST Amt</th>
      </tr>
    </thead>
    <tbody>
      {{#items}}
      <tr {{#has_sub_assemblies}}class="parent-with-subs"{{/has_sub_assemblies}}>
        <td style="text-align: center;">{{sl_no}}</td>
        <td style="text-align: left; line-height: 1.35; padding-left: 5px;">
          {{item_no}}<br/>
          <div style="padding-left: 10px;">
            <strong>{{material_name}}</strong><br/>
            {{#description}}
            <span style="font-size: 7px; color: #555;">{{description}}</span>
            {{/description}}
          </div>
        </td>
        <td style="text-align: center;">{{hsn_code}}</td>
        <td style="text-align: center;">{{expected_delivery_date}}</td>
        <td style="text-align: center;">{{pur_req_no}}</td>
        <td style="text-align: right;">{{unit_rate}}</td>
        <td style="text-align: right;">{{quantity}}</td>
        <td style="text-align: center;">{{unit}}</td>
        <td style="text-align: right;">{{amount}}</td>
        <td style="text-align: right;">{{discount}}</td>
        <td style="text-align: right;">{{transaction_amount}}</td>
        <td style="text-align: right;">{{cgst_rate}}%</td>
        <td style="text-align: right;">{{cgst_amount}}</td>
        <td style="text-align: right;">{{sgst_rate}}%</td>
        <td style="text-align: right;">{{sgst_amount}}</td>
      </tr>
      {{#sub_assemblies}}
      <tr class="sub-assembly-row {{#is_last}}last-sub-assembly{{/is_last}}" style="background: #fafafa; font-size: 6.5px;">
        <td></td>
        <td style="text-align: left; padding-left: 15px;">{{description}} ({{drawingNo}})</td>
        <td style="text-align: center;">{{hsn_code}}</td>
        <td style="text-align: center;">{{formatted_delivery_date}}</td>
        <td></td>
        <td style="text-align: right;">{{displayRate}}</td>
        <td style="text-align: right;">{{displayQuantity}}</td>
        <td style="text-align: center;">{{unit}}</td>
        <td style="text-align: right; font-weight: bold;">{{displayTotal}}</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
      {{/sub_assemblies}}
      {{/items}}
      {{#empty_rows}}
      <tr style="height: 22px;">
        <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
      </tr>
      {{/empty_rows}}
    </tbody>
  </table>

  <!-- SUMMARY -->
  <table class="summary-table">
    <tr>
      <td style="width: 60%; padding: 8px; border-right: 1.5px solid #000;">
        <div style="font-size: 7.5px; font-weight: bold; margin-bottom: 4px;">Amount Chargeable (in words)</div>
        <div style="font-size: 8.5px; font-weight: bold; text-transform: uppercase; line-height: 1.35; color: #000;">
          INR {{total_amount_words}} ONLY
        </div>
      </td>
      <td style="width: 40%; padding: 0;">
        <table class="totals-subtable">
          <tr>
            <td style="width: 55%; padding: 3px 5px; font-weight: bold;">Sub Total</td>
            <td style="width: 5%; text-align: center; padding: 3px 0;">:</td>
            <td style="text-align: right; padding: 3px 5px;">{{subtotal}}</td>
          </tr>
          {{#cgst_total}}
          <tr>
            <td style="padding: 3px 5px; font-weight: bold;">CGST @ {{cgst_rate_summary}}%</td>
            <td style="text-align: center; padding: 3px 0;">:</td>
            <td style="text-align: right; padding: 3px 5px;">{{cgst_total}}</td>
          </tr>
          {{/cgst_total}}
          {{#sgst_total}}
          <tr>
            <td style="padding: 3px 5px; font-weight: bold;">SGST @ {{sgst_rate_summary}}%</td>
            <td style="text-align: center; padding: 3px 0;">:</td>
            <td style="text-align: right; padding: 3px 5px;">{{sgst_total}}</td>
          </tr>
          {{/sgst_total}}
          <tr class="grand-total-row">
            <td style="padding: 5px; font-size: 9px; font-weight: bold;">Grand Total</td>
            <td style="text-align: center; padding: 5px 0; font-size: 9px; font-weight: bold;">:</td>
            <td style="text-align: right; padding: 5px; font-size: 10px; font-weight: bold;">
              ₹ {{total_amount}}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- BOTTOM SECTION -->
  <table class="bottom-table">
    <tr>
      <td style="width: 35%; border-right: 1.5px solid #000;">
        <div class="section-title">BANK DETAILS (For Remittance)</div>
        <table class="details-subtable">
          <tr>
            <td style="width: 35%; font-weight: bold;">Bank Name</td>
            <td style="width: 5%;">:</td>
            <td>{{hostBankName}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Account Name</td>
            <td>:</td>
            <td>{{hostAccountName}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Account Number</td>
            <td>:</td>
            <td>{{hostAccountNumber}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">IFSC Code</td>
            <td>:</td>
            <td>{{hostIFSCCode}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Branch</td>
            <td>:</td>
            <td>{{hostBranchName}}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Beneficiary GSTIN</td>
            <td>:</td>
            <td>{{hostGSTIN}}</td>
          </tr>
        </table>
      </td>
      
      <td style="width: 35%; border-right: 1.5px solid #000;">
        <div class="section-title">IMPORTANT NOTES</div>
        <ol style="margin: 0; padding-left: 12px; font-size: 7.5px; line-height: 1.35; color: #333;">
          <li>Please ensure all supplied material meet the requirements specified in PO.</li>
          <li>All the necessary test certificates, data sheets to be provided along with the material.</li>
          <li>Please mention our PO No. & Item Code in your Challan and Invoice.</li>
          <li>General Terms and Conditions as enclosed.</li>
          <li>Subject to Pune jurisdiction only.</li>
          <li>Goods once sold will not be taken back.</li>
        </ol>
      </td>
      
      <td style="width: 30%;">
        <div class="section-title">DECLARATION</div>
        <div class="declaration-text">
          We declare that this Purchase Order is issued for the goods / services as per the terms and conditions mentioned herein.
        </div>
        
        <div class="signature-section">
          <div style="font-weight: bold; margin-bottom: 20px;">For {{hostCompanyName}}</div>
          <div class="signature-box">
            {{#signatureBase64}}
            <img src="{{signatureBase64}}" class="signature-img" />
            {{/signatureBase64}}
            {{^signatureBase64}}
            <div style="font-family: 'Courier New', Courier, monospace; font-style: italic; font-size: 11px; font-weight: bold; border-bottom: 1px dashed #000; display: inline-block; padding: 2px 10px; margin-bottom: 5px;">
              {{hostCompanyName}}
            </div>
            {{/signatureBase64}}
          </div>
          <div style="font-weight: bold; margin-top: 5px;">Authorized Signatory</div>
        </div>
      </td>
    </tr>
  </table>

  <!-- FOOTER -->
  <div class="footer-row">
    THIS IS ELECTRONICALLY GENERATED PURCHASE ORDER AND DOES NOT REQUIRE SIGNATURE.
  </div>

  <div class="page-number-row">
    Page 1 of 1
  </div>

</div>

</body>
</html>
`;

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : '—';
  const formatCurrency = (val) => Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const subtotal = po.items.reduce((sum, item) => sum + (parseFloat(item.basic_amount) || 0) - (parseFloat(item.discount) || 0), 0);
  const cgst_total = po.items.reduce((sum, item) => sum + (parseFloat(item.cgst_amount) || 0), 0);
  const sgst_total = po.items.reduce((sum, item) => sum + (parseFloat(item.sgst_amount) || 0), 0);
  const grand_total = parseFloat(po.net_total || (subtotal + cgst_total + sgst_total));

  const firstItem = po.items[0] || {};
  const cgst_rate_summary = parseFloat(firstItem.cgst_percent || 0).toFixed(0);
  const sgst_rate_summary = parseFloat(firstItem.sgst_percent || 0).toFixed(0);

  const numberToWords = (num) => {
    const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const inWords = (num) => {
        if ((num = num.toString()).length > 9) return 'overflow';
        let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
        if (!n) return; let str = '';
        str += (Number(n[1]) != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : '';
        str += (Number(n[2]) != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : '';
        str += (Number(n[3]) != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : '';
        str += (Number(n[4]) != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : '';
        str += (Number(n[5]) != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
        return str.toUpperCase();
    };
    return inWords(Math.floor(num));
  };

  const viewData = {
    ...po,
    po_date: formatDate(po.po_date),
    expected_delivery_date: formatDate(po.expected_delivery_date),
    vendor_name: po.company_name || 'N/A',
    vendor_email: po.company_email || 'N/A',
    vendor_address_html: po.billing_address ? po.billing_address.split(', ').join('<br/>') : 'N/A',
    phone: po.billing_contact_phone || 'N/A',
    vendor_gstin: po.gstin || 'N/A',
    contact_person: po.billing_contact_name || 'N/A',
    shipping_address_html: po.shipping_address ? po.shipping_address.split(', ').join('<br/>') : 'N/A',
    shipping_state: po.shipping_state || 'N/A',
    shipping_contact_person: po.shipping_contact_name || 'N/A',
    shipping_phone: po.shipping_contact_phone || 'N/A',
    project_name: po.project_name || 'General Procurement',
    project_ref: po.po_number ? (po.po_number.startsWith('PO-') ? po.po_number : `PO-${po.po_number}`) : 'Direct Procurement',
    subtotal: subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    cgst_total: cgst_total > 0 ? cgst_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null,
    sgst_total: sgst_total > 0 ? sgst_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null,
    cgst_rate_summary,
    sgst_rate_summary,
    total_amount: grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    total_amount_words: numberToWords(grand_total),
    hostCompanyName,
    hostCompanyAddressHtml,
    hostGSTIN,
    hostCIN,
    hostPAN,
    logoBase64,
    signatureBase64,
    created_by_name: creator ? `${creator.first_name} ${creator.last_name}` : 'Admin User',
    created_by_mobile: creator?.phone || activeCompany?.phone || '9822012345',
    created_by_phone: activeCompany?.telephone || '-',
    created_by_email: creator?.email || activeCompany?.email || 'rohit.kuchekar.external@sptech.com',
    customer_code: po.company_code || po.customer_code || ('CUST-' + String(po.company_id).padStart(6, '0')),
    plant: po.plant || activeCompany?.plant_code || 'STPTPL-01',
    version_no: po.po_version || '1.0',
    order_type: po.order_type || 'Standard Purchase Order',
    payment_terms: po.payment_terms || '45 days from invoice date',
    freight: po.freight_terms || 'Included',
    p_and_f: po.packing_forwarding || 'Included',
    insurance: po.insurance_terms || 'Included',
    purchase_term: po.order_type || 'Standard Purchase Order',
    delivery_terms: po.delivery_terms || 'As Per Item Wise Delivery Date',
    our_ref_no: po.our_ref_no || '—',
    hostBankName: activeCompany?.bank_name || 'HDFC BANK LTD.',
    hostAccountName: activeCompany?.company_name || 'SP TECHPIONEER PRIVATE LIMITED',
    hostAccountNumber: activeCompany?.account_number || '123456789999',
    hostIFSCCode: activeCompany?.ifsc_code ? activeCompany.ifsc_code.toUpperCase() : 'HDFC0001234',
    hostBranchName: activeCompany?.branch_name || 'Bhosari, Pune - 411026, Maharashtra',
    hostState: activeCompany?.state || 'Maharashtra',
    items: (po.items || []).map((i, idx) => {
      const has_sub_assemblies = i.sub_assemblies && i.sub_assemblies.length > 0;
      return {
        ...i,
        sl_no: (idx + 1) * 10,
        item_code: i.item_code || '—',
        item_no: i.item_code || '—',
        drawing_no: i.drawing_no || i.item_code || '—',
        material_name: i.description || '—',
        description: i.drawing_no ? `DRW: ${i.drawing_no}` : '—',
        hsn_code: i.hsn_code || '73089090',
        expected_delivery_date: i.delivery_date ? formatDate(i.delivery_date) : '—',
        pur_req_no: po.po_number || '—',
        quantity: Number(i.quantity).toFixed(3),
        unit: (i.unit || 'NOS').toUpperCase(),
        unit_rate: parseFloat(i.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        amount: parseFloat(i.basic_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        discount: parseFloat(i.discount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        transaction_amount: (parseFloat(i.basic_amount || 0) - parseFloat(i.discount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        cgst_rate: parseFloat(i.cgst_percent || 0).toFixed(2),
        cgst_amount: parseFloat(i.cgst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        sgst_rate: parseFloat(i.sgst_percent || 0).toFixed(2),
        sgst_amount: parseFloat(i.sgst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        has_sub_assemblies,
        sub_assemblies: (i.sub_assemblies || []).map((sa, saIdx) => {
          const saQty = (parseFloat(sa.quantity || 0) * (parseFloat(i.quantity) || 0));
          const saRate = parseFloat(sa.rate || 0);
          return {
            ...sa,
            displayQuantity: saQty.toFixed(3),
            displayRate: parseFloat(saRate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            displayTotal: parseFloat(saQty * saRate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            unit: sa.unit || 'NOS',
            hsn_code: sa.hsn_code || i.hsn_code || '—',
            formatted_delivery_date: sa.delivery_date ? formatDate(sa.delivery_date) : (i.delivery_date ? formatDate(i.delivery_date) : '—'),
            is_last: saIdx === i.sub_assemblies.length - 1
          };
        })
      };
    }),
    empty_rows: Array.from({ length: Math.max(0, 4 - (po.items || []).length) })
  };

  const html = mustache.render(htmlTemplate, viewData);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  const pdf = await page.pdf({ 
    format: 'A4', 
    landscape: true,
    printBackground: true,
    margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' }
  });
  await browser.close();

  return pdf;
};

const uploadCustomerPoPdf = async (id, pdfPath) => {
  const [rows] = await pool.query('SELECT pdf_path FROM customer_pos WHERE id = ?', [id]);
  if (!rows.length) return false;
  let newPath = pdfPath;
  if (rows[0].pdf_path) {
    const existing = rows[0].pdf_path.split(',').map(f => f.trim()).filter(Boolean);
    if (!existing.includes(pdfPath)) {
      newPath = `${rows[0].pdf_path},${pdfPath}`;
    } else {
      newPath = rows[0].pdf_path;
    }
  }
  const [result] = await pool.query(
    'UPDATE customer_pos SET pdf_path = ? WHERE id = ?',
    [newPath, id]
  );
  return result.affectedRows > 0;
};

module.exports = {
  createCustomerPo,
  listCustomerPos,
  getCustomerPoById,
  updateCustomerPo,
  deleteCustomerPo,
  generateCustomerPoPDF,
  uploadCustomerPoPdf
};

