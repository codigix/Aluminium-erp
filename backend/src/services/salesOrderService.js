const crypto = require('crypto');
const pool = require('../config/db');
const designOrderService = require('./designOrderService');
const bomService = require('./bomService');
const stockService = require('./stockService');

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

const listSalesOrders = async (includeWithoutPo = true) => {
  let whereClause = "WHERE (so.is_sales_order = 1 OR so.status IN ('BOM_SUBMITTED', 'BOM_Approved', 'CREATED', 'DESIGN_QUERY', 'DESIGN_IN_REVIEW', 'QUOTATION_SENT', 'PRODUCTION_COMPLETED', 'READY_FOR_SHIPMENT', 'QC_APPROVED', 'READY_FOR_DISPATCH', 'QC_IN_PROGRESS', 'IN_PRODUCTION', 'MATERIAL_READY', 'QC_REJECTED', 'APPROVED', 'DESIGN_Approved', 'ACTIVE'))";
  if (!includeWithoutPo) {
    whereClause += ' AND so.customer_po_id IS NOT NULL';
  }
  
  const [rows] = await pool.query(
    `SELECT so.*, 
            COALESCE(so.project_name, cp.project_name) as project_name,
            so.target_dispatch_date as delivery_date, c.company_name, cp.po_number, cp.po_date, cp.currency AS po_currency, cp.net_total AS po_net_total, cp.pdf_path,
            COALESCE(ct.email, "") as email_address, COALESCE(ct.phone, "") as contact_phone,
            COALESCE(ct.name, "") as contact_person,
            (SELECT GROUP_CONCAT(DISTINCT drawing_no SEPARATOR ', ') FROM sales_order_items WHERE sales_order_id = so.id) as drawing_no,
            (SELECT reason FROM design_rejections WHERE sales_order_id = so.id ORDER BY created_at DESC LIMIT 1) as rejection_reason,
            (SELECT COUNT(*) FROM sales_order_items WHERE sales_order_id = so.id AND UPPER(TRIM(status)) = 'APPROVED') as approved_items_count,
            (SELECT COUNT(*) FROM sales_order_items WHERE sales_order_id = so.id) as total_items_count
     FROM sales_orders so
     LEFT JOIN companies c ON c.id = so.company_id
     LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
     LEFT JOIN (
       SELECT company_id, email, phone, name, 
              ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY contact_type = 'PRIMARY' DESC, id ASC) as rn
       FROM contacts
     ) ct ON ct.company_id = c.id AND ct.rn = 1
     ${whereClause}
     ORDER BY so.created_at DESC`
  );
  
  for (const order of rows) {
    const [items] = await pool.query(
      `SELECT soi.*, soi.quantity as design_qty, cd.file_path, cd.hsn_code, COALESCE(soi.delivery_date, cd.delivery_date) as delivery_date 
       FROM sales_order_items soi
       LEFT JOIN customer_drawings cd ON soi.drawing_id = cd.id
       WHERE soi.sales_order_id = ?`,
      [order.id]
    );
    order.items = items;
    order.client = order.company_name; // Add client alias for frontend
  }
  
  return rows;
};

const getSalesOrderById = async (id) => {
  const isUuid = typeof id === 'string' && id.length === 36;
  const whereClause = isUuid ? 'so.public_id = ?' : 'so.id = ?';
  const [rows] = await pool.query(
    `SELECT so.*, 
            COALESCE(so.project_name, cp.project_name) as project_name,
            so.target_dispatch_date as delivery_date, c.company_name, cp.po_number, cp.po_date, cp.currency AS po_currency, cp.net_total AS po_net_total, cp.pdf_path,
            COALESCE(ct.email, "") as email_address, COALESCE(ct.phone, "") as contact_phone,
            COALESCE(ct.name, "") as contact_person
     FROM sales_orders so
     LEFT JOIN companies c ON c.id = so.company_id
     LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
     LEFT JOIN (
       SELECT company_id, email, phone, name, 
              ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY contact_type = 'PRIMARY' DESC, id ASC) as rn
       FROM contacts
     ) ct ON ct.company_id = c.id AND ct.rn = 1
     WHERE ${whereClause}`,
    [id]
  );
  
  if (rows.length === 0) return null;
  const order = rows[0];
  order.client = order.company_name;

  const [items] = await pool.query(
    `SELECT soi.*, cd.file_path, cd.hsn_code, COALESCE(soi.delivery_date, cd.delivery_date) as delivery_date 
     FROM sales_order_items soi
     LEFT JOIN customer_drawings cd ON soi.drawing_id = cd.id
     WHERE soi.sales_order_id = ?`,
    [order.id]
  );
  order.items = items;
  
  return order;
};

const getIncomingOrders = async (departmentCode, includeAccepted = false) => {
  console.log(`[getIncomingOrders-service] Starting query for department: "${departmentCode}", includeAccepted: ${includeAccepted}`);
  
  let whereClause = '';
  if (departmentCode === 'DESIGN_ENG') {
    whereClause = `so.status IN ('CREATED', 'DESIGN_QUERY', 'DESIGN_IN_REVIEW')`;
  } else if (departmentCode === 'PROCUREMENT') {
    whereClause = `so.status IN ('CREATED', 'DESIGN_IN_REVIEW', 'DESIGN_Approved ', 'PROCUREMENT_IN_PROGRESS', 'MATERIAL_PURCHASE_IN_PROGRESS')`;
  } else if (departmentCode === 'INVENTORY') {
    whereClause = `so.status IN ('CREATED', 'DESIGN_IN_REVIEW', 'DESIGN_Approved ', 'PROCUREMENT_IN_PROGRESS', 'MATERIAL_PURCHASE_IN_PROGRESS', 'MATERIAL_READY', 'IN_PRODUCTION')`;
  } else if (departmentCode === 'PRODUCTION') {
    whereClause = `so.status IN ('CREATED', 'DESIGN_IN_REVIEW', 'MATERIAL_READY', 'IN_PRODUCTION')`;
  } else if (departmentCode === 'QUALITY' || departmentCode === 'QC') {
    whereClause = `so.status IN ('PRODUCTION_COMPLETED', 'QC_IN_PROGRESS', 'QC_REJECTED') OR so.current_department IN ('QUALITY', 'QC')`;
  } else if (departmentCode === 'SHIPMENT') {
    whereClause = `so.status IN ('READY_FOR_SHIPMENT', 'QC_APPROVED', 'READY_FOR_DISPATCH') OR so.current_department = 'SHIPMENT'`;
  } else {
    whereClause = `so.current_department = '${departmentCode}'`;
  }
  
  const acceptedFilter = includeAccepted ? '' : 'AND so.request_accepted = 0';

  const query = `SELECT so.*, so.target_dispatch_date as delivery_date, c.company_name, c.company_code, cp.po_number, cp.po_date, cp.currency AS po_currency, cp.net_total AS po_net_total, cp.pdf_path, 
            d.name as current_dept_name,
            soi.item_id, soi.item_code, soi.drawing_no, soi.description AS item_description, soi.quantity AS item_qty, soi.unit AS item_unit, soi.item_status, soi.item_rejection_reason,
            cd.drawing_name,
            sb.material_type as item_group,
            COALESCE(ct.email, "") as email_address, COALESCE(ct.phone, "") as contact_phone, COALESCE(ct.name, "") as contact_person,
            (SELECT reason FROM design_rejections WHERE sales_order_id = so.id ORDER BY created_at DESC LIMIT 1) as rejection_reason
     FROM sales_orders so
     LEFT JOIN companies c ON c.id = so.company_id
     LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
     LEFT JOIN departments d ON d.code = so.current_department
     LEFT JOIN (
       SELECT company_id, email, phone, name, 
              ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY contact_type = 'PRIMARY' DESC, id ASC) as rn
       FROM contacts
     ) ct ON ct.company_id = c.id AND ct.rn = 1
     LEFT JOIN (
       SELECT sales_order_id, id as item_id, item_code, drawing_no, description, quantity, quantity as design_qty, unit, status as item_status, rejection_reason as item_rejection_reason
       FROM sales_order_items
     ) soi ON soi.sales_order_id = so.id
     LEFT JOIN (
       SELECT d1.drawing_no, d1.description as drawing_name
       FROM customer_drawings d1
       JOIN (
         SELECT drawing_no, MAX(id) as max_id
         FROM customer_drawings
         GROUP BY drawing_no
       ) d2 ON d1.id = d2.max_id
     ) cd ON cd.drawing_no = soi.drawing_no
     LEFT JOIN stock_balance sb ON sb.item_code = soi.item_code
     WHERE (${whereClause}) ${acceptedFilter}
     ORDER BY so.created_at DESC`;
  
  const [rows] = await pool.query(query);
  console.log(`[getIncomingOrders-service] Query returned ${rows.length} rows for department "${departmentCode}"`);
  console.log(`[getIncomingOrders-service] Raw rows:`, rows);
  
  // Add client alias for each row
  rows.forEach(row => {
    row.client = row.company_name;
  });
  
  return rows;
};

const createSalesOrder = async (orderData) => {
  const { 
    customerPoId, 
    companyId, 
    projectName, 
    drawingRequired = 0, 
    productionPriority = 'NORMAL', 
    targetDispatchDate, 
    delivery_date, // Added delivery_date alias
    items,
    cgst_rate = 0,
    sgst_rate = 0,
    profit_margin = 0,
    bom_id = null,
    warehouse = null,
    status = 'CREATED',
    quotation_id = null,
    source_type = 'DIRECT',
    parent_id = null
  } = orderData;

  // Use either targetDispatchDate or delivery_date
  const finalTargetDispatchDate = targetDispatchDate || delivery_date;

  // Ensure customerPoId is a valid positive integer or null
  // We use Number() and check for truthiness to handle strings like "null", "undefined", or 0
  let validatedPoId = null;
  if (source_type === 'PO' && customerPoId && !isNaN(Number(customerPoId)) && Number(customerPoId) > 0) {
    validatedPoId = Number(customerPoId);
  }
  
  const finalQuotationId = (quotation_id && !isNaN(Number(quotation_id))) ? Number(quotation_id) : null;
  
  console.log('[createSalesOrder] Received data:', { customerPoId, validatedPoId, quotation_id: finalQuotationId, source_type, companyId, status });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const publicId = crypto.randomUUID();
    const [result] = await connection.execute(
      `INSERT INTO sales_orders (
        customer_po_id, company_id, project_name, drawing_required, 
        production_priority, target_dispatch_date, status, 
        current_department, request_accepted, cgst_rate, 
        sgst_rate, profit_margin, bom_id, warehouse,
        quotation_id, source_type, parent_id, public_id
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, 'DESIGN_ENG', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        validatedPoId, 
        companyId || null, 
        projectName || null, 
        drawingRequired, 
        productionPriority, 
        finalTargetDispatchDate || null, 
        status,
        cgst_rate,
        sgst_rate,
        profit_margin,
        bom_id,
        warehouse,
        finalQuotationId,
        source_type,
        parent_id,
        publicId
      ]
    );

    const salesOrderId = result.insertId;

    // Use items from request if provided, otherwise copy from Customer PO
    let orderItems = [];
    if (items && items.length > 0) {
      orderItems = items;
    } else {
      const [poItems] = await connection.query(
        'SELECT item_code, drawing_no, revision_no, description, quantity, unit, rate, delivery_date, (cgst_amount + sgst_amount + igst_amount) as tax_value FROM customer_po_items WHERE customer_po_id = ?',
        [validatedPoId]
      );
      orderItems = poItems;
    }

    for (const item of orderItems) {
      // Determine item_type from item_code prefix or default to FG
      let itemType = 'FG';
      if (item.item_code) {
        if (item.item_code.startsWith('SA-')) itemType = 'SA';
        else if (item.item_code.startsWith('RM-')) itemType = 'RM';
        // Note: SFG- items are treated as FG for Production Planning purposes
      }
      if (item.item_type) itemType = item.item_type;

      const [itemResult] = await connection.execute(
        `INSERT INTO sales_order_items (sales_order_id, item_code, item_type, drawing_no, drawing_id, revision_no, description, quantity, unit, rate, delivery_date, tax_value, status, rejection_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          salesOrderId, 
          item.item_code || null, 
          itemType,
          item.drawing_no || null, 
          item.drawing_id || null,
          item.revision_no || null, 
          item.description || null, 
          item.quantity || 0, 
          item.unit || null, 
          item.rate || 0, 
          item.delivery_date || null, 
          item.tax_value || 0,
          item.status || (item.item_status) || 'PENDING',
          item.rejection_reason || (item.item_rejection_reason) || null
        ]
      );

      const salesOrderItemId = itemResult.insertId;

      // If item has materials, insert them too
      if (item.materials && Array.isArray(item.materials)) {
        for (const mat of item.materials) {
          await connection.execute(
            `INSERT INTO sales_order_item_materials 
             (sales_order_item_id, material_name, material_type, item_group, qty_per_pc, uom, rate, warehouse, operation) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              salesOrderItemId, 
              mat.material_name || mat.materialName || null, 
              mat.material_type || mat.materialType || null, 
              mat.item_group || mat.itemGroup || null,
              mat.qty_per_pc || mat.qtyPerPc || mat.qty || 0, 
              mat.uom || null,
              mat.rate || 0,
              mat.warehouse || null,
              mat.operation || null
            ]
          );
        }
      }

      // If item has components, insert them too
      if (item.components && Array.isArray(item.components)) {
        for (const comp of item.components) {
          await connection.execute(
            `INSERT INTO sales_order_item_components 
             (sales_order_item_id, component_code, description, quantity, uom, rate, loss_percent, notes) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              salesOrderItemId,
              comp.component_code || comp.componentCode || null,
              comp.description || null,
              comp.quantity || 0,
              comp.uom || null,
              comp.rate || 0,
              comp.loss_percent || comp.lossPercent || 0,
              comp.notes || null
            ]
          );
        }
      }

      // If item has operations, insert them too
      if (item.operations && Array.isArray(item.operations)) {
        for (const op of item.operations) {
          await connection.execute(
            `INSERT INTO sales_order_item_operations 
             (sales_order_item_id, operation_name, workstation, cycle_time_min, setup_time_min, hourly_rate, operation_type, target_warehouse) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              salesOrderItemId,
              op.operation_name || op.operationName || null,
              op.workstation || null,
              op.cycle_time_min || op.cycleTimeMin || 0,
              op.setup_time_min || op.setupTimeMin || 0,
              op.hourly_rate || op.hourlyRate || 0,
              op.operation_type || op.operationType || null,
              op.target_warehouse || op.targetWarehouse || null
            ]
          );
        }
      }

      // If item has scrap, insert them too
      if (item.scrap && Array.isArray(item.scrap)) {
        for (const s of item.scrap) {
          await connection.execute(
            `INSERT INTO sales_order_item_scrap 
             (sales_order_item_id, item_code, item_name, input_qty, loss_percent, rate) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              salesOrderItemId,
              s.item_code || s.itemCode || null,
              s.item_name || s.itemName || null,
              s.input_qty || s.inputQty || 0,
              s.loss_percent || s.lossPercent || 0,
              s.rate || 0
            ]
          );
        }
      }
    }

    await connection.commit();
    return { id: salesOrderId, public_id: publicId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateSalesOrder = async (id, orderData) => {
  const { 
    customerPoId,
    companyId, 
    projectName, 
    drawingRequired, 
    productionPriority, 
    targetDispatchDate, 
    delivery_date, // Added delivery_date alias
    items,
    cgst_rate,
    sgst_rate,
    profit_margin,
    bom_id,
    warehouse,
    status,
    quotation_id = null,
    source_type = 'DIRECT'
  } = orderData;

  const finalTargetDispatchDate = targetDispatchDate || delivery_date;

  // Ensure customerPoId is a valid positive integer or null
  let validatedPoId = null;
  if (source_type === 'PO' && customerPoId && !isNaN(Number(customerPoId)) && Number(customerPoId) > 0) {
    validatedPoId = Number(customerPoId);
  }
  
  const finalQuotationId = (quotation_id && !isNaN(Number(quotation_id))) ? Number(quotation_id) : null;
  
  console.log('[updateSalesOrder] Received data:', { id, customerPoId, validatedPoId, quotation_id: finalQuotationId, source_type, companyId, status });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE sales_orders SET 
        company_id = ?, 
        customer_po_id = ?,
        project_name = ?, 
        drawing_required = ?, 
        production_priority = ?, 
        target_dispatch_date = ?, 
        status = ?, 
        cgst_rate = ?, 
        sgst_rate = ?, 
        profit_margin = ?, 
        bom_id = ?, 
        warehouse = ?,
        quotation_id = ?,
        source_type = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        companyId || null, 
        validatedPoId,
        projectName || null, 
        drawingRequired || 0, 
        productionPriority || 'NORMAL', 
        finalTargetDispatchDate || null, 
        status || null,
        cgst_rate || 0,
        sgst_rate || 0,
        profit_margin || 0,
        bom_id || null,
        warehouse || null,
        finalQuotationId,
        source_type,
        id
      ]
    );

    // Update items - for simplicity, delete and re-insert if provided
    if (items && items.length > 0) {
      await connection.execute('DELETE FROM sales_order_items WHERE sales_order_id = ?', [id]);
      
      for (const item of items) {
        // Determine item_type from item_code prefix or default to FG
        let itemType = 'FG';
        if (item.item_code) {
          if (item.item_code.startsWith('SA-')) itemType = 'SA';
          else if (item.item_code.startsWith('RM-')) itemType = 'RM';
          // Note: SFG- items are treated as FG for Production Planning purposes
        }
        if (item.item_type) itemType = item.item_type;

        await connection.execute(
          `INSERT INTO sales_order_items (sales_order_id, item_code, item_type, drawing_no, revision_no, description, quantity, unit, rate, delivery_date, tax_value, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, 
            item.item_code || null, 
            itemType,
            item.drawing_no || null, 
            item.revision_no || null, 
            item.description || null, 
            item.quantity || 0, 
            item.unit || 'NOS', 
            item.rate || 0, 
            item.delivery_date || null, 
            item.tax_value || 0,
            item.status || 'PENDING'
          ]
        );
      }
    }

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateSalesOrderStatus = async (salesOrderId, status, userId = null, remarks = null) => {
  status = (status || '').trim().toUpperCase();
  let department = null;
  if (status === 'BOM_APPROVED' || status === 'QUOTATION_SENT') {
    department = 'SALES';
  } else if (status === 'BOM_SUBMITTED') {
    department = 'SALES'; // Transition to SALES for BOM approval
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    if (department) {
      await connection.execute('UPDATE sales_orders SET status = ?, current_department = ? WHERE id = ?', [status, department, salesOrderId]);
    } else {
      await connection.execute('UPDATE sales_orders SET status = ? WHERE id = ?', [status, salesOrderId]);
    }

    // Log to BOM approval history if it's a BOM action
    if (status === 'BOM_APPROVED' || status === 'QUOTATION_SENT' || status === 'REJECTED_BOM') {
      const action = (status === 'BOM_APPROVED' || status === 'QUOTATION_SENT') ? 'APPROVED' : 'REJECTED';
      if (userId) {
        await connection.execute(
          'INSERT INTO bom_approval_history (sales_order_id, user_id, action, remarks) VALUES (?, ?, ?, ?)',
          [salesOrderId, userId, action, remarks]
        );
      }
      
      /* REMOVED AUTO-QUOTATION CREATION
      if (status === 'QUOTATION_SENT') {
        const [orderRows] = await connection.query('SELECT * FROM sales_orders WHERE id = ?', [salesOrderId]);
        const order = orderRows[0];
        
        const [itemRows] = await connection.query(
          'SELECT * FROM sales_order_items WHERE sales_order_id = ? AND (status != "REJECTED" OR status IS NULL)', 
          [salesOrderId]
        );
        
        for (const item of itemRows) {
          const bomCost = parseFloat(item.bom_cost) || 0;
          const profitMargin = parseFloat(order.profit_margin) || 0;
          const quotedPrice = bomCost * (1 + profitMargin / 100);
          const lineTotal = quotedPrice * (item.quantity || 1);
          const lineTotalInclGst = lineTotal * 1.18; // Standard 18% GST

          await connection.execute(
            `INSERT INTO quotation_requests (sales_order_id, sales_order_item_id, item_qty, company_id, status, total_amount, received_amount, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
            [salesOrderId, item.id, item.quantity || 0, order.company_id, 'PENDING', lineTotal, lineTotalInclGst]
          );
        }
      }
      */
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const acceptRequest = async (salesOrderId, departmentCode) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const [order] = await connection.query('SELECT * FROM sales_orders WHERE id = ?', [salesOrderId]);
    if (!order.length) throw new Error('Order not found');

    const currentOrder = order[0];
    let newStatus = currentOrder.status;
    let nextDepartment = currentOrder.current_department;

    if (departmentCode === 'INVENTORY' && currentOrder.status === 'CREATED') {
      newStatus = 'DESIGN_IN_REVIEW';
      nextDepartment = 'DESIGN_ENG';
    } else if (departmentCode === 'DESIGN_ENG' && (currentOrder.status === 'CREATED' || currentOrder.status === 'DESIGN_IN_REVIEW')) {
      newStatus = 'DESIGN_IN_REVIEW';
      nextDepartment = 'DESIGN_ENG';
    } else if (departmentCode === 'PROCUREMENT' && (currentOrder.status === 'CREATED' || currentOrder.status === 'DESIGN_IN_REVIEW' || currentOrder.status === 'DESIGN_Approved ' || currentOrder.status === 'PROCUREMENT_IN_PROGRESS')) {
      if (currentOrder.material_available) {
        newStatus = 'MATERIAL_READY';
        nextDepartment = 'PRODUCTION';
      } else {
        newStatus = 'MATERIAL_PURCHASE_IN_PROGRESS';
        nextDepartment = 'PROCUREMENT';
      }
    } else if (departmentCode === 'PRODUCTION' && (currentOrder.status === 'MATERIAL_READY' || currentOrder.status === 'IN_PRODUCTION')) {
      newStatus = 'PRODUCTION_COMPLETED';
      nextDepartment = 'QUALITY';
    } else if ((departmentCode === 'QUALITY' || departmentCode === 'QC') && (currentOrder.status === 'PRODUCTION_COMPLETED' || currentOrder.status === 'QC_IN_PROGRESS' || currentOrder.status === 'QC_REJECTED')) {
      newStatus = 'QC_IN_PROGRESS';
      nextDepartment = 'QUALITY';
    } else if (departmentCode === 'SHIPMENT' && (currentOrder.status === 'READY_FOR_SHIPMENT' || currentOrder.status === 'QC_APPROVED' || currentOrder.status === 'READY_FOR_DISPATCH')) {
      newStatus = 'READY_FOR_SHIPMENT';
      nextDepartment = 'SHIPMENT';
    }

    await connection.execute(
      'UPDATE sales_orders SET status = ?, current_department = ?, request_accepted = 1, updated_at = NOW() WHERE id = ?',
      [newStatus, nextDepartment, salesOrderId]
    );

    if (nextDepartment === 'DESIGN_ENG') {
      await designOrderService.createDesignOrder(salesOrderId, connection, 'IN_DESIGN');
    }

    await connection.commit();
    return { status: newStatus, currentDepartment: nextDepartment };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const rejectRequest = async (salesOrderId) => {
  await pool.execute(
    'UPDATE sales_orders SET status = ?, current_department = ?, request_accepted = 0, updated_at = NOW() WHERE id = ?',
    ['DESIGN_QUERY', 'SALES', salesOrderId]
  );
};

const transitionToDepartment = async (salesOrderId, toDepartment, newStatus) => {
  await pool.execute(
    'UPDATE sales_orders SET status = ?, current_department = ?, updated_at = NOW() WHERE id = ?',
    [newStatus, toDepartment, salesOrderId]
  );
};

const sendOrderToDesign = async (salesOrderId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      'UPDATE sales_orders SET status = ?, current_department = ?, request_accepted = 0, updated_at = NOW() WHERE id = ?',
      ['DESIGN_IN_REVIEW', 'DESIGN_ENG', salesOrderId]
    );

    // Also update all items to DESIGN_IN_REVIEW status so they show up in Drawing Master
    await connection.execute(
      "UPDATE sales_order_items SET status = 'DESIGN_IN_REVIEW' WHERE sales_order_id = ? AND (status IS NULL OR status = 'PENDING')",
      [salesOrderId]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const approveDesignAndCreateQuotation = async (salesOrderId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const [orders] = await connection.query('SELECT * FROM sales_orders WHERE id = ?', [salesOrderId]);
    if (!orders.length) throw new Error('Sales order not found');
    
    const order = orders[0];
    
    await connection.execute(
      'UPDATE sales_orders SET status = ?, current_department = ?, request_accepted = 1, updated_at = NOW() WHERE id = ?',
      ['DESIGN_IN_REVIEW', 'DESIGN_ENG', salesOrderId]
    );
    
    // Mark non-rejected items as ACCEPTED
    await connection.execute(
      "UPDATE sales_order_items SET status = 'ACCEPTED' WHERE sales_order_id = ? AND (status IS NULL OR status = 'PENDING')",
      [salesOrderId]
    );
    
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateSalesOrderItemStatus = async (itemId, status, reason) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Update status and rejection reason on the item
    await connection.execute(
      'UPDATE sales_order_items SET status = ?, rejection_reason = ?, updated_at = NOW() WHERE id = ?',
      [status, status === 'REJECTED' ? reason : null, itemId]
    );

    // Get sales_order_id for this item
    const [itemRows] = await connection.query('SELECT sales_order_id FROM sales_order_items WHERE id = ?', [itemId]);
    if (itemRows.length > 0) {
      const salesOrderId = itemRows[0].sales_order_id;

      if (status === 'REJECTED' && reason) {
        // Log rejection reason
        await connection.execute(
          `INSERT INTO design_rejections (sales_order_id, reason, created_at)
           VALUES (?, ?, NOW())`,
          [salesOrderId, `Item ID ${itemId} Rejected: ${reason}`]
        );
      } else if (status.trim().toUpperCase() === 'APPROVED') {
        // Promote drawing to Item Master
        const itemData = await getSalesOrderItem(itemId);
        if (itemData) {
          await stockService.promoteDrawingToItem(itemData, connection);
        }

        // If an item is approved, ensure the order is accepted by design and visible in process list
        const [orderRows] = await connection.query('SELECT status, request_accepted FROM sales_orders WHERE id = ?', [salesOrderId]);
        if (orderRows.length > 0) {
          const order = orderRows[0];
          if (order.request_accepted === 0) {
            await connection.execute(
              "UPDATE sales_orders SET request_accepted = 1, status = 'DESIGN_IN_REVIEW', current_department = 'DESIGN_ENG', updated_at = NOW() WHERE id = ?",
              [salesOrderId]
            );
            
            // Create design order entry if it doesn't exist
            await designOrderService.createDesignOrder(salesOrderId, connection, 'IN_DESIGN');
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

const rejectDesign = async (salesOrderId, reason) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    await connection.execute(
      'UPDATE sales_orders SET status = ?, current_department = ?, request_accepted = 0, updated_at = NOW() WHERE id = ?',
      ['DESIGN_QUERY', 'SALES', salesOrderId]
    );
    
    const [requestResult] = await connection.execute(
      `INSERT INTO design_rejections (sales_order_id, reason, created_at)
       VALUES (?, ?, NOW())`,
      [salesOrderId, reason]
    );
    
    await connection.commit();
    return requestResult.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const bulkApproveDesigns = async (orderIds) => {
  console.log('[bulkApproveDesigns-service] Received orderIds:', orderIds);
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    throw new Error('No order IDs provided');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const placeholders = orderIds.map(() => '?').join(',');
    console.log('[bulkApproveDesigns-service] Running SELECT with placeholders:', placeholders, 'and IDs:', orderIds);
    
    const [orders] = await connection.query(
      `SELECT id, company_id FROM sales_orders WHERE id IN (${placeholders})`,
      orderIds
    );
    
    console.log('[bulkApproveDesigns-service] Found orders:', orders);
    if (orders.length === 0) {
      console.error('[bulkApproveDesigns-service] No sales orders found for IDs:', orderIds);
      throw new Error('No sales orders found');
    }
    
    await connection.execute(
      `UPDATE sales_orders SET status = ?, current_department = ?, request_accepted = 1, updated_at = NOW() WHERE id IN (${placeholders})`,
      ['DESIGN_IN_REVIEW', 'DESIGN_ENG', ...orderIds]
    );
    
    // Mark non-rejected items as APPROVED
    await connection.execute(
      `UPDATE sales_order_items SET status = 'Approved ' WHERE sales_order_id IN (${placeholders}) AND (status IS NULL OR status = 'PENDING')`,
      orderIds
    );

    // Create design orders for each sales order
    for (const orderId of orderIds) {
      await designOrderService.createDesignOrder(orderId, connection, 'IN_DESIGN');
    }
    
    await connection.commit();
    return { approvedCount: orders.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const bulkRejectDesigns = async (orderIds, reason) => {
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    throw new Error('No order IDs provided');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const placeholders = orderIds.map(() => '?').join(',');
    
    await connection.execute(
      `UPDATE sales_orders SET status = ?, current_department = ?, request_accepted = 0, updated_at = NOW() WHERE id IN (${placeholders})`,
      ['DESIGN_QUERY', 'SALES', ...orderIds]
    );
    
    for (const orderId of orderIds) {
      await connection.execute(
        `INSERT INTO design_rejections (sales_order_id, reason, created_at)
         VALUES (?, ?, NOW())`,
        [orderId, reason]
      );
    }
    
    await connection.commit();
    return { rejectedCount: orderIds.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getApprovedDrawings = async (companyId = null) => {
  let query = `SELECT so.*, c.company_name, c.company_code, c.id as company_id_check,
     IFNULL(ct.email, '') as email,
     IFNULL(ct.phone, '') as phone,
     IFNULL(ct.name, '') as contact_person,
     cp.po_number, cp.po_date, cp.currency AS po_currency, cp.net_total AS po_net_total,
     (SELECT reason FROM design_rejections WHERE sales_order_id = so.id ORDER BY created_at DESC LIMIT 1) as rejection_reason
     FROM sales_orders so
     LEFT JOIN companies c ON c.id = so.company_id
     LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
     LEFT JOIN (
       SELECT company_id, email, phone, name, 
              ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY contact_type = 'PRIMARY' DESC, id ASC) as rn
       FROM contacts
     ) ct ON ct.company_id = c.id AND ct.rn = 1
     WHERE (TRIM(UPPER(so.status)) IN ('DESIGN_APPROVED', 'BOM_SUBMITTED', 'BOM_APPROVED', 'QUOTATION_SENT', 'PROCUREMENT_IN_PROGRESS', 'MATERIAL_PURCHASE_IN_PROGRESS', 'MATERIAL_READY', 'IN_PRODUCTION', 'PRODUCTION_COMPLETED', 'QC_IN_PROGRESS', 'QC_APPROVED', 'QC_REJECTED', 'READY_FOR_SHIPMENT'))
        AND so.quotation_id IS NULL`;
  
  const params = [];
  if (companyId) {
    query += ` AND so.company_id = ?`;
    params.push(companyId);
  }
  
  query += ` ORDER BY so.created_at DESC`;
  
  const [rows] = await pool.query(query, params);
  
  for (const order of rows) {
    const [items] = await pool.query(
      `SELECT soi.id, soi.sales_order_id, soi.bom_id, soi.item_code, soi.item_type, soi.item_group, 
              soi.unit, soi.description, soi.is_active, soi.is_default, soi.quantity, 
              soi.drawing_no, soi.drawing_id, soi.status, soi.created_by, soi.created_at, soi.updated_at,
              (
                SELECT bom_cost FROM sales_order_items v2 
                WHERE ((v2.bom_id = soi.bom_id AND soi.bom_id IS NOT NULL AND v2.bom_id IS NOT NULL)
                   OR (LOWER(TRIM(v2.item_code)) = LOWER(TRIM(soi.item_code)) AND LOWER(TRIM(v2.drawing_no)) = LOWER(TRIM(soi.drawing_no)) AND v2.item_code IS NOT NULL AND v2.drawing_no IS NOT NULL))
                   AND v2.bom_cost > 0
                ORDER BY v2.id DESC LIMIT 1
              ) as bom_cost,
              (
                SELECT revision_no FROM sales_order_items v3 
                WHERE ((v3.bom_id = soi.bom_id AND soi.bom_id IS NOT NULL)
                   OR (v3.item_code = soi.item_code AND v3.drawing_no = soi.drawing_no AND v3.item_code IS NOT NULL AND v3.drawing_no IS NOT NULL))
                   AND v3.bom_cost > 0
                ORDER BY v3.id DESC LIMIT 1
              ) as revision_no,
              (
                SELECT COUNT(*) 
                FROM sales_order_item_components 
                WHERE sales_order_item_id IN (SELECT id FROM sales_order_items WHERE sales_order_id = soi.sales_order_id)
                AND component_code = soi.item_code
              ) as is_component,
              COALESCE(NULLIF(soi.item_group, ''), NULLIF(soi.item_type, '')) as item_group_calc,
              COALESCE(
                poi.quantity, 
                (SELECT MAX(quantity) FROM sales_order_items WHERE sales_order_id = soi.sales_order_id AND TRIM(drawing_no) = TRIM(soi.drawing_no)),
                soi.quantity
              ) as design_qty
       FROM sales_order_items soi
       INNER JOIN (
         SELECT sales_order_id, drawing_no, item_code, item_group, item_type, MAX(id) as max_id
         FROM sales_order_items
         GROUP BY sales_order_id, drawing_no, item_code, item_group, item_type
       ) latest ON soi.id = latest.max_id
       LEFT JOIN sales_orders so ON soi.sales_order_id = so.id
       LEFT JOIN customer_po_items poi ON so.customer_po_id = poi.customer_po_id 
            AND (TRIM(soi.drawing_no) = TRIM(poi.drawing_no) AND soi.drawing_no IS NOT NULL)
       WHERE soi.sales_order_id = ? 
       AND (
         TRIM(UPPER(soi.item_group)) IN ('FG', 'FINISHED GOODS', 'FINISHED_GOODS', 'SA', 'SUB ASSEMBLY', 'SUB_ASSEMBLY', 'ASSEMBLY') 
         OR (
           TRIM(UPPER(soi.item_type)) IN ('FG', 'FINISHED GOODS', 'FINISHED_GOODS', 'SA', 'SUB ASSEMBLY', 'SUB_ASSEMBLY', 'ASSEMBLY')
         )
       )
       AND (soi.status IS NULL OR TRIM(UPPER(soi.status)) NOT IN ('REJECTED', 'CANCELLED'))`,
      [order.id]
    );
    order.items = items;
    
    // Fetch sub-assemblies for each item if it's an FG
    for (const item of order.items) {
      const g = (item.item_group || '').toUpperCase();
      const t = (item.item_type || '').toUpperCase();
      const isSA = g.includes('SA') || g.includes('SUB') || g.includes('ASSEMBLY') || t.includes('SA') || t.includes('SUB') || t.includes('ASSEMBLY');
      const components = await bomService.getItemComponents(item.id, item.item_code, item.drawing_no);

      const isDrawingOrSA = isSA || g.includes('PART') || t.includes('PART') || (item.drawing_no && item.drawing_no !== '—');
      if (isDrawingOrSA) {
        item.sub_assemblies = components;
      } else {
        item.sub_assemblies = components.filter(c => {
          const code = (c.item_code || c.component_code || '').toUpperCase();
          const group = (c.item_group || '').toUpperCase();
          const desc = (c.description || '').toUpperCase();
          return (code.startsWith('SA-') || code.startsWith('SFG-') || 
                  group.includes('SA') || group.includes('SUB') || group.includes('ASSEMBLY') ||
                  desc.includes('ASSEMBLY') || desc.includes('UNIT')) &&
                 !group.includes('FG');
        });
      }
    }
    
    if (order.company_id) {
      const [companyContacts] = await pool.query(
        'SELECT id, name, email, phone, contact_type, status FROM contacts WHERE company_id = ? ORDER BY contact_type = "PRIMARY" DESC LIMIT 5',
        [order.company_id]
      );
      order._debug_contacts = companyContacts;
    }
  }
  
  return rows;
};

const getOrderTimeline = async salesOrderId => {
  // 1. Get order-specific items
  const [items] = await pool.query(
    `SELECT soi.*, COALESCE(soi.item_group, sb.material_type) as item_group, sb.product_type,
            so.status as sales_order_status,
            so.public_id as sales_order_public_id,
            COALESCE(soi.drawing_id, cd.latest_drawing_id) as drawing_id,
            cd.drawing_name,
            cd.drawing_public_id
     FROM sales_order_items soi
     JOIN sales_orders so ON soi.sales_order_id = so.id
     LEFT JOIN stock_balance sb ON sb.item_code = soi.item_code
     LEFT JOIN (
       SELECT d1.drawing_no, d1.id as latest_drawing_id, d1.description as drawing_name, d1.public_id as drawing_public_id
       FROM customer_drawings d1
       JOIN (
         SELECT drawing_no, MAX(id) as max_id
         FROM customer_drawings
         GROUP BY drawing_no
       ) d2 ON d1.id = d2.max_id
     ) cd ON cd.drawing_no = soi.drawing_no
     WHERE soi.sales_order_id = ?`,
    [salesOrderId]
  );
  
  // 2. Also fetch any Master BOMs (sales_order_id is NULL) for these same drawings
  // to show them as available versions/options
  const drawingNos = [...new Set(items.map(i => i.drawing_no).filter(Boolean))];
  
  if (drawingNos.length > 0) {
    const [masterItems] = await pool.query(
      `SELECT soi.*, COALESCE(soi.item_group, sb.material_type) as item_group, sb.product_type,
              'MASTER' as sales_order_status,
              NULL as sales_order_public_id,
              COALESCE(soi.drawing_id, cd.latest_drawing_id) as drawing_id,
              cd.drawing_name,
              cd.drawing_public_id
       FROM sales_order_items soi
       LEFT JOIN stock_balance sb ON sb.item_code = soi.item_code
       LEFT JOIN (
         SELECT d1.drawing_no, d1.id as latest_drawing_id, d1.description as drawing_name, d1.public_id as drawing_public_id
         FROM customer_drawings d1
         JOIN (
           SELECT drawing_no, MAX(id) as max_id
           FROM customer_drawings
           GROUP BY drawing_no
         ) d2 ON d1.id = d2.max_id
       ) cd ON cd.drawing_no = soi.drawing_no
       WHERE soi.sales_order_id IS NULL AND soi.drawing_no IN (?)`,
      [drawingNos]
    );
    
    // Append master items to the list so they show up in the versions list in frontend
    items.push(...masterItems);
  }

  if (items.length === 0) return [];

  const itemIds = items.map(i => i.id);
  const itemCodes = items.map(i => i.item_code).filter(Boolean);
  const drawingNosForLookup = items.map(i => i.drawing_no).filter(Boolean);

  // Fetch all related data in bulk
  const [allMaterials] = await pool.query(
    `SELECT * FROM sales_order_item_materials 
     WHERE sales_order_item_id IN (?) 
     OR (item_code IN (?) AND sales_order_item_id IS NULL)
     OR (drawing_no IN (?) AND sales_order_item_id IS NULL AND item_code IS NULL)
     ORDER BY created_at ASC`,
    [itemIds, itemCodes.length > 0 ? itemCodes : [null], drawingNosForLookup.length > 0 ? drawingNosForLookup : [null]]
  );

  const [allComponents] = await pool.query(
    `SELECT * FROM sales_order_item_components 
     WHERE sales_order_item_id IN (?) 
     OR (item_code IN (?) AND sales_order_item_id IS NULL)
     OR (drawing_no IN (?) AND sales_order_item_id IS NULL AND item_code IS NULL)
     ORDER BY created_at ASC`,
    [itemIds, itemCodes.length > 0 ? itemCodes : [null], drawingNos.length > 0 ? drawingNos : [null]]
  );

  const [allOperations] = await pool.query(
    `SELECT * FROM sales_order_item_operations 
     WHERE sales_order_item_id IN (?) 
     OR (item_code IN (?) AND sales_order_item_id IS NULL)
     OR (drawing_no IN (?) AND sales_order_item_id IS NULL AND item_code IS NULL)
     ORDER BY created_at ASC`,
    [itemIds, itemCodes.length > 0 ? itemCodes : [null], drawingNos.length > 0 ? drawingNos : [null]]
  );

  const [allScrap] = await pool.query(
    `SELECT * FROM sales_order_item_scrap 
     WHERE sales_order_item_id IN (?) 
     OR (item_code IN (?) AND sales_order_item_id IS NULL)
     OR (drawing_no IN (?) AND sales_order_item_id IS NULL AND item_code IS NULL)
     ORDER BY created_at ASC`,
    [itemIds, itemCodes.length > 0 ? itemCodes : [null], drawingNos.length > 0 ? drawingNos : [null]]
  );

  // Map data for quick lookup
  const materialsByItem = allMaterials.reduce((acc, m) => {
    const key = m.sales_order_item_id ? `id_${m.sales_order_item_id}` : (m.item_code ? `code_${m.item_code}` : `dwg_${m.drawing_no}`);
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  const componentsByItem = allComponents.reduce((acc, c) => {
    const key = c.sales_order_item_id ? `id_${c.sales_order_item_id}` : (c.item_code ? `code_${c.item_code}` : `dwg_${c.drawing_no}`);
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});

  const operationsByItem = allOperations.reduce((acc, o) => {
    const key = o.sales_order_item_id ? `id_${o.sales_order_item_id}` : (o.item_code ? `code_${o.item_code}` : `dwg_${o.drawing_no}`);
    if (!acc[key]) acc[key] = [];
    acc[key].push(o);
    return acc;
  }, {});

  const scrapByItem = allScrap.reduce((acc, s) => {
    const key = s.sales_order_item_id ? `id_${s.sales_order_item_id}` : (s.item_code ? `code_${s.item_code}` : `dwg_${s.drawing_no}`);
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  // Process each item
  for (const item of items) {
    // Try order-specific first, then fall back to master (code), then fall back to master (drawing)
    let materials = materialsByItem[`id_${item.id}`] || materialsByItem[`code_${item.item_code}`] || materialsByItem[`dwg_${item.drawing_no}`] || [];
    let components = componentsByItem[`id_${item.id}`] || componentsByItem[`code_${item.item_code}`] || componentsByItem[`dwg_${item.drawing_no}`] || [];
    let operations = operationsByItem[`id_${item.id}`] || operationsByItem[`code_${item.item_code}`] || operationsByItem[`dwg_${item.drawing_no}`] || [];
    let scrap = scrapByItem[`id_${item.id}`] || scrapByItem[`code_${item.item_code}`] || scrapByItem[`dwg_${item.drawing_no}`] || [];

    // Ensure we don't mix order-specific and master if any order-specific exists
    const hasOrderSpecific = (materialsByItem[`id_${item.id}`]?.length > 0 || 
                            componentsByItem[`id_${item.id}`]?.length > 0 || 
                            operationsByItem[`id_${item.id}`]?.length > 0);
    
    if (hasOrderSpecific) {
      materials = materialsByItem[`id_${item.id}`] || [];
      components = componentsByItem[`id_${item.id}`] || [];
      operations = operationsByItem[`id_${item.id}`] || [];
      scrap = scrapByItem[`id_${item.id}`] || [];
    }

    item.materials = materials;
    item.components = components;
    item.operations = operations;
    item.scrap = scrap;

    // Calculate costs
    const orderQty = parseFloat(item.quantity || 1);
    const matCost = materials.reduce((sum, m) => sum + (parseFloat(m.qty_per_pc || 0) * orderQty * parseFloat(m.rate || 0)), 0);
    const compCost = components.reduce((sum, c) => {
      const base = parseFloat(c.quantity || 0) * orderQty * parseFloat(c.rate || 0);
      const loss = base * (parseFloat(c.loss_percent || 0) / 100);
      return sum + (base - loss);
    }, 0);
    const laborCost = operations.reduce((sum, o) => {
      const cycle = parseFloat(o.cycle_time_min || 0);
      const setup = parseFloat(o.setup_time_min || 0);
      const rate = parseFloat(o.hourly_rate || 0);
      return sum + (((cycle * orderQty) + setup) / 60 * rate);
    }, 0);
    const scrapRecovery = scrap.reduce((sum, s) => {
      const input = parseFloat(s.input_qty || 0);
      const loss = parseFloat(s.loss_percent || 0) / 100;
      const rate = parseFloat(s.rate || 0);
      return sum + (input * loss * rate);
    }, 0);
    
    const totalOrderCost = matCost + compCost + laborCost - scrapRecovery;
    const calculatedBomCost = orderQty > 0 ? totalOrderCost / orderQty : 0;
    
    item.bom_cost = (item.bom_cost && parseFloat(item.bom_cost) > 0) ? parseFloat(item.bom_cost) : calculatedBomCost;
    item.has_bom = hasOrderSpecific || (item.bom_id !== null && item.sales_order_id !== null);

    // Add has_master_bom to indicate if a template exists for this code or drawing
    item.has_master_bom = (
                         (item.item_code && materialsByItem[`code_${item.item_code}`]?.length > 0) || 
                         (item.drawing_no && materialsByItem[`dwg_${item.drawing_no}`]?.length > 0) ||
                         (item.item_code && componentsByItem[`code_${item.item_code}`]?.length > 0) || 
                         (item.drawing_no && componentsByItem[`dwg_${item.drawing_no}`]?.length > 0) ||
                         (item.item_code && operationsByItem[`code_${item.item_code}`]?.length > 0) || 
                         (item.drawing_no && operationsByItem[`dwg_${item.drawing_no}`]?.length > 0) ||
                         (item.item_code && scrapByItem[`code_${item.item_code}`]?.length > 0) || 
                         (item.drawing_no && scrapByItem[`dwg_${item.drawing_no}`]?.length > 0));
  }
  
  return items;
};


const generateSalesOrderPDF = async (salesOrderId) => {
  const [orderRows] = await pool.query(
    `SELECT so.*, c.company_name, c.company_code, c.gstin, c.pan, c.cin,
            ba.line1 as billing_line1, ba.line2 as billing_line2, ba.city as billing_city, 
            ba.state as billing_state, ba.pincode as billing_pincode,
            cp.po_number, cp.po_date, cp.currency AS po_currency, cp.project_name as cp_project_name
     FROM sales_orders so
     LEFT JOIN companies c ON c.id = so.company_id
     LEFT JOIN company_addresses ba ON ba.company_id = c.id AND ba.address_type = 'BILLING'
     LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
     WHERE so.id = ?`,
    [salesOrderId]
  );

  if (!orderRows.length) throw new Error('Sales Order not found');
  const order = orderRows[0];
  
  // Format billing address
  const addrParts = [
    order.billing_line1,
    order.billing_line2,
    order.billing_city,
    order.billing_state,
    order.billing_pincode ? `Pincode: ${order.billing_pincode}` : null
  ].filter(Boolean);
  order.billing_address = addrParts.join(', ');

  const [items] = await pool.query(
    `SELECT soi.*, cpi.hsn_code
     FROM sales_order_items soi
     LEFT JOIN customer_po_items cpi ON cpi.customer_po_id = (SELECT customer_po_id FROM sales_orders WHERE id = soi.sales_order_id)
          AND (cpi.item_code = soi.item_code OR cpi.drawing_no = soi.drawing_no)
     WHERE soi.sales_order_id = ?`,
    [salesOrderId]
  );

  const puppeteer = require('puppeteer');
  const mustache = require('mustache');

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        @page { size: A4; margin: 10mm; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #000; line-height: 1.3; margin: 0; font-size: 10px; }
        .invoice-container { border: 1px solid #000; min-height: 270mm; position: relative; }
        
        .tax-invoice-label { text-align: center; border-bottom: 1px solid #000; font-weight: bold; font-size: 14px; padding: 5px; }
        
        .header-section { display: flex; border-bottom: 1px solid #000; }
        .header-left { flex: 1.5; padding: 10px; border-right: 1px solid #000; }
        .header-right { flex: 1; padding: 10px; }
        
        .company-name { font-size: 16px; font-weight: bold; margin-bottom: 5px; }
        .address-text { font-size: 9px; margin-bottom: 2px; }
        
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; width: 100%; border-bottom: 1px solid #000; }
        .info-box { padding: 8px; border-right: 1px solid #000; min-height: 80px; }
        .info-box:last-child { border-right: none; }
        .label { font-weight: bold; text-decoration: underline; margin-bottom: 5px; display: block; font-size: 11px; }
        
        .meta-table { width: 100%; border-collapse: collapse; }
        .meta-table td { padding: 4px; border: 1px solid #000; }
        .meta-label { font-weight: bold; width: 40%; }
        
        .items-table { width: 100%; border-collapse: collapse; border-bottom: 1px solid #000; }
        .items-table th { border: 1px solid #000; padding: 6px; background: #f0f0f0; font-weight: bold; text-align: center; font-size: 9px; }
        .items-table td { border-left: 1px solid #000; border-right: 1px solid #000; padding: 6px; vertical-align: top; }
        .items-table tr.item-row { min-height: 30px; }
        
        .total-section { display: flex; border-bottom: 1px solid #000; }
        .words-section { flex: 1.5; padding: 10px; border-right: 1px solid #000; }
        .calc-section { flex: 1; }
        
        .calc-table { width: 100%; border-collapse: collapse; }
        .calc-table td { padding: 5px; border-bottom: 1px solid #000; text-align: right; }
        .calc-table td:first-child { text-align: left; font-weight: bold; border-right: 1px solid #000; }
        .calc-table tr:last-child td { border-bottom: none; font-size: 12px; font-weight: bold; }
        
        .tax-summary-table { width: 100%; border-collapse: collapse; border-bottom: 1px solid #000; margin-top: 0; }
        .tax-summary-table th, .tax-summary-table td { border: 1px solid #000; padding: 4px; text-align: center; }
        .tax-summary-table th { font-size: 8px; background: #f0f0f0; }
        
        .footer-section { display: flex; padding: 20px 10px; border-top: 1px solid #000; position: absolute; bottom: 0; width: 100%; box-sizing: border-box; }
        .footer-col { flex: 1; text-align: center; }
        .signature-box { margin-top: 40px; border-top: 1px dashed #000; display: inline-block; min-width: 150px; padding-top: 5px; }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="tax-invoice-label">TAX INVOICE</div>
        
        <div class="header-section">
          <div class="header-left">
            <div class="company-name">SP TECHPIONEER PVT LTD</div>
            <div class="address-text">PLOT NO.97, SECTOR NO 07, PCNDTA</div>
            <div class="address-text">BHOSARI, PUNE-411026</div>
            <div class="address-text">GSTIN/UIN: 27AAPCS1193L1ZQ</div>
            <div class="address-text">State Name: Maharashtra, Code: 27</div>
          </div>
          <div class="header-right">
            <table class="meta-table">
              <tr>
                <td class="meta-label">Invoice No.</td>
                <td>SO-{{order_id}}</td>
              </tr>
              <tr>
                <td class="meta-label">Dated</td>
                <td>{{created_at}}</td>
              </tr>
              <tr>
                <td class="meta-label">Buyer's Order No.</td>
                <td>{{po_number}}</td>
              </tr>
              <tr>
                <td class="meta-label">PO Date</td>
                <td>{{po_date}}</td>
              </tr>
            </table>
          </div>
        </div>
        
        <div class="info-grid">
          <div class="info-box">
            <span class="label">Consignee (Ship to)</span>
            <div style="font-weight: bold; font-size: 11px;">{{company_name}}</div>
            <div class="address-text">{{billing_address}}</div>
            <div class="address-text">GSTIN/UIN: {{gstin}}</div>
            <div class="address-text">State Name: {{billing_state}}</div>
          </div>
          <div class="info-box">
            <span class="label">Buyer (Bill to)</span>
            <div style="font-weight: bold; font-size: 11px;">{{company_name}}</div>
            <div class="address-text">{{billing_address}}</div>
            <div class="address-text">GSTIN/UIN: {{gstin}}</div>
            <div class="address-text">State Name: {{billing_state}}</div>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 30px;">Sl No.</th>
              <th>Description of Goods</th>
              <th style="width: 70px;">HSN/SAC</th>
              <th style="width: 60px;">Quantity</th>
              <th style="width: 80px;">Rate</th>
              <th style="width: 40px;">per</th>
              <th style="width: 90px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            {{#items}}
            <tr class="item-row">
              <td style="text-align: center;">{{index}}</td>
              <td>
                <div style="font-weight: bold;">{{description}}</div>
                {{#drawing_no}}<div style="font-size: 8px; color: #444;">DRW: {{drawing_no}}</div>{{/drawing_no}}
              </td>
              <td style="text-align: center;">{{hsn_code}}</td>
              <td style="text-align: center;">{{quantity}} {{unit}}</td>
              <td style="text-align: right;">{{rate}}</td>
              <td style="text-align: center;">{{unit}}</td>
              <td style="text-align: right; font-weight: bold;">{{item_amount}}</td>
            </tr>
            {{/items}}
            {{#empty_rows}}
            <tr style="height: 25px;">
              <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
            </tr>
            {{/empty_rows}}
          </tbody>
        </table>

        <div class="total-section">
          <div class="words-section">
            <div style="font-style: italic; margin-bottom: 10px;">Amount Chargeable (in words)</div>
            <div style="font-weight: bold; font-size: 11px;">{{net_total_words}}</div>
          </div>
          <div class="calc-section">
            <table class="calc-table">
              <tr>
                <td>Total Taxable Value</td>
                <td>{{subtotal}}</td>
              </tr>
              {{#cgst_total}}
              <tr>
                <td>Output CGST @ {{cgst_rate}}%</td>
                <td>{{cgst_total}}</td>
              </tr>
              {{/cgst_total}}
              {{#sgst_total}}
              <tr>
                <td>Output SGST @ {{sgst_rate}}%</td>
                <td>{{sgst_total}}</td>
              </tr>
              {{/sgst_total}}
              <tr>
                <td>Total</td>
                <td>₹ {{net_total}}</td>
              </tr>
            </table>
          </div>
        </div>

        <table class="tax-summary-table">
          <thead>
            <tr>
              <th rowspan="2">HSN/SAC</th>
              <th rowspan="2">Taxable Value</th>
              <th colspan="2">Central Tax</th>
              <th colspan="2">State Tax</th>
              <th rowspan="2">Total Tax Amount</th>
            </tr>
            <tr>
              <th>Rate</th>
              <th>Amount</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {{#tax_summary}}
            <tr>
              <td>{{hsn_code}}</td>
              <td>{{taxable_value}}</td>
              <td>{{central_rate}}</td>
              <td>{{central_amount}}</td>
              <td>{{state_rate}}</td>
              <td>{{state_amount}}</td>
              <td>{{total_tax}}</td>
            </tr>
            {{/tax_summary}}
            <tr style="font-weight: bold; background: #f9f9f9;">
              <td>Total</td>
              <td>{{subtotal}}</td>
              <td></td>
              <td>{{cgst_total}}</td>
              <td></td>
              <td>{{sgst_total}}</td>
              <td>{{tax_total_summary}}</td>
            </tr>
          </tbody>
        </table>

        <div style="padding: 10px; font-size: 9px;">
          <div style="font-weight: bold; text-decoration: underline; margin-bottom: 5px;">Declaration:</div>
          We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
        </div>

        <div class="footer-section">
          <div class="footer-col">
            <div style="margin-bottom: 50px;">Customer's Seal and Signature</div>
            <div class="signature-box">Authorized Signatory</div>
          </div>
          <div class="footer-col" style="text-align: right;">
            <div style="font-weight: bold;">for SP TECHPIONEER PVT LTD</div>
            <div class="signature-box">Authorized Signatory</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : '—';
  const formatCurrency = (val) => Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let totalTaxableValue = 0;
  let totalCgst = 0;
  let totalSgst = 0;

  // Group items by HSN for tax summary
  const taxMap = new Map();
  const formattedItems = items.map((item, idx) => {
    const qty = Number(item.quantity || 0);
    const rate = Number(item.rate || 0);
    const taxable = qty * rate;
    const cgst = taxable * (Number(order.cgst_rate || 0) / 100);
    const sgst = taxable * (Number(order.sgst_rate || 0) / 100);
    
    totalTaxableValue += taxable;
    totalCgst += cgst;
    totalSgst += sgst;

    const hsn = item.hsn_code || 'N/A';
    if (!taxMap.has(hsn)) {
      taxMap.set(hsn, {
        hsn_code: hsn,
        taxable_value: 0,
        central_rate: Number(order.cgst_rate || 0).toFixed(1) + '%',
        central_amount: 0,
        state_rate: Number(order.sgst_rate || 0).toFixed(1) + '%',
        state_amount: 0,
        total_tax: 0
      });
    }
    const entry = taxMap.get(hsn);
    entry.taxable_value += taxable;
    entry.central_amount += cgst;
    entry.state_amount += sgst;
    entry.total_tax += (cgst + sgst);

    return {
      ...item,
      index: idx + 1,
      quantity: qty.toFixed(0),
      rate: formatCurrency(rate),
      item_amount: formatCurrency(taxable)
    };
  });

  const taxSummary = Array.from(taxMap.values()).map(t => ({
    ...t,
    taxable_value: formatCurrency(t.taxable_value),
    central_amount: formatCurrency(t.central_amount),
    state_amount: formatCurrency(t.state_amount),
    total_tax: formatCurrency(t.total_tax)
  }));

  const netTotal = totalTaxableValue + totalCgst + totalSgst;

  const viewData = {
    ...order,
    order_id: String(order.id).padStart(4, '0'),
    created_at: formatDate(order.created_at),
    po_date: formatDate(order.po_date),
    subtotal: formatCurrency(totalTaxableValue),
    cgst_total: formatCurrency(totalCgst),
    sgst_total: formatCurrency(totalSgst),
    tax_total_summary: formatCurrency(totalCgst + totalSgst),
    net_total: formatCurrency(netTotal),
    net_total_words: numberToWords(netTotal),
    tax_summary: taxSummary,
    items: formattedItems,
    empty_rows: Array.from({ length: Math.max(0, 10 - items.length) }),
    cgst_rate: Number(order.cgst_rate || 0).toFixed(1),
    sgst_rate: Number(order.sgst_rate || 0).toFixed(1)
  };

  const html = mustache.render(htmlTemplate, viewData);

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();
    return pdf;
  } catch (error) {
    console.error('[PDF Generation] Puppeteer error:', error.message);
    throw new Error('PDF generation unavailable.');
  }
};

const deleteSalesOrder = async (salesOrderId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Delete linked production plans, work orders, job cards
    const [planRows] = await connection.execute('SELECT id FROM production_plans WHERE sales_order_id = ?', [salesOrderId]);
    for (const plan of planRows) {
      await connection.execute(
        `DELETE FROM job_cards 
         WHERE work_order_id IN (SELECT id FROM work_orders WHERE plan_id = ?)`,
        [plan.id]
      );
      await connection.execute('DELETE FROM work_orders WHERE plan_id = ?', [plan.id]);
      await connection.execute('DELETE FROM material_request_items WHERE mr_id IN (SELECT id FROM material_requests WHERE plan_id = ?)', [plan.id]);
      await connection.execute('DELETE FROM material_requests WHERE plan_id = ?', [plan.id]);
      await connection.execute('DELETE FROM production_plans WHERE id = ?', [plan.id]);
    }

    // 2. Delete sales order item details (BOM stuff)
    const [soiRows] = await connection.execute('SELECT id FROM sales_order_items WHERE sales_order_id = ?', [salesOrderId]);
    for (const soi of soiRows) {
      await connection.execute('DELETE FROM sales_order_item_materials WHERE sales_order_item_id = ?', [soi.id]);
      await connection.execute('DELETE FROM sales_order_item_components WHERE sales_order_item_id = ?', [soi.id]);
      await connection.execute('DELETE FROM sales_order_item_operations WHERE sales_order_item_id = ?', [soi.id]);
      await connection.execute('DELETE FROM sales_order_item_scrap WHERE sales_order_item_id = ?', [soi.id]);
    }

    // 3. Delete sales order items
    await connection.execute('DELETE FROM sales_order_items WHERE sales_order_id = ?', [salesOrderId]);

    // 4. Delete the sales order itself
    await connection.execute('DELETE FROM sales_orders WHERE id = ?', [salesOrderId]);

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getBOMApprovalHistory = async () => {
  const [rows] = await pool.query(
    `SELECT bah.*, so.project_name, c.company_name, cp.po_number, u.username as approver_name
     FROM bom_approval_history bah
     JOIN sales_orders so ON bah.sales_order_id = so.id
     JOIN companies c ON so.company_id = c.id
     LEFT JOIN customer_pos cp ON so.customer_po_id = cp.id
     JOIN users u ON bah.user_id = u.id
     ORDER BY bah.created_at DESC`
  );
  return rows;
};

const getSalesOrderItem = async itemId => {
  const [items] = await pool.query(
    `SELECT soi.*, so.project_name, c.company_name, cp.po_number,
            COALESCE(soi.drawing_id, cd.latest_drawing_id) as drawing_id,
            cd.drawing_name
     FROM sales_order_items soi
     JOIN sales_orders so ON so.id = soi.sales_order_id
     LEFT JOIN companies c ON c.id = so.company_id
     LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
     LEFT JOIN (
       SELECT d1.drawing_no, d1.id as latest_drawing_id, d1.description as drawing_name
       FROM customer_drawings d1
       JOIN (
         SELECT drawing_no, MAX(id) as max_id
         FROM customer_drawings
         GROUP BY drawing_no
       ) d2 ON d1.id = d2.max_id
     ) cd ON cd.drawing_no = soi.drawing_no
     WHERE soi.id = ?`,
    [itemId]
  );
  if (!items.length) return null;
  return items[0];
};

const bulkUpdateStatus = async (orderIds, status) => {
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    throw new Error('No order IDs provided');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const placeholders = orderIds.map(() => '?').join(',');
    
    let department = null;
    if (status === 'BOM_Approved') {
      department = 'PROCUREMENT';
    } else if (status === 'BOM_SUBMITTED') {
      department = 'DESIGN_ENG';
    }

    if (department) {
      await connection.execute(
        `UPDATE sales_orders SET status = ?, current_department = ?, updated_at = NOW() WHERE id IN (${placeholders})`,
        [status, department, ...orderIds]
      );
    } else {
      await connection.execute(
        `UPDATE sales_orders SET status = ?, updated_at = NOW() WHERE id IN (${placeholders})`,
        [status, ...orderIds]
      );
    }
    
    await connection.commit();
    return { updatedCount: orderIds.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateSalesOrderItem = async (itemId, data) => {
  const fields = [];
  const params = [];
  
  if (data.item_code !== undefined) {
    fields.push('item_code = ?');
    params.push(data.item_code);
  }
  if (data.item_type !== undefined) {
    fields.push('item_type = ?');
    params.push(data.item_type);
  }
  if (data.drawing_no !== undefined) {
    fields.push('drawing_no = ?');
    params.push(data.drawing_no);
  }
  if (data.revision_no !== undefined) {
    fields.push('revision_no = ?');
    params.push(data.revision_no);
  }

  if (fields.length === 0) return;

  params.push(itemId);
  await pool.execute(
    `UPDATE sales_order_items SET ${fields.join(', ')} WHERE id = ?`,
    params
  );
};

const bulkUpdateItemStatus = async (itemIds, status, reason) => {
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    throw new Error('No item IDs provided');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const placeholders = itemIds.map(() => '?').join(',');
    await connection.execute(
      `UPDATE sales_order_items SET status = ?, rejection_reason = ?, updated_at = NOW() WHERE id IN (${placeholders})`,
      [status, status === 'REJECTED' ? reason : null, ...itemIds]
    );

    const [items] = await connection.query(`SELECT DISTINCT sales_order_id FROM sales_order_items WHERE id IN (${placeholders})`, itemIds);

    if (status === 'REJECTED' && reason) {
      // Log rejection for each item's order
      for (const item of items) {
        await connection.execute(
          `INSERT INTO design_rejections (sales_order_id, reason, created_at)
           VALUES (?, ?, NOW())`,
          [item.sales_order_id, `Bulk Rejection: ${reason}`]
        );
      }
    } else if (status.trim().toUpperCase() === 'APPROVED') {
      // Promote drawings to Item Master
      for (const itemId of itemIds) {
        const itemData = await getSalesOrderItem(itemId);
        if (itemData) {
          await stockService.promoteDrawingToItem(itemData, connection);
        }
      }

      // Process approval logic for each unique order
      for (const item of items) {
        const salesOrderId = item.sales_order_id;
        const [orderRows] = await connection.query('SELECT status, request_accepted FROM sales_orders WHERE id = ?', [salesOrderId]);
        if (orderRows.length > 0) {
          const order = orderRows[0];
          if (order.request_accepted === 0) {
            await connection.execute(
              "UPDATE sales_orders SET request_accepted = 1, status = 'DESIGN_IN_REVIEW', current_department = 'DESIGN_ENG', updated_at = NOW() WHERE id = ?",
              [salesOrderId]
            );
            
            // Create design order entry if it doesn't exist
            await designOrderService.createDesignOrder(salesOrderId, connection, 'IN_DESIGN');
          }
        }
      }
    }

    await connection.commit();
    return { updatedCount: itemIds.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  listSalesOrders,
  getSalesOrderById,
  updateSalesOrder,
  getIncomingOrders,
  createSalesOrder,
  updateSalesOrderStatus,
  bulkUpdateStatus,
  bulkUpdateItemStatus,
  acceptRequest,
  rejectRequest,
  transitionToDepartment,
  sendOrderToDesign,
  approveDesignAndCreateQuotation,
  rejectDesign,
  bulkApproveDesigns,
  bulkRejectDesigns,
  getApprovedDrawings,
  getBOMApprovalHistory,
  getOrderTimeline,
  getSalesOrderItem,
  updateSalesOrderItem,
  updateSalesOrderItemStatus,
  generateSalesOrderPDF,
  deleteSalesOrder
};
