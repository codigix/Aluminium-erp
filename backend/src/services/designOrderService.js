const pool = require('../config/db');

const listDesignOrders = async (options = {}) => {
  const { includeAll = false } = options;
  const whereClause = includeAll ? '1=1' : 'so.request_accepted = 1';
  const [rows] = await pool.query(`
    SELECT 
      do.id,
      do.design_order_number,
      do.status,
      do.start_date,
      do.completion_date,
      do.created_at,
      so.id as sales_order_id,
      so.status as sales_order_status,
      so.customer_po_id,
      so.project_name,
      so.target_dispatch_date,
      c.company_name,
      cp.po_number,
      soi.item_code,
      soi.id as item_id,
      soi.drawing_no,
      soi.description,
      soi.status as item_status,
      soi.rejection_reason as item_rejection_reason,
      soi.item_type,
      COALESCE(
        poi.quantity, 
        (SELECT MAX(quantity) FROM sales_order_items WHERE sales_order_id = soi.sales_order_id AND TRIM(drawing_no) = TRIM(soi.drawing_no)),
        soi.quantity
      ) as total_quantity,
      sb.material_type as item_group
    FROM design_orders do
    JOIN sales_orders so ON do.sales_order_id = so.id
    JOIN sales_order_items soi ON soi.sales_order_id = so.id
    JOIN companies c ON so.company_id = c.id
    LEFT JOIN customer_pos cp ON so.customer_po_id = cp.id
    LEFT JOIN customer_po_items poi ON so.customer_po_id = poi.customer_po_id 
         AND soi.item_code = poi.item_code 
         AND (soi.drawing_no = poi.drawing_no OR (soi.drawing_no IS NULL AND poi.drawing_no IS NULL))
    LEFT JOIN stock_balance sb ON sb.item_code = soi.item_code
    WHERE ${whereClause}
    ORDER BY do.created_at DESC
  `);
  return rows;
};

const createDesignOrder = async (salesOrderId, connection = null, status = 'DRAFT') => {
  const exec = connection || pool;

  // Check if design order already exists
  const [existing] = await exec.query('SELECT id FROM design_orders WHERE sales_order_id = ?', [salesOrderId]);
  if (existing.length > 0) {
    return existing[0].id;
  }

  const designOrderNumber = `DO-${String(salesOrderId).padStart(4, '0')}`;

  let query = 'INSERT INTO design_orders (design_order_number, sales_order_id, status';
  let placeholders = '?, ?, ?';
  const params = [designOrderNumber, salesOrderId, status];

  if (status === 'IN_DESIGN') {
    query += ', start_date';
    placeholders += ', CURRENT_TIMESTAMP';
  }

  query += `) VALUES (${placeholders})`;

  const [result] = await exec.execute(query, params);

  return result.insertId;
};

const updateDesignOrderStatus = async (designOrderId, status) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let updateFields = 'status = ?';
    const params = [status];

    const upperStatus = (status || '').toUpperCase();

    if (upperStatus === 'IN_DESIGN') {
      updateFields += ', start_date = CURRENT_TIMESTAMP';
    } else if (upperStatus === 'COMPLETED') {
      updateFields += ', completion_date = CURRENT_TIMESTAMP';
    }

    params.push(designOrderId);

    await connection.execute(`UPDATE design_orders SET ${updateFields} WHERE id = ?`, params);

    if (upperStatus === 'COMPLETED') {
      const [doRows] = await connection.query('SELECT sales_order_id FROM design_orders WHERE id = ?', [designOrderId]);
      if (doRows.length > 0) {
        const salesOrderId = doRows[0].sales_order_id;

        await connection.execute(
          "UPDATE sales_orders SET status = 'DESIGN_Approved', current_department = 'PROCUREMENT', updated_at = NOW() WHERE id = ?",
          [salesOrderId]
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

const deleteDesignOrder = async (designOrderId) => {
  await pool.execute('DELETE FROM design_orders WHERE id = ?', [designOrderId]);
};

const getDesignOrderItemsBySalesOrder = async (salesOrderId) => {
  // Try order_items first (new system)
  let [rows] = await pool.query(`
    SELECT 
      oi.item_code,
      oi.id as item_id,
      oi.drawing_no,
      oi.description,
      oi.quantity as qty,
      soi.parent_bom_id as parent_bom_id
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    LEFT JOIN sales_order_items soi ON (TRIM(oi.drawing_no) = TRIM(soi.drawing_no) AND soi.sales_order_id = o.quotation_id)
    WHERE o.id = ? AND oi.type = 'FG'
    AND (soi.parent_bom_id IS NULL)
    AND oi.item_code != 'XXX'
    AND oi.item_code IS NOT NULL
    AND oi.item_code != ''
    AND oi.item_code NOT LIKE '%XXX%'
    AND oi.item_code NOT LIKE '%NO CODE%'
  `, [salesOrderId]);

  // Fallback to legacy sales_order_items
  if (rows.length === 0) {
    [rows] = await pool.query(`
      SELECT 
        soi.item_code,
        soi.id as item_id,
        soi.drawing_no,
        soi.description,
        COALESCE(
          poi.quantity, 
          (SELECT MAX(quantity) FROM sales_order_items WHERE sales_order_id = soi.sales_order_id AND TRIM(drawing_no) = TRIM(soi.drawing_no)),
          soi.quantity
        ) as qty,
        soi.parent_bom_id as parent_bom_id
      FROM sales_order_items soi
      JOIN sales_orders so ON soi.sales_order_id = so.id
      LEFT JOIN customer_po_items poi ON so.customer_po_id = poi.customer_po_id 
           AND soi.item_code = poi.item_code 
           AND (soi.drawing_no = poi.drawing_no OR (soi.drawing_no IS NULL AND poi.drawing_no IS NULL))
      WHERE soi.sales_order_id = ? AND (soi.item_type = 'FG')
      AND (soi.parent_bom_id IS NULL)
      AND soi.item_code != 'XXX'
      AND soi.item_code IS NOT NULL
      AND soi.item_code != ''
      AND soi.item_code NOT LIKE '%XXX%'
      AND soi.item_code NOT LIKE '%NO CODE%'
    `, [salesOrderId]);
  }
  return rows;
};

const listBulkRequests = async () => {
  const [requests] = await pool.query(
    `SELECT * FROM bulk_design_requests WHERE status = 'Pending Design' ORDER BY sent_at DESC`
  );

  if (requests.length === 0) return [];

  const [items] = await pool.query(
    `SELECT bdri.*, so.project_name, c.company_name
     FROM bulk_design_request_items bdri
     JOIN sales_orders so ON bdri.sales_order_id = so.id
     LEFT JOIN companies c ON so.company_id = c.id`
  );

  for (const req of requests) {
    req.items = items.filter(i => i.bulk_request_id === req.id);
  }
  return requests;
};

const approveBulkRequest = async (id) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [items] = await connection.query(
      `SELECT sales_order_id FROM bulk_design_request_items WHERE bulk_request_id = ?`,
      [id]
    );

    if (items.length > 0) {
      const salesOrderIds = items.map(item => item.sales_order_id);
      const placeholders = salesOrderIds.map(() => '?').join(',');

      await connection.execute(
        `UPDATE sales_orders SET status = ?, current_department = ?, request_accepted = 1, updated_at = NOW() 
         WHERE id IN (${placeholders})`,
        ['DESIGN_IN_REVIEW', 'DESIGN_ENG', ...salesOrderIds]
      );

      await connection.execute(
        `UPDATE sales_order_items SET status = 'Approved' 
         WHERE sales_order_id IN (${placeholders}) AND (status IS NULL OR status = 'PENDING' OR status = 'SHARED')`,
        salesOrderIds
      );

      for (const soId of salesOrderIds) {
        await createDesignOrder(soId, connection, 'IN_DESIGN');
      }
    }

    await connection.execute(
      `UPDATE bulk_design_requests SET status = 'Approved' WHERE id = ?`,
      [id]
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

const rejectBulkRequest = async (id) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [items] = await connection.query(
      `SELECT sales_order_id FROM bulk_design_request_items WHERE bulk_request_id = ?`,
      [id]
    );

    if (items.length > 0) {
      const salesOrderIds = items.map(item => item.sales_order_id);
      const placeholders = salesOrderIds.map(() => '?').join(',');

      await connection.execute(
        `UPDATE sales_orders SET status = ?, current_department = ?, request_accepted = 0, updated_at = NOW() 
         WHERE id IN (${placeholders})`,
        ['DESIGN_QUERY', 'SALES', ...salesOrderIds]
      );

      for (const soId of salesOrderIds) {
        await connection.execute(
          `INSERT INTO design_rejections (sales_order_id, reason, created_at)
           VALUES (?, ?, NOW())`,
          [soId, 'Bulk rejection by Design Department']
        );
      }
    }

    await connection.execute(
      `UPDATE bulk_design_requests SET status = 'Rejected' WHERE id = ?`,
      [id]
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

// Search design orders by client name, project, drawing, item code, assembly or bought-out item
const searchDesignOrders = async (query) => {
  const like = `%${query}%`;
  const [rows] = await pool.query(`
    SELECT DISTINCT
      do.id,
      do.design_order_number,
      do.status,
      do.start_date,
      do.completion_date,
      do.created_at,
      so.id as sales_order_id,
      so.status as sales_order_status,
      so.customer_po_id,
      so.project_name,
      so.target_dispatch_date,
      c.company_name,
      cp.po_number,
      soi.item_code,
      soi.id as item_id,
      soi.drawing_no,
      soi.description,
      soi.status as item_status,
      soi.rejection_reason as item_rejection_reason,
      soi.item_type,
      COALESCE(
        poi.quantity,
        (SELECT MAX(quantity) FROM sales_order_items WHERE sales_order_id = soi.sales_order_id AND TRIM(drawing_no) = TRIM(soi.drawing_no)),
        soi.quantity
      ) as total_quantity,
      sb.material_type as item_group
    FROM design_orders do
    JOIN sales_orders so ON do.sales_order_id = so.id
    JOIN sales_order_items soi ON soi.sales_order_id = so.id
    JOIN companies c ON so.company_id = c.id
    LEFT JOIN customer_pos cp ON so.customer_po_id = cp.id
    LEFT JOIN customer_po_items poi ON so.customer_po_id = poi.customer_po_id
         AND soi.item_code = poi.item_code
         AND (soi.drawing_no = poi.drawing_no OR (soi.drawing_no IS NULL AND poi.drawing_no IS NULL))
    LEFT JOIN stock_balance sb ON sb.item_code = soi.item_code
    LEFT JOIN sales_order_item_components boitems ON boitems.sales_order_item_id = soi.id
    WHERE (
      c.company_name LIKE ?
      OR so.project_name LIKE ?
      OR soi.drawing_no LIKE ?
      OR soi.description LIKE ?
      OR soi.item_code LIKE ?
      OR boitems.component_code LIKE ?
      OR boitems.description LIKE ?
    )
    ORDER BY do.created_at DESC
  `, [like, like, like, like, like, like, like]);
  return rows;
};

module.exports = {
  listDesignOrders,
  searchDesignOrders,
  createDesignOrder,
  updateDesignOrderStatus,
  deleteDesignOrder,
  getDesignOrderItemsBySalesOrder,
  listBulkRequests,
  approveBulkRequest,
  rejectBulkRequest
};
