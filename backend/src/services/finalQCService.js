const pool = require('../config/db');
const { workflowError, normalizeSalesOrderStatus } = require('../config/workflow');

// Sales order statuses that sit in the Final QC queue
const FINAL_QC_STATUSES = ['PRODUCTION_COMPLETED', 'QC_IN_PROGRESS', 'QC_REJECTED', 'READY_FOR_SHIPMENT'];

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
    WHERE so.status IN ('PRODUCTION_COMPLETED', 'QC_IN_PROGRESS', 'QC_REJECTED', 'READY_FOR_SHIPMENT')
    ORDER BY so.created_at DESC
  `);
  return rows;
};

// A failed Final QC sends the failed quantity back to the shop floor instead of dead-ending.
// The rework card sits at the shipment step so the work order cannot complete until it is done.
const reopenForFinalQcFailure = async (connection, salesOrderId, failedQty, workOrderId, userId) => {
  const { nextDocumentNumber } = require('../utils/documentNumber');
  const { logProductionEvent } = require('./productionAuditService');

  const [candidates] = await connection.query(
    `SELECT wo.id, wo.wo_number FROM work_orders wo
     LEFT JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
     WHERE COALESCE(soi.sales_order_id, wo.sales_order_id) = ?
       AND wo.parent_wo_id IS NULL AND wo.source_type IN ('FG', 'PART') AND wo.status != 'CANCELLED'`,
    [salesOrderId]
  );
  const target = workOrderId ? candidates.find(c => Number(c.id) === Number(workOrderId)) : (candidates.length === 1 ? candidates[0] : null);
  if (!target) {
    return { created: false, reason: candidates.length > 1 ? 'Several work orders on this order; pass workOrderId to choose which one to rework' : 'No work order found to rework' };
  }

  const [[last]] = await connection.query(
    "SELECT sequence_no, workstation_id, operation_id FROM job_cards WHERE work_order_id = ? AND status != 'CANCELLED' ORDER BY sequence_no DESC, id DESC LIMIT 1",
    [target.id]
  );
  const jobCardNo = await nextDocumentNumber(connection, 'JOB_CARD');
  const [jc] = await connection.execute(
    `INSERT INTO job_cards (job_card_no, work_order_id, operation_id, workstation_id, planned_qty, status, operation_name,
                            execution_type, execution_mode, sequence_no, is_rework, remarks)
     VALUES (?, ?, ?, ?, ?, 'PENDING', 'Rework: Final QC failure', 'In-House', 'In-house', ?, 1, ?)`,
    [jobCardNo, target.id, last?.operation_id || null, last?.workstation_id || null, failedQty, last?.sequence_no || 1,
     `Final QC failed ${failedQty} pc(s) on sales order ${salesOrderId}`]
  );
  await connection.execute("UPDATE work_orders SET status = 'IN_PROGRESS' WHERE id = ? AND status = 'COMPLETED'", [target.id]);
  await logProductionEvent(connection, {
    entityType: 'WORK_ORDER', entityId: target.id, action: 'REOPENED_FINAL_QC',
    newValue: `rework ${jobCardNo} for ${failedQty} pc(s)`, userId
  });
  return { created: true, workOrderId: target.id, woNumber: target.wo_number, jobCardId: jc.insertId, jobCardNo };
};

const completeFinalQC = async (salesOrderId, inspectionData, userId = null) => {
  const { status, remarks, passedQty, failedQty } = inspectionData;
  const result = String(status || '').toUpperCase();
  if (!['PASSED', 'FAILED', 'REJECTED'].includes(result)) {
    throw workflowError('QC result must be PASSED or FAILED', 400);
  }
  const passed = parseFloat(passedQty) || 0;
  const failed = parseFloat(failedQty) || 0;
  if (passed < 0 || failed < 0) throw workflowError('Quantities cannot be negative', 400);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Only orders that finished production can be inspected
    const [soRows] = await connection.query('SELECT status FROM sales_orders WHERE id = ? FOR UPDATE', [salesOrderId]);
    if (soRows.length) {
      const current = normalizeSalesOrderStatus(soRows[0].status);
      if (!FINAL_QC_STATUSES.includes(current)) {
        throw workflowError(`Order is ${current || 'not ready'}; Final QC is only possible after production is completed`);
      }
    }

    // 2. Keep an inspection record (who, when, quantities, result)
    await connection.execute(
      `INSERT INTO final_qc_inspections (sales_order_id, result, passed_qty, failed_qty, remarks, inspected_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [salesOrderId, result === 'PASSED' ? 'PASSED' : 'FAILED', passed, failed, remarks || null, userId]
    );

    // 3. Update Sales Order Status
    const soStatus = result === 'PASSED' ? 'READY_FOR_SHIPMENT' : 'QC_REJECTED';
    await connection.execute(
      'UPDATE sales_orders SET status = ?, current_department = ?, updated_at = NOW() WHERE id = ?',
      [soStatus, result === 'PASSED' ? 'SHIPMENT' : 'QUALITY', salesOrderId]
    );

    // 3b. If FAILED, reopen production: the failed pieces go back as a rework job card
    let reopened = null;
    if (result !== 'PASSED' && failed > 0) {
      reopened = await reopenForFinalQcFailure(connection, salesOrderId, failed, inspectionData.workOrderId, userId);
    }

    // 4. If PASSED, auto-create a Shipment Order unless one already exists
    //    (job-card dispatch may have created per-item shipments)
    if (result === 'PASSED') {
      const [existingShipment] = await connection.query(
        "SELECT id FROM shipment_orders WHERE sales_order_id = ? AND status NOT IN ('CANCELLED', 'REJECTED')",
        [salesOrderId]
      );

      if (existingShipment.length === 0) {
        let [orderRows] = await connection.query(
          `SELECT 
            so.company_id, 
            c.company_name,
            so.target_dispatch_date, 
            so.production_priority,
            ct.email as customer_email,
            ct.phone as customer_phone,
            (SELECT CONCAT_WS(', ', line1, line2, city, state, pincode) FROM company_addresses WHERE company_id = so.company_id AND address_type = 'SHIPPING' LIMIT 1) as shipping_address,
            (SELECT CONCAT_WS(', ', line1, line2, city, state, pincode) FROM company_addresses WHERE company_id = so.company_id AND address_type = 'BILLING' LIMIT 1) as billing_address
          FROM sales_orders so
          LEFT JOIN companies c ON so.company_id = c.id
          LEFT JOIN (
            SELECT company_id, email, phone,
                   ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY contact_type = 'PRIMARY' DESC, id ASC) as rn
            FROM contacts
          ) ct ON ct.company_id = so.company_id AND ct.rn = 1
          WHERE so.id = ?`,
          [salesOrderId]
        );

        if (orderRows.length === 0) {
          const [altOrderRows] = await connection.query(
            `SELECT 
              o.client_id as company_id, 
              c.company_name,
              o.project_name,
              o.delivery_date as target_dispatch_date,
              'NORMAL' as production_priority,
              ct.email as customer_email,
              ct.phone as customer_phone,
              (SELECT CONCAT_WS(', ', line1, line2, city, state, pincode) FROM company_addresses WHERE company_id = o.client_id AND address_type = 'SHIPPING' LIMIT 1) as shipping_address,
              (SELECT CONCAT_WS(', ', line1, line2, city, state, pincode) FROM company_addresses WHERE company_id = o.client_id AND address_type = 'BILLING' LIMIT 1) as billing_address
            FROM orders o
            LEFT JOIN companies c ON o.client_id = c.id
            LEFT JOIN (
              SELECT company_id, email, phone,
                     ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY contact_type = 'PRIMARY' DESC, id ASC) as rn
              FROM contacts
            ) ct ON ct.company_id = o.client_id AND ct.rn = 1
            WHERE o.id = ?`,
            [salesOrderId]
          );

          if (altOrderRows.length > 0) {
            const altOrder = altOrderRows[0];
            console.log(`[updateFinalQC] Found in orders table. Syncing to sales_orders to satisfy foreign key...`);
            await connection.execute(
              `INSERT IGNORE INTO sales_orders (id, company_id, so_number, target_dispatch_date, status, current_department, request_accepted, is_sales_order, project_name)
               VALUES (?, ?, ?, ?, ?, 'SHIPMENT', 1, 1, ?)`,
              [
                salesOrderId,
                altOrder.company_id,
                `ORD-${String(salesOrderId).padStart(4, '0')}`,
                altOrder.target_dispatch_date,
                'READY_FOR_SHIPMENT',
                altOrder.project_name || null
              ]
            );
            orderRows = altOrderRows;
          }
        }

        const order = orderRows[0];

        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const shipmentCode = `SHP-${year}${month}-SO${String(salesOrderId).padStart(4, '0')}`;
        
        await connection.execute(
          `INSERT INTO shipment_orders (
            shipment_code, sales_order_id, customer_id, customer_name, 
            customer_phone, customer_email, shipping_address, billing_address,
            dispatch_target_date, priority, status
          )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_ACCEPTANCE')`,
          [
            shipmentCode, 
            salesOrderId, 
            order?.company_id || null, 
            order?.company_name || null,
            order?.customer_phone || null,
            order?.customer_email || null,
            order?.shipping_address || null,
            order?.billing_address || null,
            order?.target_dispatch_date || null, 
            order?.production_priority || 'NORMAL'
          ]
        );
      }
    }

    await connection.commit();
    return { success: true, status: soStatus, reopened };
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

    // 1. Check if shipment order already exists (whole-order or per-item from job cards)
    const [existingShipment] = await connection.query(
      "SELECT id FROM shipment_orders WHERE sales_order_id = ? AND status NOT IN ('CANCELLED', 'REJECTED')",
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
        ct.email as customer_email,
        ct.phone as customer_phone,
        (SELECT CONCAT_WS(', ', line1, line2, city, state, pincode) FROM company_addresses WHERE company_id = so.company_id AND address_type = 'SHIPPING' LIMIT 1) as shipping_address,
        (SELECT CONCAT_WS(', ', line1, line2, city, state, pincode) FROM company_addresses WHERE company_id = so.company_id AND address_type = 'BILLING' LIMIT 1) as billing_address,
        so.target_dispatch_date, 
        so.production_priority, 
        so.status,
        'SALES_ORDER' as source_table
      FROM sales_orders so
      LEFT JOIN companies c ON so.company_id = c.id
      LEFT JOIN (
        SELECT company_id, email, phone,
               ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY contact_type = 'PRIMARY' DESC, id ASC) as rn
        FROM contacts
      ) ct ON ct.company_id = so.company_id AND ct.rn = 1
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
          o.project_name,
          c.company_name,
          ct.email as customer_email,
          ct.phone as customer_phone,
          (SELECT CONCAT_WS(', ', line1, line2, city, state, pincode) FROM company_addresses WHERE company_id = o.client_id AND address_type = 'SHIPPING' LIMIT 1) as shipping_address,
          (SELECT CONCAT_WS(', ', line1, line2, city, state, pincode) FROM company_addresses WHERE company_id = o.client_id AND address_type = 'BILLING' LIMIT 1) as billing_address,
          o.delivery_date as target_dispatch_date,
          'NORMAL' as production_priority,
          o.status,
          'ORDERS' as source_table
        FROM orders o
        LEFT JOIN companies c ON o.client_id = c.id
        LEFT JOIN (
          SELECT company_id, email, phone,
                 ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY contact_type = 'PRIMARY' DESC, id ASC) as rn
          FROM contacts
        ) ct ON ct.company_id = o.client_id AND ct.rn = 1
        WHERE o.id = ?`,
        [salesOrderId]
      );
      
      if (altOrderRows.length > 0) {
        const altOrder = altOrderRows[0];
        console.log(`[createShipmentOrder] Found in orders table. Syncing to sales_orders to satisfy foreign key...`);
        
        // Auto-create entry in sales_orders to satisfy foreign key constraint in shipment_orders
        await connection.execute(
          `INSERT IGNORE INTO sales_orders (id, company_id, so_number, target_dispatch_date, status, current_department, request_accepted, is_sales_order, project_name)
           VALUES (?, ?, ?, ?, ?, 'SHIPMENT', 1, 1, ?)`,
          [
            altOrder.id, 
            altOrder.company_id, 
            altOrder.order_no || `ORD-${String(altOrder.id).padStart(4, '0')}`, 
            altOrder.target_dispatch_date, 
            'READY_FOR_SHIPMENT',
            altOrder.project_name || null
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
      `INSERT INTO shipment_orders (
        shipment_code, sales_order_id, customer_id, customer_name, 
        customer_phone, customer_email, shipping_address, billing_address,
        dispatch_target_date, priority, status
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_ACCEPTANCE')`,
      [
        shipmentCode, 
        salesOrderId, 
        order?.company_id || null, 
        order?.company_name || null, 
        order?.customer_phone || null,
        order?.customer_email || null,
        order?.shipping_address || null,
        order?.billing_address || null,
        order?.target_dispatch_date || null, 
        order?.production_priority || 'NORMAL'
      ]
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
