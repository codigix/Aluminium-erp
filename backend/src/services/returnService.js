const pool = require('../config/db');
const { addStockLedgerEntry } = require('./stockService');

const getReturns = async () => {
  const [rows] = await pool.query(`
    SELECT 
      r.*,
      s.shipment_code,
      c.company_name as customer_name,
      s.driver_name,
      s.vehicle_number
    FROM shipment_returns r
    LEFT JOIN shipment_orders s ON r.shipment_id = s.id
    LEFT JOIN companies c ON r.customer_id = c.id
    ORDER BY r.created_at DESC
  `);
  return rows;
};

const getReturnById = async (id) => {
  const [rows] = await pool.query(`
    SELECT 
      r.*,
      s.shipment_code,
      c.company_name as customer_name,
      s.driver_name,
      s.vehicle_number
    FROM shipment_returns r
    LEFT JOIN shipment_orders s ON r.shipment_id = s.id
    LEFT JOIN companies c ON r.customer_id = c.id
    WHERE r.id = ?
  `, [id]);
  
  if (rows.length === 0) return null;
  const returnData = rows[0];

  const [items] = await pool.query(`
    SELECT * FROM shipment_return_items WHERE return_id = ?
  `, [id]);
  
  returnData.items = items;
  return returnData;
};

const initiateReturn = async (data) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { shipment_id, reason, items } = data;

    // 1. Get shipment details
    const [shipmentRows] = await connection.query(
      'SELECT id, sales_order_id, customer_id, shipment_code FROM shipment_orders WHERE id = ?',
      [shipment_id]
    );

    if (shipmentRows.length === 0) throw new Error('Shipment not found');
    const shipment = shipmentRows[0];

    // 2. Generate return code
    const [maxIdRows] = await connection.query('SELECT MAX(id) as max_id FROM shipment_returns');
    const nextId = (maxIdRows[0].max_id || 0) + 1;
    const return_code = `RTN-${new Date().getFullYear()}-${String(nextId).padStart(5, '0')}`;

    // 3. Insert return record
    const [result] = await connection.execute(
      `INSERT INTO shipment_returns (
        return_code, shipment_id, order_id, customer_id, reason, status
      ) VALUES (?, ?, ?, ?, ?, 'RETURN_INITIATED')`,
      [return_code, shipment_id, shipment.sales_order_id, shipment.customer_id, reason]
    );

    const returnId = result.insertId;

    // 4. Update shipment status
    await connection.execute(
      "UPDATE shipment_orders SET status = 'RETURN_INITIATED', updated_at = NOW() WHERE id = ?",
      [shipment_id]
    );

    // 5. Insert return items (if provided, otherwise copy from original source)
    if (items && items.length > 0) {
      for (const item of items) {
        await connection.execute(
          'INSERT INTO shipment_return_items (return_id, item_code, quantity) VALUES (?, ?, ?)',
          [returnId, item.item_code || 'N/A', item.quantity]
        );
      }
    } else {
      // Logic to copy items from original source
      if (shipment.shipment_code && shipment.shipment_code.includes('-QC')) {
        // Copy from QC items
        const match = shipment.shipment_code.match(/-QC(\d+)$/);
        if (match) {
          const qcId = parseInt(match[1], 10);
          const [qcItems] = await connection.query(
            "SELECT COALESCE(NULLIF(TRIM(item_code), ''), 'N/A') as item_code, po_qty as quantity FROM qc_inspection_items WHERE qc_inspection_id = ?",
            [qcId]
          );
          for (const item of qcItems) {
            await connection.execute(
              'INSERT INTO shipment_return_items (return_id, item_code, quantity) VALUES (?, ?, ?)',
              [returnId, item.item_code, item.quantity]
            );
          }
        }
      } else if (shipment.sales_order_id) {
        // Copy from SO items
        const [soItems] = await connection.query(
          "SELECT COALESCE(NULLIF(TRIM(item_code), ''), drawing_no, 'N/A') as item_code, quantity FROM sales_order_items WHERE sales_order_id = ?",
          [shipment.sales_order_id]
        );
        for (const item of soItems) {
          await connection.execute(
            'INSERT INTO shipment_return_items (return_id, item_code, quantity) VALUES (?, ?, ?)',
            [returnId, item.item_code, item.quantity]
          );
        }
      }
    }

    await connection.commit();
    return { success: true, returnId, return_code };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateReturnStatus = async (id, statusData) => {
  const { status, condition_status, received_date, pickup_date, refund_amount } = statusData;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [currentReturn] = await connection.query('SELECT * FROM shipment_returns WHERE id = ?', [id]);
    if (currentReturn.length === 0) throw new Error('Return not found');
    const rtn = currentReturn[0];

    let updateFields = [];
    let params = [];

    if (status) { updateFields.push('status = ?'); params.push(status); }
    if (condition_status) { updateFields.push('condition_status = ?'); params.push(condition_status); }
    if (received_date) { updateFields.push('received_date = ?'); params.push(received_date); }
    if (pickup_date) { updateFields.push('pickup_date = ?'); params.push(pickup_date); }
    if (refund_amount !== undefined) { updateFields.push('refund_amount = ?'); params.push(refund_amount); }

    if (updateFields.length > 0) {
      params.push(id);
      await connection.execute(
        `UPDATE shipment_returns SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
        params
      );
    }

    // Business Logic for Status Transitions
    if (status === 'RETURN_RECEIVED' && condition_status === 'GOOD') {
      // Restock items
      const [items] = await connection.query('SELECT * FROM shipment_return_items WHERE return_id = ?', [id]);
      for (const item of items) {
        await addStockLedgerEntry(
          item.item_code,
          'IN',
          item.quantity,
          'RETURN',
          id,
          rtn.return_code,
          {
            connection,
            remarks: `Restocked from return ${rtn.return_code}`,
            warehouse: 'MAIN STORE' // Or dynamic
          }
        );
      }
    }

    await connection.commit();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getReturnStats = async () => {
  const [rows] = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'RETURN_INITIATED' THEN 1 END) as initiated,
      COUNT(CASE WHEN status = 'RETURN_IN_TRANSIT' THEN 1 END) as in_transit,
      COUNT(CASE WHEN status = 'RETURN_RECEIVED' THEN 1 END) as received,
      COUNT(CASE WHEN status = 'RETURN_COMPLETED' THEN 1 END) as completed
    FROM shipment_returns
  `);
  return rows[0];
};

module.exports = {
  getReturns,
  getReturnById,
  initiateReturn,
  updateReturnStatus,
  getReturnStats
};
