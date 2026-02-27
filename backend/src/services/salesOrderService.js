const pool = require('../config/db');
const designOrderService = require('./designOrderService');

const listSalesOrders = async (includeWithoutPo = true) => {
  let whereClause = "WHERE (so.is_sales_order = 1 OR so.status IN ('BOM_SUBMITTED', 'BOM_Approved '))";
  if (!includeWithoutPo) {
    whereClause += ' AND so.customer_po_id IS NOT NULL';
  }
  
  const [rows] = await pool.query(
    `SELECT so.*, c.company_name, cp.po_number, cp.po_date, cp.currency AS po_currency, cp.net_total AS po_net_total, cp.pdf_path,
            COALESCE(ct.email, "") as email_address, COALESCE(ct.phone, "") as contact_phone,
            (SELECT GROUP_CONCAT(DISTINCT drawing_no SEPARATOR ', ') FROM sales_order_items WHERE sales_order_id = so.id) as drawing_no,
            (SELECT reason FROM design_rejections WHERE sales_order_id = so.id ORDER BY created_at DESC LIMIT 1) as rejection_reason
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
      'SELECT *, quantity as design_qty FROM sales_order_items WHERE sales_order_id = ?',
      [order.id]
    );
    order.items = items;
  }
  
  return rows;
};

const getSalesOrderById = async (id) => {
  const [rows] = await pool.query(
    `SELECT so.*, c.company_name, cp.po_number, cp.po_date, cp.currency AS po_currency, cp.net_total AS po_net_total, cp.pdf_path,
            COALESCE(ct.email, "") as email_address, COALESCE(ct.phone, "") as contact_phone
     FROM sales_orders so
     LEFT JOIN companies c ON c.id = so.company_id
     LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
     LEFT JOIN (
       SELECT company_id, email, phone, name, 
              ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY contact_type = 'PRIMARY' DESC, id ASC) as rn
       FROM contacts
     ) ct ON ct.company_id = c.id AND ct.rn = 1
     WHERE so.id = ?`,
    [id]
  );
  
  if (rows.length === 0) return null;
  const order = rows[0];

  const [items] = await pool.query(
    'SELECT * FROM sales_order_items WHERE sales_order_id = ?',
    [order.id]
  );
  order.items = items;
  
  return order;
};

const getIncomingOrders = async (departmentCode) => {
  console.log(`[getIncomingOrders-service] Starting query for department: "${departmentCode}"`);
  
  let whereClause = '';
  if (departmentCode === 'DESIGN_ENG') {
    whereClause = `so.status IN ('CREATED', 'DESIGN_QUERY')`;
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
  
  const query = `SELECT so.*, c.company_name, c.company_code, cp.po_number, cp.po_date, cp.currency AS po_currency, cp.net_total AS po_net_total, cp.pdf_path, 
            d.name as current_dept_name,
            soi.item_id, soi.item_code, soi.drawing_no, soi.description AS item_description, soi.quantity AS item_qty, soi.unit AS item_unit, soi.item_status, soi.item_rejection_reason,
            sb.material_type as item_group,
            (SELECT reason FROM design_rejections WHERE sales_order_id = so.id ORDER BY created_at DESC LIMIT 1) as rejection_reason
     FROM sales_orders so
     LEFT JOIN companies c ON c.id = so.company_id
     LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
     LEFT JOIN departments d ON d.code = so.current_department
     LEFT JOIN (
       SELECT sales_order_id, id as item_id, item_code, drawing_no, description, quantity, quantity as design_qty, unit, status as item_status, rejection_reason as item_rejection_reason
       FROM sales_order_items
     ) soi ON soi.sales_order_id = so.id
     LEFT JOIN stock_balance sb ON sb.item_code = soi.item_code
     WHERE (${whereClause}) AND so.request_accepted = 0
     ORDER BY so.created_at DESC`;
  
  const [rows] = await pool.query(query);
  console.log(`[getIncomingOrders-service] Query returned ${rows.length} rows for department "${departmentCode}"`);
  console.log(`[getIncomingOrders-service] Raw rows:`, rows);
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
    items,
    cgst_rate = 0,
    sgst_rate = 0,
    profit_margin = 0,
    bom_id = null,
    warehouse = null,
    status = 'CREATED',
    quotation_id = null,
    source_type = 'DIRECT'
  } = orderData;

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

    const [result] = await connection.execute(
      `INSERT INTO sales_orders (
        customer_po_id, company_id, project_name, drawing_required, 
        production_priority, target_dispatch_date, status, 
        current_department, request_accepted, cgst_rate, 
        sgst_rate, profit_margin, bom_id, warehouse,
        quotation_id, source_type
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, 'DESIGN_ENG', 0, ?, ?, ?, ?, ?, ?, ?)`,
      [
        validatedPoId, 
        companyId || null, 
        projectName || null, 
        drawingRequired, 
        productionPriority, 
        targetDispatchDate || null, 
        status,
        cgst_rate,
        sgst_rate,
        profit_margin,
        bom_id,
        warehouse,
        finalQuotationId,
        source_type
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
    return salesOrderId;
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
        targetDispatchDate || null, 
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
  let department = null;
  if (status === 'BOM_Approved ') {
    department = 'PROCUREMENT';
  } else if (status === 'BOM_SUBMITTED') {
    department = 'DESIGN_ENG'; // Stay in design for approval
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
    if (status === 'BOM_Approved ' || status === 'REJECTED_BOM') {
      const action = status === 'BOM_Approved ' ? 'APPROVED' : 'REJECTED';
      if (userId) {
        await connection.execute(
          'INSERT INTO bom_approval_history (sales_order_id, user_id, action, remarks) VALUES (?, ?, ?, ?)',
          [salesOrderId, userId, action, remarks]
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
  await pool.execute(
    'UPDATE sales_orders SET status = ?, current_department = ?, request_accepted = 0, updated_at = NOW() WHERE id = ?',
    ['DESIGN_IN_REVIEW', 'DESIGN_ENG', salesOrderId]
  );
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

    if (status === 'REJECTED' && reason) {
      // Get sales_order_id for this item
      const [itemRows] = await connection.query('SELECT sales_order_id FROM sales_order_items WHERE id = ?', [itemId]);
      if (itemRows.length > 0) {
        const salesOrderId = itemRows[0].sales_order_id;
        
        // Log rejection reason
        await connection.execute(
          `INSERT INTO design_rejections (sales_order_id, reason, created_at)
           VALUES (?, ?, NOW())`,
          [salesOrderId, `Item ID ${itemId} Rejected: ${reason}`]
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
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    throw new Error('No order IDs provided');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const placeholders = orderIds.map(() => '?').join(',');
    
    const [orders] = await connection.query(
      `SELECT id, company_id FROM sales_orders WHERE id IN (${placeholders})`,
      orderIds
    );
    
    if (orders.length === 0) throw new Error('No sales orders found');
    
    await connection.execute(
      `UPDATE sales_orders SET status = ?, current_department = ?, request_accepted = 1, updated_at = NOW() WHERE id IN (${placeholders})`,
      ['DESIGN_IN_REVIEW', 'DESIGN_ENG', ...orderIds]
    );
    
    // Mark non-rejected items as ACCEPTED for all orders
    await connection.execute(
      `UPDATE sales_order_items SET status = 'ACCEPTED' WHERE sales_order_id IN (${placeholders}) AND (status IS NULL OR status = 'PENDING')`,
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
     WHERE (TRIM(so.status) IN ('BOM_Approved', 'PROCUREMENT_IN_PROGRESS', 'MATERIAL_PURCHASE_IN_PROGRESS', 'MATERIAL_READY', 'IN_PRODUCTION', 'PRODUCTION_COMPLETED', 'QC_IN_PROGRESS', 'QC_APPROVED', 'QC_REJECTED', 'READY_FOR_SHIPMENT'))
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
      `SELECT soi.*, 
              COALESCE(NULLIF(soi.item_group, ''), NULLIF(soi.item_type, ''), 'FG') as item_group,
              COALESCE(
                poi.quantity, 
                (SELECT MAX(quantity) FROM sales_order_items WHERE sales_order_id = soi.sales_order_id AND TRIM(drawing_no) = TRIM(soi.drawing_no)),
                soi.quantity
              ) as design_qty 
       FROM sales_order_items soi
       LEFT JOIN sales_orders so ON soi.sales_order_id = so.id
       LEFT JOIN customer_po_items poi ON so.customer_po_id = poi.customer_po_id 
            AND (TRIM(soi.drawing_no) = TRIM(poi.drawing_no) AND soi.drawing_no IS NOT NULL)
       WHERE soi.sales_order_id = ? 
       AND (soi.item_group = 'FG' OR soi.item_type = 'FG' OR soi.item_group IS NULL OR soi.item_group = '')`,
      [order.id]
    );
    order.items = items;
    
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
  const [items] = await pool.query(
    `SELECT soi.*, sb.material_type as item_group, sb.product_type,
            COALESCE(soi.drawing_id, cd.latest_drawing_id) as drawing_id,
            cd.drawing_name
     FROM sales_order_items soi
     LEFT JOIN stock_balance sb ON sb.item_code = soi.item_code
     LEFT JOIN (
       SELECT d1.drawing_no, d1.id as latest_drawing_id, d1.description as drawing_name
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
  
  if (items.length === 0) return [];

  const itemIds = items.map(i => i.id);
  const itemCodes = items.map(i => i.item_code).filter(Boolean);
  const drawingNos = items.map(i => i.drawing_no).filter(Boolean);

  // Fetch all related data in bulk
  const [allMaterials] = await pool.query(
    `SELECT * FROM sales_order_item_materials 
     WHERE sales_order_item_id IN (?) 
     OR (item_code IN (?) AND sales_order_item_id IS NULL)
     OR (drawing_no IN (?) AND sales_order_item_id IS NULL AND item_code IS NULL)
     ORDER BY created_at ASC`,
    [itemIds, itemCodes.length > 0 ? itemCodes : [null], drawingNos.length > 0 ? drawingNos : [null]]
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
    // Fix: has_bom should only be true if an order-specific BOM exists. 
    // This prevents "template leakage" and makes the delete button work correctly (by only showing it for order-specific BOMs).
    item.has_bom = hasOrderSpecific;
  }
  
  return items;
};


const generateSalesOrderPDF = async (salesOrderId) => {
  const [orderRows] = await pool.query(
    `SELECT so.*, c.company_name, c.company_code, cp.po_number, cp.po_date, cp.currency AS po_currency
     FROM sales_orders so
     LEFT JOIN companies c ON c.id = so.company_id
     LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
     WHERE so.id = ?`,
    [salesOrderId]
  );

  if (!orderRows.length) throw new Error('Sales Order not found');
  const order = orderRows[0];

  const [items] = await pool.query(
    'SELECT * FROM sales_order_items WHERE sales_order_id = ?',
    [salesOrderId]
  );

  const puppeteer = require('puppeteer');
  const mustache = require('mustache');

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Inter', system-ui, Avenir, Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
        .company-info h1 { margin: 0; color: #1e293b; font-size: 24px; }
        .order-meta { text-align: right; }
        .order-meta p { margin: 2px 0; font-size: 14px; }
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
        .section-title { font-weight: bold; font-size: 12px; text-transform: ; color: #64748b; margin-bottom: 8px; }
        .info-box { background: #f8fafc; padding: 12px; border-radius: 6px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #f1f5f9; text-align: left; padding: 10px; font-size: 12px; text-transform: ; color: #475569; }
        td { padding: 10px; border-bottom: 1px solid #eee; font-size: 13px; }
        .totals { margin-top: 20px; float: right; width: 250px; }
        .total-row { display: flex; justify-content: space-between; padding: 5px 0; }
        .grand-total { font-weight: bold; font-size: 16px; border-top: 2px solid #eee; margin-top: 5px; padding-top: 5px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-info">
          <h1>SALES ORDER</h1>
          <p>SPTECH PIONEER ALUMINIUM</p>
        </div>
        <div class="order-meta">
          <p><strong>Order #:</strong> SO-{{id}}</p>
          <p><strong>Date:</strong> {{created_at}}</p>
          <p><strong>Status:</strong> {{status}}</p>
        </div>
      </div>

      <div class="details-grid">
        <div class="info-box">
          <div class="section-title">Customer Information</div>
          <p><strong>{{company_name}}</strong></p>
          <p>Code: {{company_code}}</p>
          <p>Project: {{project_name}}</p>
        </div>
        <div class="info-box">
          <div class="section-title">Reference Details</div>
          <p><strong>Customer PO:</strong> {{po_number}}</p>
          <p><strong>PO Date:</strong> {{po_date}}</p>
          <p><strong>Target Dispatch:</strong> {{target_dispatch_date}}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Item Code</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Rate</th>
            <th>Tax</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {{#items}}
          <tr>
            <td>{{item_code}}</td>
            <td>{{description}}</td>
            <td>{{quantity}}</td>
            <td>{{unit}}</td>
            <td>{{rate}}</td>
            <td>{{tax_value}}</td>
            <td>{{total}}</td>
          </tr>
          {{/items}}
        </tbody>
      </table>

      <div class="totals">
        <div class="total-row grand-total">
          <span>Total ({{po_currency}}):</span>
          <span>{{grand_total}}</span>
        </div>
      </div>
    </body>
    </html>
  `;

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-IN') : '—';
  
  let totalSum = 0;
  const formattedItems = items.map(item => {
    const itemTotal = (parseFloat(item.quantity) * parseFloat(item.rate)) + parseFloat(item.tax_value || 0);
    totalSum += itemTotal;
    return {
      ...item,
      quantity: parseFloat(item.quantity).toFixed(2),
      rate: parseFloat(item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      tax_value: parseFloat(item.tax_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      total: itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })
    };
  });

  const viewData = {
    ...order,
    id: String(order.id).padStart(4, '0'),
    created_at: formatDate(order.created_at),
    po_date: formatDate(order.po_date),
    target_dispatch_date: formatDate(order.target_dispatch_date),
    items: formattedItems,
    grand_total: totalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })
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
    throw new Error('PDF generation unavailable. Please configure Chrome/Chromium browser.');
  }
};

const deleteSalesOrder = async (salesOrderId) => {
  await pool.execute('DELETE FROM sales_orders WHERE id = ?', [salesOrderId]);
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
    if (status === 'BOM_Approved ') {
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

    if (status === 'REJECTED' && reason) {
      // Log rejection for each item's order
      const [items] = await connection.query(`SELECT DISTINCT sales_order_id FROM sales_order_items WHERE id IN (${placeholders})`, itemIds);
      for (const item of items) {
        await connection.execute(
          `INSERT INTO design_rejections (sales_order_id, reason, created_at)
           VALUES (?, ?, NOW())`,
          [item.sales_order_id, `Bulk Rejection: ${reason}`]
        );
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
