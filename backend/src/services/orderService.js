const pool = require('../config/db');

const generateOrderNo = async () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  
  const [rows] = await pool.query(
    'SELECT order_no FROM orders WHERE order_no LIKE ? ORDER BY order_no DESC LIMIT 1',
    [`ORD-${dateStr}-%`]
  );

  let sequence = 1;
  if (rows.length > 0) {
    const lastNo = rows[0].order_no;
    const lastSeq = parseInt(lastNo.split('-')[2]);
    if (!isNaN(lastSeq)) {
      sequence = lastSeq + 1;
    }
  }

  return `ORD-${dateStr}-${String(sequence).padStart(3, '0')}`;
};

const listOrders = async () => {
  const [rows] = await pool.query(`
    SELECT o.*, c.company_name AS client
    FROM orders o
    JOIN companies c ON c.id = o.client_id
    ORDER BY o.created_at DESC
  `);
  return rows;
};

const createOrder = async (orderData) => {
  const {
    quotation_id,
    client_id,
    order_date,
    delivery_date,
    source_type,
    warehouse,
    cgst_rate,
    sgst_rate,
    profit_margin,
    subtotal,
    gst,
    grand_total,
    items
  } = orderData;

  const orderNo = await generateOrderNo();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.execute(`
      INSERT INTO orders
      (order_no, quotation_id, client_id, order_date, delivery_date, 
       status, source_type, warehouse, cgst_rate, sgst_rate, profit_margin,
       subtotal, gst, grand_total)
      VALUES (?, ?, ?, ?, ?, 'Created', ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      orderNo,
      quotation_id || null,
      client_id,
      order_date || new Date(),
      delivery_date || null,
      source_type || 'DIRECT',
      warehouse || null,
      cgst_rate || 0,
      sgst_rate || 0,
      profit_margin || 0,
      subtotal || 0,
      gst || 0,
      grand_total || 0
    ]);

    const orderId = result.insertId;

    if (items && items.length > 0) {
      for (const item of items) {
        await connection.execute(`
          INSERT INTO order_items
          (order_id, item_code, drawing_no, description, type, quantity, rate, amount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          orderId,
          item.item_code,
          item.drawing_no,
          item.description,
          item.type,
          item.quantity || 0,
          item.rate || 0,
          item.amount || 0
        ]);
      }
    }

    await connection.commit();
    return orderId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getOrderById = async (id) => {
  const [rows] = await pool.query(`
    SELECT o.*, c.company_name AS client, 
           ct.email AS contact_email, ct.phone AS contact_mobile
    FROM orders o
    JOIN companies c ON c.id = o.client_id
    LEFT JOIN (
       SELECT company_id, email, phone, 
              ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY contact_type = 'PRIMARY' DESC, id ASC) as rn
       FROM contacts
    ) ct ON ct.company_id = c.id AND ct.rn = 1
    WHERE o.id = ?
  `, [id]);
  
  if (rows.length === 0) return null;
  
  const order = rows[0];
  const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [id]);
  order.items = items;
  
  return order;
};

const updateOrder = async (id, orderData) => {
  const {
    quotation_id,
    client_id,
    order_date,
    delivery_date,
    status,
    source_type,
    warehouse,
    cgst_rate,
    sgst_rate,
    profit_margin,
    subtotal,
    gst,
    grand_total,
    items
  } = orderData;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(`
      UPDATE orders SET
        quotation_id = ?,
        client_id = ?,
        order_date = ?,
        delivery_date = ?,
        status = ?,
        source_type = ?,
        warehouse = ?,
        cgst_rate = ?,
        sgst_rate = ?,
        profit_margin = ?,
        subtotal = ?,
        gst = ?,
        grand_total = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [
      quotation_id || null,
      client_id,
      order_date,
      delivery_date || null,
      status,
      source_type || 'DIRECT',
      warehouse || null,
      cgst_rate || 0,
      sgst_rate || 0,
      profit_margin || 0,
      subtotal || 0,
      gst || 0,
      grand_total || 0,
      id
    ]);

    // Update items: Simple delete and re-insert for updates
    await connection.execute('DELETE FROM order_items WHERE order_id = ?', [id]);
    
    if (items && items.length > 0) {
      for (const item of items) {
        await connection.execute(`
          INSERT INTO order_items
          (order_id, item_code, drawing_no, description, type, quantity, rate, amount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          id,
          item.item_code,
          item.drawing_no,
          item.description,
          item.type,
          item.quantity || 0,
          item.rate || 0,
          item.amount || 0
        ]);
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

const deleteOrder = async (id) => {
  await pool.execute('DELETE FROM orders WHERE id = ?', [id]);
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
     WHERE (TRIM(so.status) = 'BOM_Approved' 
        OR so.status IN ('PROCUREMENT_IN_PROGRESS', 'MATERIAL_PURCHASE_IN_PROGRESS', 'MATERIAL_READY', 'IN_PRODUCTION', 'PRODUCTION_COMPLETED', 'QC_IN_PROGRESS', 'QC_APPROVED', 'QC_REJECTED', 'READY_FOR_SHIPMENT'))
        AND so.quotation_id IS NULL AND so.is_sales_order = 0`;
  
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
       LEFT JOIN customer_po_items poi ON so.customer_po_id = poi.customer_po_id AND TRIM(poi.drawing_no) = TRIM(soi.drawing_no)
       WHERE soi.sales_order_id = ?
       AND (soi.item_group = 'FG' OR soi.item_type = 'FG' OR soi.item_group IS NULL OR soi.item_group = '')`,
      [order.id]
    );
    order.items = items;
  }
  
  return rows;
};

const getStats = async () => {
  const [rows] = await pool.query(`
    SELECT 
      COUNT(*) as total_orders,
      SUM(CASE WHEN status = 'Draft' THEN 1 ELSE 0 END) as draft_orders,
      SUM(CASE WHEN status = 'Created' THEN 1 ELSE 0 END) as open_orders,
      SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END) as delivered_orders,
      SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
      SUM(grand_total) as total_amount
    FROM orders
  `);
  
  return {
    total: rows[0].total_orders || 0,
    draft: rows[0].draft_orders || 0,
    open: rows[0].open_orders || 0,
    delivered: rows[0].delivered_orders || 0,
    cancelled: rows[0].cancelled_orders || 0,
    totalAmount: rows[0].total_amount || 0
  };
};

module.exports = {
  listOrders,
  createOrder,
  getOrderById,
  updateOrder,
  deleteOrder,
  getApprovedDrawings,
  getStats
};
