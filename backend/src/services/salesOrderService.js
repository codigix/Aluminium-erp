const pool = require('../config/db');
const designOrderService = require('./designOrderService');

const listSalesOrders = async () => {
  const [rows] = await pool.query(
    `SELECT so.*, c.company_name, cp.po_number, cp.po_date, cp.currency AS po_currency, cp.net_total AS po_net_total, cp.pdf_path
     FROM sales_orders so
     LEFT JOIN companies c ON c.id = so.company_id
     LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
     ORDER BY so.created_at DESC`
  );
  return rows;
};

const getIncomingOrders = async (departmentCode) => {
  console.log(`[getIncomingOrders-service] Starting query for department: "${departmentCode}"`);
  
  let whereClause = '';
  if (departmentCode === 'DESIGN_ENG') {
    whereClause = `so.status IN ('CREATED', 'DESIGN_QUERY')`;
  } else if (departmentCode === 'PROCUREMENT') {
    whereClause = `so.status IN ('CREATED', 'DESIGN_IN_REVIEW', 'DESIGN_APPROVED', 'PROCUREMENT_IN_PROGRESS', 'MATERIAL_PURCHASE_IN_PROGRESS')`;
  } else if (departmentCode === 'INVENTORY') {
    whereClause = `so.status IN ('CREATED', 'DESIGN_IN_REVIEW', 'DESIGN_APPROVED', 'PROCUREMENT_IN_PROGRESS', 'MATERIAL_PURCHASE_IN_PROGRESS', 'MATERIAL_READY', 'IN_PRODUCTION')`;
  } else if (departmentCode === 'PRODUCTION') {
    whereClause = `so.status IN ('CREATED', 'DESIGN_IN_REVIEW', 'MATERIAL_READY', 'IN_PRODUCTION')`;
  } else {
    whereClause = `so.current_department = '${departmentCode}'`;
  }
  
  const query = `SELECT so.*, c.company_name, c.company_code, cp.po_number, cp.po_date, cp.currency AS po_currency, cp.net_total AS po_net_total, cp.pdf_path, 
            d.name as current_dept_name
     FROM sales_orders so
     LEFT JOIN companies c ON c.id = so.company_id
     LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
     LEFT JOIN departments d ON d.code = so.current_department
     WHERE (${whereClause}) AND so.request_accepted = 0
     ORDER BY so.created_at DESC`;
  
  const [rows] = await pool.query(query);
  console.log(`[getIncomingOrders-service] Query returned ${rows.length} rows for department "${departmentCode}"`);
  console.log(`[getIncomingOrders-service] Raw rows:`, rows);
  return rows;
};

const createSalesOrder = async (customerPoId, companyId, projectName, drawingRequired, productionPriority, targetDispatchDate, items) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.execute(
      `INSERT INTO sales_orders (customer_po_id, company_id, project_name, drawing_required, production_priority, target_dispatch_date, status, current_department, request_accepted)
       VALUES (?, ?, ?, ?, ?, ?, 'CREATED', 'DESIGN_ENG', 0)`,
      [customerPoId, companyId, projectName, drawingRequired, productionPriority, targetDispatchDate]
    );

    const salesOrderId = result.insertId;

    // Use items from request if provided, otherwise copy from Customer PO
    let orderItems = [];
    if (items && items.length > 0) {
      orderItems = items;
    } else {
      const [poItems] = await connection.query(
        'SELECT item_code, drawing_no, revision_no, description, quantity, unit, rate, delivery_date, (cgst_amount + sgst_amount + igst_amount) as tax_value FROM customer_po_items WHERE customer_po_id = ?',
        [customerPoId]
      );
      orderItems = poItems;
    }

    for (const item of orderItems) {
      const [itemResult] = await connection.execute(
        `INSERT INTO sales_order_items (sales_order_id, item_code, drawing_no, revision_no, description, quantity, unit, rate, delivery_date, tax_value)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [salesOrderId, item.item_code, item.drawing_no, item.revision_no, item.description, item.quantity, item.unit, item.rate, item.delivery_date, item.tax_value || 0]
      );

      const salesOrderItemId = itemResult.insertId;

      // If item has materials, insert them too
      if (item.materials && Array.isArray(item.materials)) {
        for (const mat of item.materials) {
          await connection.execute(
            'INSERT INTO sales_order_item_materials (sales_order_item_id, material_name, material_type, qty_per_pc, uom) VALUES (?, ?, ?, ?, ?)',
            [salesOrderItemId, mat.materialName, mat.materialType, mat.qtyPerPc, mat.uom]
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

const updateSalesOrderStatus = async (salesOrderId, status) => {
  let department = null;
  if (status === 'BOM_APPROVED') {
    department = 'PROCUREMENT';
  } else if (status === 'BOM_SUBMITTED') {
    department = 'DESIGN_ENG'; // Stay in design for approval
  }

  if (department) {
    await pool.execute('UPDATE sales_orders SET status = ?, current_department = ? WHERE id = ?', [status, department, salesOrderId]);
  } else {
    await pool.execute('UPDATE sales_orders SET status = ? WHERE id = ?', [status, salesOrderId]);
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
    } else if (departmentCode === 'PROCUREMENT' && (currentOrder.status === 'CREATED' || currentOrder.status === 'DESIGN_IN_REVIEW' || currentOrder.status === 'DESIGN_APPROVED' || currentOrder.status === 'PROCUREMENT_IN_PROGRESS')) {
      if (currentOrder.material_available) {
        newStatus = 'MATERIAL_READY';
        nextDepartment = 'PRODUCTION';
      } else {
        newStatus = 'MATERIAL_PURCHASE_IN_PROGRESS';
        nextDepartment = 'PROCUREMENT';
      }
    } else if (departmentCode === 'PRODUCTION' && (currentOrder.status === 'MATERIAL_READY' || currentOrder.status === 'IN_PRODUCTION')) {
      newStatus = 'PRODUCTION_COMPLETED';
      nextDepartment = 'QC';
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

const getOrderTimeline = async salesOrderId => {
  const [items] = await pool.query(
    'SELECT * FROM sales_order_items WHERE sales_order_id = ?',
    [salesOrderId]
  );
  
  // Fetch materials for all items in this order
  const [materials] = await pool.query(
    `SELECT som.* 
     FROM sales_order_item_materials som
     JOIN sales_order_items soi ON som.sales_order_item_id = soi.id
     WHERE soi.sales_order_id = ?`,
    [salesOrderId]
  );

  // Attach materials to items
  return items.map(item => ({
    ...item,
    materials: materials.filter(m => m.sales_order_item_id === item.id)
  }));
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
        body { font-family: sans-serif; padding: 20px; color: #333; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
        .company-info h1 { margin: 0; color: #1e293b; font-size: 24px; }
        .order-meta { text-align: right; }
        .order-meta p { margin: 2px 0; font-size: 14px; }
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
        .section-title { font-weight: bold; font-size: 12px; text-transform: uppercase; color: #64748b; margin-bottom: 8px; }
        .info-box { background: #f8fafc; padding: 12px; border-radius: 6px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #f1f5f9; text-align: left; padding: 10px; font-size: 12px; text-transform: uppercase; color: #475569; }
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

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();

  return pdf;
};

module.exports = {
  listSalesOrders,
  getIncomingOrders,
  createSalesOrder,
  updateSalesOrderStatus,
  acceptRequest,
  rejectRequest,
  transitionToDepartment,
  sendOrderToDesign,
  getOrderTimeline,
  generateSalesOrderPDF
};
