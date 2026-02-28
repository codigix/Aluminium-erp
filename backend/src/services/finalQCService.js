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
    console.log(`[createShipmentOrder] Fetching details for salesOrderId: ${salesOrderId}`);
    let [orderRows] = await connection.query(
      `SELECT 
        so.id,
        so.company_id, 
        c.company_name,
        so.target_dispatch_date, 
        so.production_priority, 
        so.status,
        'SALES_ORDER' as source_table
      FROM sales_orders so
      LEFT JOIN companies c ON so.company_id = c.id
      WHERE so.id = ?`,
      [salesOrderId]
    );

    // If not found in sales_orders, check the 'orders' table
    if (orderRows.length === 0) {
      console.log(`[createShipmentOrder] Not found in sales_orders, checking orders table for ID: ${salesOrderId}`);
      const [altOrderRows] = await connection.query(
        `SELECT 
          o.id,
          o.order_no,
          o.client_id as company_id,
          c.company_name,
          o.delivery_date as target_dispatch_date,
          'NORMAL' as production_priority,
          o.status,
          'ORDERS' as source_table
        FROM orders o
        LEFT JOIN companies c ON o.client_id = c.id
        WHERE o.id = ?`,
        [salesOrderId]
      );
      
      if (altOrderRows.length > 0) {
        const altOrder = altOrderRows[0];
        console.log(`[createShipmentOrder] Found in orders table. Syncing to sales_orders to satisfy foreign key...`);
        
        // Auto-create entry in sales_orders to satisfy foreign key constraint in shipment_orders
        await connection.execute(
          `INSERT IGNORE INTO sales_orders (id, company_id, so_number, target_dispatch_date, status, current_department, request_accepted, is_sales_order)
           VALUES (?, ?, ?, ?, ?, 'SHIPMENT', 1, 1)`,
          [
            altOrder.id, 
            altOrder.company_id, 
            altOrder.order_no || `ORD-${String(altOrder.id).padStart(4, '0')}`, 
            altOrder.target_dispatch_date, 
            'READY_FOR_SHIPMENT'
          ]
        );
        
        // Use the data from the orders table
        orderRows = altOrderRows;
      }
    }

    console.log(`[createShipmentOrder] Found ${orderRows.length} rows`);
    if (orderRows.length === 0) {
        console.error(`[createShipmentOrder] Order not found for ID: ${salesOrderId} in both sales_orders and orders tables`);
        // Log all available IDs for debugging
        const [allSalesIds] = await connection.query('SELECT id FROM sales_orders');
        const [allOrderIds] = await connection.query('SELECT id FROM orders');
        console.log(`[createShipmentOrder] Available sales_orders IDs: ${allSalesIds.map(o => o.id).join(', ')}`);
        console.log(`[createShipmentOrder] Available orders IDs: ${allOrderIds.map(o => o.id).join(', ')}`);
        throw new Error('Order not found');
    }

    const order = orderRows[0];

    // 3. Generate Shipment Code
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const shipmentPrefix = order.source_table === 'ORDERS' ? 'ORD' : 'SO';
    const shipmentCode = `SHP-${year}${month}-${shipmentPrefix}${String(salesOrderId).padStart(4, '0')}`;

    // 4. Create Shipment Order
    await connection.execute(
      `INSERT INTO shipment_orders (shipment_code, sales_order_id, customer_id, customer_name, dispatch_target_date, priority, status)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING_ACCEPTANCE')`,
      [shipmentCode, salesOrderId, order?.company_id || null, order?.company_name || null, order?.target_dispatch_date || null, order?.production_priority || 'NORMAL']
    );

    // 5. Update Order Status to READY_FOR_SHIPMENT if not already
    const targetStatus = 'READY_FOR_SHIPMENT';
    if (order.status !== targetStatus) {
      if (order.source_table === 'SALES_ORDER') {
        await connection.execute(
          'UPDATE sales_orders SET status = ?, current_department = ?, updated_at = NOW() WHERE id = ?',
          [targetStatus, 'SHIPMENT', salesOrderId]
        );
      } else {
        await connection.execute(
          'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
          [targetStatus, salesOrderId]
        );
      }
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
