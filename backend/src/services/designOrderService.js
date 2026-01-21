const pool = require('../config/db');

const listDesignOrders = async () => {
  const [rows] = await pool.query(`
    SELECT 
      do.id,
      do.design_order_number,
      do.status,
      do.start_date,
      do.completion_date,
      do.created_at,
      so.id as sales_order_id,
      so.project_name,
      so.target_dispatch_date,
      c.company_name,
      cp.po_number,
      soi.item_code,
      soi.id as item_id,
      soi.drawing_no,
      soi.quantity as total_quantity
    FROM design_orders do
    JOIN sales_orders so ON do.sales_order_id = so.id
    JOIN sales_order_items soi ON soi.sales_order_id = so.id
    JOIN companies c ON so.company_id = c.id
    LEFT JOIN customer_pos cp ON so.customer_po_id = cp.id
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
    
    if (status === 'IN_DESIGN') {
      updateFields += ', start_date = CURRENT_TIMESTAMP';
    } else if (status === 'COMPLETED') {
      updateFields += ', completion_date = CURRENT_TIMESTAMP';
    }
    
    params.push(designOrderId);
    
    await connection.execute(`UPDATE design_orders SET ${updateFields} WHERE id = ?`, params);

    if (status === 'COMPLETED') {
      const [doRows] = await connection.query('SELECT sales_order_id FROM design_orders WHERE id = ?', [designOrderId]);
      if (doRows.length > 0) {
        const salesOrderId = doRows[0].sales_order_id;
        await connection.execute(
          "UPDATE sales_orders SET status = 'DESIGN_APPROVED', current_department = 'PROCUREMENT', updated_at = NOW() WHERE id = ?",
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

module.exports = {
  listDesignOrders,
  createDesignOrder,
  updateDesignOrderStatus,
  deleteDesignOrder
};
