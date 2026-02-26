const pool = require('../config/db');

const getOrdersForFinalQC = async () => {
  const [rows] = await pool.query(`
    SELECT 
      so.*, 
      c.company_name, 
      cp.po_number,
      s.id as shipment_id
    FROM sales_orders so
    LEFT JOIN companies c ON c.id = so.company_id
    LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
    LEFT JOIN shipment_orders s ON s.sales_order_id = so.id
    WHERE so.status IN ('PRODUCTION_COMPLETED', 'QC_IN_PROGRESS', 'READY_FOR_SHIPMENT')
    ORDER BY so.created_at DESC
  `);
  return rows;
};

const completeFinalQC = async (salesOrderId, inspectionData) => {
  const { status, remarks, passedQty, failedQty } = inspectionData;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Update Sales Order Status
    const soStatus = status === 'PASSED' ? 'READY_FOR_SHIPMENT' : 'QC_REJECTED';
    await connection.execute(
      'UPDATE sales_orders SET status = ?, current_department = ?, updated_at = NOW() WHERE id = ?',
      [soStatus, status === 'PASSED' ? 'SHIPMENT' : 'QUALITY', salesOrderId]
    );

    // 2. If PASSED, auto-create Shipment Order
    if (status === 'PASSED') {
      // Check if shipment order already exists for this sales order to avoid duplicates
      const [existingShipment] = await connection.query(
        'SELECT id FROM shipment_orders WHERE sales_order_id = ?',
        [salesOrderId]
      );

      if (existingShipment.length === 0) {
        const [orderRows] = await connection.query(
          `SELECT 
            so.company_id, 
            c.company_name,
            so.target_dispatch_date, 
            so.production_priority 
          FROM sales_orders so
          LEFT JOIN companies c ON so.company_id = c.id
          WHERE so.id = ?`,
          [salesOrderId]
        );
        const order = orderRows[0];

        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const shipmentCode = `SHP-${year}${month}-SO${String(salesOrderId).padStart(4, '0')}`;
        
        await connection.execute(
          `INSERT INTO shipment_orders (shipment_code, sales_order_id, customer_id, customer_name, dispatch_target_date, priority, status)
           VALUES (?, ?, ?, ?, ?, ?, 'PENDING_ACCEPTANCE')`,
          [shipmentCode, salesOrderId, order?.company_id || null, order?.company_name || null, order?.target_dispatch_date || null, order?.production_priority || 'NORMAL']
        );
      }
    }

    await connection.commit();
    return { success: true, status: soStatus };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const createShipmentOrder = async (salesOrderId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Check if shipment order already exists
    const [existingShipment] = await connection.query(
      'SELECT id FROM shipment_orders WHERE sales_order_id = ?',
      [salesOrderId]
    );

    if (existingShipment.length > 0) {
      throw new Error('Shipment order already exists for this sales order');
    }

    // 2. Fetch Sales Order Details
    const [orderRows] = await connection.query(
      `SELECT 
        so.company_id, 
        c.company_name,
        so.target_dispatch_date, 
        so.production_priority, 
        so.status 
      FROM sales_orders so
      LEFT JOIN companies c ON so.company_id = c.id
      WHERE so.id = ?`,
      [salesOrderId]
    );

    if (orderRows.length === 0) {
      throw new Error('Sales order not found');
    }

    const order = orderRows[0];

    // 3. Generate Shipment Code
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const shipmentCode = `SHP-${year}${month}-SO${String(salesOrderId).padStart(4, '0')}`;

    // 4. Create Shipment Order
    await connection.execute(
      `INSERT INTO shipment_orders (shipment_code, sales_order_id, customer_id, customer_name, dispatch_target_date, priority, status)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING_ACCEPTANCE')`,
      [shipmentCode, salesOrderId, order?.company_id || null, order?.company_name || null, order?.target_dispatch_date || null, order?.production_priority || 'NORMAL']
    );

    // 5. Update Sales Order Status to READY_FOR_SHIPMENT if not already
    if (order.status !== 'READY_FOR_SHIPMENT') {
      await connection.execute(
        'UPDATE sales_orders SET status = ?, current_department = ?, updated_at = NOW() WHERE id = ?',
        ['READY_FOR_SHIPMENT', 'SHIPMENT', salesOrderId]
      );
    }

    await connection.commit();
    return { success: true, shipmentCode };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  getOrdersForFinalQC,
  completeFinalQC,
  createShipmentOrder
};
