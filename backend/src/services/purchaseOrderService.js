const pool = require('../config/db');

const generatePONumber = async () => {
  const currentYear = new Date().getFullYear();
  const [result] = await pool.query(
    `SELECT COUNT(*) as count FROM purchase_orders 
     WHERE YEAR(created_at) = ?`,
    [currentYear]
  );
  
  const count = (result[0]?.count || 0) + 1;
  const paddedCount = String(count).padStart(4, '0');
  return `PO-${currentYear}-${paddedCount}`;
};

const previewPurchaseOrder = async (quotationId) => {
  const [quotation] = await pool.query(
    'SELECT q.*, so.project_name FROM quotations q LEFT JOIN sales_orders so ON so.id = q.sales_order_id WHERE q.id = ?',
    [quotationId]
  );

  if (!quotation.length) {
    throw new Error('Quotation not found');
  }

  const quote = quotation[0];
  let poNumber = await generatePONumber();

  if (quote.sales_order_id) {
    const [salesOrder] = await pool.query(
      'SELECT customer_po_id FROM sales_orders WHERE id = ?',
      [quote.sales_order_id]
    );

    if (salesOrder.length && salesOrder[0].customer_po_id) {
      const [customerPO] = await pool.query(
        'SELECT po_number FROM customer_pos WHERE id = ?',
        [salesOrder[0].customer_po_id]
      );

      if (customerPO.length && customerPO[0].po_number) {
        poNumber = customerPO[0].po_number;
      }
    }
  }

  return {
    poNumber,
    projectName: quote.project_name || 'Direct Procurement',
    totalAmount: quote.total_amount,
    vendorName: quote.vendor_name,
    notes: quote.notes,
    expectedDeliveryDate: quote.valid_until ? new Date(quote.valid_until).toISOString().split('T')[0] : ''
  };
};

const createPurchaseOrder = async (data) => {
  const { quotationId, mrId, expectedDeliveryDate, notes, poNumber: manualPoNumber, items: manualItems, vendorId, vendor_id } = data;
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let finalVendorId = vendorId || vendor_id;
    let sales_order_id = null;
    let total_amount = 0;
    let items = [];

    if (quotationId) {
      const [quotation] = await connection.query(
        'SELECT * FROM quotations WHERE id = ?',
        [quotationId]
      );

      if (!quotation.length) {
        throw new Error('Quotation not found');
      }

      const quote = quotation[0];
      finalVendorId = quote.vendor_id;
      sales_order_id = quote.sales_order_id;
      total_amount = quote.total_amount;

      const [quoteItems] = await connection.query(
        `SELECT qi.*, soi.status as sales_order_item_status 
         FROM quotation_items qi
         LEFT JOIN sales_order_items soi ON (qi.drawing_no = soi.drawing_no OR qi.item_code = soi.item_code) AND soi.sales_order_id = ?
         WHERE qi.quotation_id = ?`,
        [quote.sales_order_id, quotationId]
      );
      items = quoteItems;
    } else if (mrId) {
      // Create PO from Material Request
      const [mr] = await connection.query('SELECT * FROM material_requests WHERE id = ?', [mrId]);
      if (!mr.length) throw new Error('Material Request not found');
      
      const mrData = mr[0];
      let planId = null;
      if (mrData.notes && mrData.notes.includes('Generated from Production Plan')) {
        const match = mrData.notes.match(/Generated from Production Plan (PP-[^ ]+)/);
        if (match) {
          const planCode = match[1];
          const [plans] = await connection.query('SELECT id FROM production_plans WHERE plan_code = ?', [planCode]);
          if (plans.length > 0) planId = plans[0].id;
        }
      }

      const [mrItems] = await connection.query(`
        SELECT mri.*, sb.valuation_rate,
               COALESCE(
                 (SELECT MAX(bom_cost) FROM sales_order_items soi WHERE (soi.item_code = mri.item_code OR soi.drawing_no = mri.item_code) AND soi.bom_cost > 0),
                 (SELECT MAX(rate) FROM production_plan_materials ppm WHERE ppm.plan_id = ? AND ppm.item_code = mri.item_code AND ppm.rate > 0),
                 (SELECT MAX(rate) FROM production_plan_sub_assemblies psa WHERE psa.plan_id = ? AND psa.item_code = mri.item_code AND psa.rate > 0),
                 (SELECT MAX(rate) FROM production_plan_items ppi WHERE ppi.plan_id = ? AND ppi.item_code = mri.item_code AND ppi.rate > 0),
                 (SELECT MAX(rate) FROM sales_order_item_materials som WHERE (som.item_code = mri.item_code OR som.drawing_no = mri.item_code) AND som.rate > 0),
                 (SELECT MAX(rate) FROM sales_order_item_components soc WHERE (soc.component_code = mri.item_code OR soc.drawing_no = mri.item_code) AND soc.rate > 0),
                 mri.unit_rate
               ) as bom_rate
        FROM material_request_items mri
        LEFT JOIN (SELECT item_code, MAX(valuation_rate) as valuation_rate FROM stock_balance GROUP BY item_code) sb ON mri.item_code = sb.item_code
        WHERE mri.mr_id = ?
      `, [planId, planId, planId, mrId]);
      
      items = mrItems.map(item => {
        const qty = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.bom_rate || item.unit_rate || item.valuation_rate) || 0;
        const amount = qty * rate;
        const cgstPercent = 9;
        const sgstPercent = 9;
        const cgstAmount = (amount * cgstPercent) / 100;
        const sgstAmount = (amount * sgstPercent) / 100;
        const totalItemAmount = amount + cgstAmount + sgstAmount;

        return {
          ...item,
          design_qty: item.design_qty || item.quantity,
          description: item.item_name || item.description,
          material_name: item.item_name || item.material_name,
          material_type: item.item_type || item.material_type,
          drawing_no: item.drawing_no || null,
          drawing_id: item.drawing_id || null,
          unit: item.uom || item.unit || 'NOS',
          unit_rate: rate,
          amount: amount,
          cgst_percent: cgstPercent,
          cgst_amount: cgstAmount,
          sgst_percent: sgstPercent,
          sgst_amount: sgstAmount,
          total_amount: totalItemAmount
        };
      });
      
      total_amount = items.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);
      // Removed: if (!finalVendorId) throw new Error('Vendor is required for PO from Material Request');
    } else {
      // Manual PO
      if (!finalVendorId) throw new Error('Vendor is required for manual PO');
      if (!manualItems || manualItems.length === 0) throw new Error('Items are required for manual PO');
      
      items = manualItems.map(item => {
        const qty = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.rate || item.unit_rate) || 0;
        const amount = qty * rate;
        const cgstPercent = item.cgst_percent || 9;
        const sgstPercent = item.sgst_percent || 9;
        const cgstAmount = (amount * cgstPercent) / 100;
        const sgstAmount = (amount * sgstPercent) / 100;
        const totalItemAmount = amount + cgstAmount + sgstAmount;
        return {
          ...item,
          unit_rate: rate,
          amount: amount,
          cgst_percent: cgstPercent,
          cgst_amount: cgstAmount,
          sgst_percent: sgstPercent,
          sgst_amount: sgstAmount,
          total_amount: totalItemAmount
        };
      });
      total_amount = items.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);
    }

    let poNumber = manualPoNumber;
    
    if (!poNumber) {
      poNumber = await generatePONumber();

      if (sales_order_id) {
        const [salesOrder] = await connection.query(
          'SELECT customer_po_id FROM sales_orders WHERE id = ?',
          [sales_order_id]
        );

        if (salesOrder.length && salesOrder[0].customer_po_id) {
          const [customerPO] = await connection.query(
            'SELECT po_number FROM customer_pos WHERE id = ?',
            [salesOrder[0].customer_po_id]
          );

          if (customerPO.length && customerPO[0].po_number) {
            poNumber = customerPO[0].po_number;
          }
        }
      }
    }

    const poStatus = (mrId && !finalVendorId) ? 'PO_REQUEST' : 'DRAFT';

    const [result] = await connection.execute(
      `INSERT INTO purchase_orders (po_number, quotation_id, mr_id, vendor_id, sales_order_id, status, total_amount, expected_delivery_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        poNumber,
        quotationId || null,
        mrId || null,
        finalVendorId || null,
        sales_order_id || null,
        poStatus,
        total_amount || 0,
        expectedDeliveryDate || null,
        notes || null
      ]
    );

    const poId = result.insertId;
    
    if (mrId) {
      await connection.execute(
        'UPDATE material_requests SET linked_po_id = ?, linked_po_number = ?, status = ? WHERE id = ?',
        [poId, poNumber, 'PROCESSING', mrId]
      );
    }
    
    let actualTotalAmount = 0;

    if (items.length > 0) {
      for (const item of items) {
        if (item.sales_order_item_status === 'Rejected') continue;

        const qty = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.unit_rate || item.rate) || 0;
        const amount = qty * rate;
        const cgstPercent = item.cgst_percent || 9;
        const sgstPercent = item.sgst_percent || 9;
        const cgstAmount = (amount * cgstPercent) / 100;
        const sgstAmount = (amount * sgstPercent) / 100;
        const totalItemAmount = amount + cgstAmount + sgstAmount;
        
        actualTotalAmount += totalItemAmount;

        await connection.execute(
          `INSERT INTO purchase_order_items (
            purchase_order_id, item_code, description, design_qty, quantity, unit, unit_rate, amount,
            cgst_percent, cgst_amount, sgst_percent, sgst_amount, total_amount,
            material_name, material_type, drawing_no, drawing_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            poId,
            item.item_code || null,
            item.description || null,
            item.design_qty || 0,
            item.quantity || 0,
            item.unit || 'NOS',
            rate,
            amount,
            cgstPercent,
            cgstAmount,
            sgstPercent,
            sgstAmount,
            totalItemAmount,
            item.material_name || null,
            item.material_type || null,
            item.drawing_no || null,
            item.drawing_id || null
          ]
        );
      }
    }

    if (actualTotalAmount !== total_amount) {
      await connection.execute(
        'UPDATE purchase_orders SET total_amount = ? WHERE id = ?',
        [actualTotalAmount, poId]
      );
    }

    if (sales_order_id) {
      await connection.execute(
        'UPDATE sales_orders SET status = ? WHERE id = ?',
        ['MATERIAL_PURCHASE_IN_PROGRESS', sales_order_id]
      );
    }

    await connection.commit();
    return { id: poId, po_number: poNumber };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getPurchaseOrders = async (filters = {}) => {
  let query = `
    SELECT 
      po.*,
      v.vendor_name,
      mr.mr_number,
      COUNT(poi.id) as items_count,
      IFNULL(SUM(poi.quantity), 0) as total_quantity,
      IFNULL(SUM(poi.accepted_quantity), 0) as accepted_quantity
    FROM purchase_orders po
    LEFT JOIN vendors v ON v.id = po.vendor_id
    LEFT JOIN material_requests mr ON mr.id = po.mr_id
    LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.status) {
    query += ' AND po.status = ?';
    params.push(filters.status);
  }

  if (filters.vendorId) {
    query += ' AND po.vendor_id = ?';
    params.push(filters.vendorId);
  }

  if (filters.storeAcceptanceStatus) {
    query += ' AND po.store_acceptance_status = ?';
    params.push(filters.storeAcceptanceStatus);
  }

  query += ' GROUP BY po.id ORDER BY po.created_at DESC';

  const [pos] = await pool.query(query, params);

  if (pos.length > 0) {
    const poIds = pos.map(p => p.id);
    const [items] = await pool.query(
      `SELECT 
        poi.*,
        COALESCE(
          (SELECT MAX(bom_cost) FROM sales_order_items soi WHERE (soi.item_code = poi.item_code OR soi.drawing_no = poi.item_code) AND soi.bom_cost > 0),
          (SELECT MAX(rate) FROM sales_order_item_materials som WHERE (som.item_code = poi.item_code OR som.drawing_no = poi.item_code) AND som.rate > 0),
          (SELECT MAX(rate) FROM sales_order_item_components soc WHERE (soc.component_code = poi.item_code OR soc.drawing_no = poi.item_code) AND soc.rate > 0),
          poi.unit_rate
        ) as unit_rate,
        (SELECT status FROM sales_order_items soi 
         WHERE (poi.drawing_no = soi.drawing_no OR poi.item_code = soi.item_code) 
         AND soi.sales_order_id = po.sales_order_id 
         LIMIT 1) as sales_order_item_status 
       FROM purchase_order_items poi
       LEFT JOIN purchase_orders po ON po.id = poi.purchase_order_id
       WHERE poi.purchase_order_id IN (?)`,
      [poIds]
    );

    // Group items by purchase_order_id and filter them
    pos.forEach(po => {
      po.items = items
        .filter(item => item.purchase_order_id === po.id)
        .filter(item => {
          const type = (item.material_type || '').toUpperCase();
          return type !== 'FG' && type !== 'FINISHED GOOD' && type !== 'SUB_ASSEMBLY' && type !== 'SUB ASSEMBLY';
        });
    });
  }

  return pos;
};

const getPurchaseOrderById = async (poId) => {
  const [rows] = await pool.query(
    `SELECT po.*, v.vendor_name, mr.mr_number
     FROM purchase_orders po
     LEFT JOIN vendors v ON v.id = po.vendor_id
     LEFT JOIN material_requests mr ON mr.id = po.mr_id
     WHERE po.id = ?`,
    [poId]
  );

  if (!rows.length) {
    const error = new Error('Purchase Order not found');
    error.statusCode = 404;
    throw error;
  }

  const po = rows[0];
  
  const [items] = await pool.query(
    `SELECT 
      poi.id,
      poi.item_code,
      COALESCE(poi.description, sb.material_name, poi.item_code) as description,
      poi.design_qty,
      poi.quantity,
      poi.unit,
      COALESCE(
        (SELECT MAX(bom_cost) FROM sales_order_items soi WHERE (soi.item_code = poi.item_code OR soi.drawing_no = poi.item_code) AND soi.bom_cost > 0),
        (SELECT MAX(rate) FROM sales_order_item_materials som WHERE (som.item_code = poi.item_code OR som.drawing_no = poi.item_code) AND som.rate > 0),
        (SELECT MAX(rate) FROM sales_order_item_components soc WHERE (soc.component_code = poi.item_code OR soc.drawing_no = poi.item_code) AND soc.rate > 0),
        poi.unit_rate
      ) as unit_rate,
      poi.amount,
      poi.cgst_percent,
      poi.cgst_amount,
      poi.sgst_percent,
      poi.sgst_amount,
      poi.total_amount,
      COALESCE(poi.material_name, sb.material_name, poi.item_code) as material_name,
      poi.material_type,
      poi.drawing_no,
      poi.accepted_quantity,
      (SELECT status FROM sales_order_items soi 
       WHERE (poi.drawing_no = soi.drawing_no OR poi.item_code = soi.item_code) 
       AND soi.sales_order_id = ? 
       LIMIT 1) as sales_order_item_status
     FROM purchase_order_items poi
     LEFT JOIN (SELECT item_code, MAX(material_name) as material_name FROM stock_balance GROUP BY item_code) sb ON poi.item_code = sb.item_code
     WHERE poi.purchase_order_id = ?`,
    [po.sales_order_id, poId]
  );

  // Filter out FG and Sub Assembly items
  const filteredItems = items.filter(item => {
    const type = (item.material_type || '').toUpperCase();
    return type !== 'FG' && type !== 'FINISHED GOOD' && type !== 'SUB_ASSEMBLY' && type !== 'SUB ASSEMBLY';
  });

  // Use the total_amount stored in po if available, otherwise calculate from filtered items
  if (!po.total_amount || po.total_amount === 0) {
    po.total_amount = filteredItems.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);
  }

  return { ...po, items: filteredItems };
};

const updatePurchaseOrder = async (poId, payload) => {
  const { status, poNumber, expectedDeliveryDate, notes, items, vendorId } = payload;
  
  const validStatuses = ['PO_REQUEST', 'DRAFT', 'ORDERED', 'SENT', 'ACKNOWLEDGED', 'RECEIVED', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CLOSED'];
  if (status && !validStatuses.includes(status)) {
    const error = new Error('Invalid status');
    error.statusCode = 400;
    throw error;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existing] = await connection.query('SELECT * FROM purchase_orders WHERE id = ?', [poId]);
    if (!existing.length) {
      throw new Error('Purchase Order not found');
    }

    const updates = [];
    const params = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (poNumber) {
      updates.push('po_number = ?');
      params.push(poNumber);
    }
    if (expectedDeliveryDate !== undefined) {
      updates.push('expected_delivery_date = ?');
      params.push(expectedDeliveryDate);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    if (vendorId !== undefined) {
      updates.push('vendor_id = ?');
      params.push(vendorId);
    }

    if (updates.length > 0) {
      params.push(poId);
      await connection.execute(
        `UPDATE purchase_orders SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    if (items && Array.isArray(items)) {
      let totalAmount = 0;
      for (const item of items) {
        const qty = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.unit_rate) || parseFloat(item.rate) || 0;
        const amount = qty * rate;
        
        // Default to 18% GST (9% CGST + 9% SGST)
        const cgstPercent = item.cgst_percent || 9;
        const sgstPercent = item.sgst_percent || 9;
        const cgstAmount = (amount * cgstPercent) / 100;
        const sgstAmount = (amount * sgstPercent) / 100;
        const totalItemAmount = amount + cgstAmount + sgstAmount;
        
        totalAmount += totalItemAmount;

        if (item.id) {
          await connection.execute(
            `UPDATE purchase_order_items 
             SET unit_rate = ?, amount = ?, cgst_percent = ?, cgst_amount = ?, sgst_percent = ?, sgst_amount = ?, total_amount = ?, quantity = ?, design_qty = ?, description = ?, item_code = ?, unit = ?
             WHERE id = ? AND purchase_order_id = ?`,
            [rate, amount, cgstPercent, cgstAmount, sgstPercent, sgstAmount, totalItemAmount, qty, qty, item.description, item.item_code, item.unit, item.id, poId]
          );
        } else {
          await connection.execute(
            `INSERT INTO purchase_order_items 
             (purchase_order_id, item_code, description, quantity, design_qty, unit, unit_rate, amount, cgst_percent, cgst_amount, sgst_percent, sgst_amount, total_amount)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [poId, item.item_code, item.description, qty, qty, item.unit || 'NOS', rate, amount, cgstPercent, cgstAmount, sgstPercent, sgstAmount, totalItemAmount]
          );
        }
      }

      await connection.execute(
        'UPDATE purchase_orders SET total_amount = ? WHERE id = ?',
        [totalAmount, poId]
      );
    }

    await connection.commit();
    return { id: poId, status };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const deletePurchaseOrder = async (poId) => {
  await getPurchaseOrderById(poId);
  await pool.execute('DELETE FROM purchase_orders WHERE id = ?', [poId]);
};

const getPurchaseOrderStats = async () => {
  const [stats] = await pool.query(`
    SELECT 
      COUNT(*) as total_pos,
      SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END) as draft_pos,
      SUM(CASE WHEN status = 'ORDERED' THEN 1 ELSE 0 END) as submitted_pos,
      SUM(CASE WHEN status IN ('ORDERED', 'SENT', 'ACKNOWLEDGED') THEN 1 ELSE 0 END) as to_receive_pos,
      SUM(CASE WHEN status = 'PARTIALLY_RECEIVED' THEN 1 ELSE 0 END) as partial_pos,
      SUM(CASE WHEN status IN ('RECEIVED', 'COMPLETED') THEN 1 ELSE 0 END) as fulfilled_pos,
      SUM(total_amount) as total_value
    FROM purchase_orders
  `);

  return stats[0] || {
    total_pos: 0,
    draft_pos: 0,
    submitted_pos: 0,
    to_receive_pos: 0,
    partial_pos: 0,
    fulfilled_pos: 0,
    total_value: 0
  };
};

const getPOMaterialRequests = async (filters = {}) => {
  let query = `
    SELECT 
      po.id as po_id,
      po.po_number,
      po.created_at as po_date,
      v.vendor_name,
      poi.item_code,
      poi.material_name,
      poi.material_type,
      poi.drawing_no,
      poi.description,
      poi.quantity as po_qty,
      poi.unit,
      poi.accepted_quantity,
      (poi.quantity - IFNULL((
        SELECT SUM(pri.received_quantity)
        FROM po_receipt_items pri
        JOIN po_receipts pr ON pr.id = pri.receipt_id
        WHERE pri.po_item_id = poi.id AND pr.status != 'REJECTED'
      ), 0)) as pending_grn_qty,
      po.expected_delivery_date,
      po.store_acceptance_status,
      po.store_acceptance_date,
      po.store_acceptance_notes,
      poi.id as po_item_id
    FROM purchase_orders po
    JOIN vendors v ON v.id = po.vendor_id
    JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
    WHERE 1=1
    AND UPPER(poi.material_type) NOT IN ('FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY')
  `;
  const params = [];

  if (filters.status) {
    query += ' AND po.store_acceptance_status = ?';
    params.push(filters.status);
  }

  query += ' ORDER BY po.created_at DESC';

  const [rows] = await pool.query(query, params);
  return rows;
};

const approvePurchaseOrder = async (poId, userId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [po] = await connection.query('SELECT mr_id, vendor_id FROM purchase_orders WHERE id = ?', [poId]);
    if (!po.length) throw new Error('Purchase Order not found');
    
    if (!po[0].vendor_id) {
      throw new Error('Cannot approve PO without a vendor. Please edit the PO to assign a vendor first.');
    }

    await connection.execute(
      `UPDATE purchase_orders 
       SET status = 'ORDERED',
           approved_by = ?,
           approved_at = NOW()
       WHERE id = ?`,
      [userId, poId]
    );

    if (po[0].mr_id) {
      await connection.execute(
        "UPDATE material_requests SET status = 'PO_CREATED' WHERE id = ?",
        [po[0].mr_id]
      );
    }

    await connection.commit();
    return { success: true, poId, status: 'ORDERED' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const handleStoreAcceptance = async (poId, payload) => {
  const { status, notes, items } = payload;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Update PO status
    await connection.execute(
      `UPDATE purchase_orders 
       SET store_acceptance_status = ?, 
           store_acceptance_date = CURRENT_TIMESTAMP,
           store_acceptance_notes = ?
       WHERE id = ?`,
      [status, notes || null, poId]
    );

    // If accepted, we might want to update item-level accepted quantities if provided
    if (status === 'ACCEPTED' && items && Array.isArray(items)) {
      for (const item of items) {
        await connection.execute(
          `UPDATE purchase_order_items 
           SET accepted_quantity = ? 
           WHERE id = ? AND purchase_order_id = ?`,
          [item.accepted_quantity, item.po_item_id, poId]
        );
      }
    } else if (status === 'ACCEPTED') {
      // Default to full quantity if not specified
      await connection.execute(
        `UPDATE purchase_order_items 
         SET accepted_quantity = quantity 
         WHERE purchase_order_id = ?`,
        [poId]
      );
    }

    await connection.commit();
    return { success: true, poId, status };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  createPurchaseOrder,
  previewPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  deletePurchaseOrder,
  getPurchaseOrderStats,
  getPOMaterialRequests,
  approvePurchaseOrder,
  handleStoreAcceptance
};
