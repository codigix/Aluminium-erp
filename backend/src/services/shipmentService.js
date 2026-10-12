const pool = require('../config/db');
const { postInventoryFromDispatch } = require('./inventoryPostingService');
const { addStockLedgerEntry } = require('./stockService');
const emailService = require('../utils/emailService');
const puppeteer = require('puppeteer');
const {
  assertShipmentTransition,
  SHIPMENT_DISPATCHED_STATUSES,
  canTransitionSalesOrder,
  salesOrderRank,
  SALES_ORDER_STAGES,
  workflowError
} = require('../config/workflow');
const { nextDocumentNumber } = require('../utils/documentNumber');

// After a dispatch or delivery, move the sales order to PARTIALLY_SHIPPED,
// SHIPPED or DELIVERED based on quantities actually dispatched.
const syncSalesOrderShippingStatus = async (connection, salesOrderId) => {
  if (!salesOrderId) return;
  const [soRows] = await connection.query('SELECT status FROM sales_orders WHERE id = ?', [salesOrderId]);
  if (!soRows.length) return;

  const [[ordered]] = await connection.query(
    `SELECT COALESCE(SUM(quantity), 0) AS qty FROM sales_order_items
     WHERE sales_order_id = ? AND parent_bom_id IS NULL
       AND (status IS NULL OR UPPER(status) NOT IN ('REJECTED', 'CANCELLED'))`,
    [salesOrderId]
  );
  const [[dispatched]] = await connection.query(
    `SELECT COALESCE(SUM(dci.quantity), 0) AS qty
     FROM delivery_challan_items dci
     JOIN delivery_challans dc ON dci.challan_id = dc.id
     JOIN shipment_orders s ON dc.shipment_id = s.id
     WHERE s.sales_order_id = ?`,
    [salesOrderId]
  );
  const [[open]] = await connection.query(
    `SELECT
       SUM(status NOT IN ('DELIVERED', 'CLOSED', 'CANCELLED', 'REJECTED')) AS undelivered,
       COUNT(*) AS total
     FROM shipment_orders WHERE sales_order_id = ?`,
    [salesOrderId]
  );

  const orderedQty = parseFloat(ordered.qty) || 0;
  const dispatchedQty = parseFloat(dispatched.qty) || 0;
  if (dispatchedQty <= 0) return;

  const fullyShipped = orderedQty > 0 && dispatchedQty + 0.001 >= orderedQty;
  let target = fullyShipped ? 'SHIPPED' : 'PARTIALLY_SHIPPED';
  if (fullyShipped && Number(open.total) > 0 && Number(open.undelivered) === 0) target = 'DELIVERED';

  const current = soRows[0].status;
  if (salesOrderRank(target) > salesOrderRank(current) && canTransitionSalesOrder(current, target).ok) {
    await connection.execute(
      "UPDATE sales_orders SET status = ?, current_department = 'ACCOUNTS', updated_at = NOW() WHERE id = ?",
      [target, salesOrderId]
    );
  }
};

const getShipmentOrders = async () => {
  const [rows] = await pool.query(`
    SELECT 
      s.id,
      so.id as so_id,
      COALESCE(c_so.company_name, c.company_name) as customer_name, 
      cp.po_number as customer_po_number, 
      s.id as shipment_order_id, 
      s.shipment_code, 
      s.status as shipment_status,
      s.dispatch_target_date,
      s.priority,
      s.sales_order_id,
      s.customer_id,
      s.planned_dispatch_date,
      s.transporter,
      s.vehicle_number,
      s.driver_name,
      s.driver_contact,
      s.driver_email,
      s.estimated_delivery_date,
      s.packing_status,
      s.customer_name as snapshot_customer_name,
      s.customer_phone as snapshot_customer_phone,
      s.customer_email as snapshot_customer_email,
      s.shipping_address as snapshot_shipping_address,
      s.billing_address as snapshot_billing_address,
      s.current_lat,
      s.current_lng,
      s.last_location_update
    FROM shipment_orders s
    LEFT JOIN sales_orders so ON s.sales_order_id = so.id
    LEFT JOIN companies c_so ON so.company_id = c_so.id
    LEFT JOIN companies c ON s.customer_id = c.id
    LEFT JOIN customer_pos cp ON so.customer_po_id = cp.id
    ORDER BY s.created_at DESC
  `);

  for (const row of rows) {
    if (row.shipment_code && row.shipment_code.includes('-QC')) {
      const match = row.shipment_code.match(/-QC(\d+)$/);
      if (match) {
        const qcId = parseInt(match[1], 10);
        const [poRows] = await pool.query(`
          SELECT 
            g.po_number, 
            v.vendor_name,
            so.id as linked_so_id,
            c.company_name as linked_customer_name
          FROM qc_inspections qc
          JOIN grns g ON qc.grn_id = g.id
          LEFT JOIN purchase_orders po ON g.po_number = po.po_number
          LEFT JOIN vendors v ON po.vendor_id = v.id
          LEFT JOIN sales_orders so ON po.sales_order_id = so.id
          LEFT JOIN companies c ON so.company_id = c.id
          WHERE qc.id = ?
        `, [qcId]);
        if (poRows.length > 0) {
          const poData = poRows[0];
          row.so_number = poData.linked_so_id ? `SO-${String(poData.linked_so_id).padStart(4, '0')}` : poData.po_number;
          row.company_name = row.snapshot_customer_name || row.customer_name || poData.linked_customer_name || poData.vendor_name;
        }
      }
    } else {
      row.so_number = row.customer_po_number || (row.so_id ? `SO-${String(row.so_id).padStart(4, '0')}` : null);
      row.company_name = row.snapshot_customer_name || row.customer_name;
    }
    // Always ensure ID properties are set
    row.id = row.id || row.shipment_order_id;
    row.shipment_order_id = row.id;
  }
  return rows;
};

const getShipmentOrderById = async (id) => {
  const [rows] = await pool.query(`
    SELECT 
      s.*, 
      so.id as so_id,
      so.project_name,
      COALESCE(c_so.company_name, c.company_name) as customer_name, 
      cp.po_number as customer_po_number, 
      s.status as shipment_status,
      s.customer_name as snapshot_customer_name,
      s.customer_phone as snapshot_customer_phone,
      s.customer_email as snapshot_customer_email,
      s.shipping_address as snapshot_shipping_address,
      s.billing_address as snapshot_billing_address
    FROM shipment_orders s
    LEFT JOIN sales_orders so ON s.sales_order_id = so.id
    LEFT JOIN companies c_so ON so.company_id = c_so.id
    LEFT JOIN companies c ON s.customer_id = c.id
    LEFT JOIN customer_pos cp ON so.customer_po_id = cp.id
    WHERE s.id = ?
  `, [id]);

  if (rows.length === 0) return null;
  const shipment = rows[0];

  let items = [];

  if (shipment.shipment_code && shipment.shipment_code.includes('-QC')) {
    // Extract QC ID from shipment_code (e.g. SHP-202602-QC0007)
    const match = shipment.shipment_code.match(/-QC(\d+)$/);
    if (match) {
      const qcId = parseInt(match[1], 10);

      // Fetch items from QC Inspection Items
      const [qcItems] = await pool.query(`
        SELECT 
          COALESCE(NULLIF(TRIM(qci.item_code), ''), NULLIF(TRIM(poi.item_code), ''), poi.drawing_no) as item_code,
          COALESCE(NULLIF(TRIM(poi.material_name), ''), poi.description) as description,
          qci.po_qty as quantity,
          poi.unit as unit,
          COALESCE(w.warehouse_name, 'MAIN STORE') as warehouse
        FROM qc_inspection_items qci
        LEFT JOIN grn_items gi ON qci.grn_item_id = gi.id
        LEFT JOIN purchase_order_items poi ON gi.po_item_id = poi.id
        LEFT JOIN warehouses w ON qci.warehouse_id = w.id
        LEFT JOIN stock_balance sb ON sb.item_code = COALESCE(NULLIF(TRIM(qci.item_code), ''), NULLIF(TRIM(poi.item_code), ''), poi.drawing_no)
        WHERE qci.qc_inspection_id = ?
        AND (sb.material_type = 'FG' OR poi.material_name LIKE '%FG%' OR poi.description LIKE '%FG%')
      `, [qcId]);
      items = qcItems;

      // Also get PO number and Vendor if SO info is missing
      const [poRows] = await pool.query(`
        SELECT 
          g.po_number, 
          v.vendor_name,
          so.id as linked_so_id,
          c.company_name as linked_customer_name
        FROM qc_inspections qc
        JOIN grns g ON qc.grn_id = g.id
        LEFT JOIN purchase_orders po ON g.po_number = po.po_number
        LEFT JOIN vendors v ON po.vendor_id = v.id
        LEFT JOIN sales_orders so ON po.sales_order_id = so.id
        LEFT JOIN companies c ON so.company_id = c.id
        WHERE qc.id = ?
      `, [qcId]);

      if (poRows.length > 0) {
        const poData = poRows[0];
        shipment.po_number = poData.po_number;
        shipment.so_number = poData.linked_so_id ? `SO-${String(poData.linked_so_id).padStart(4, '0')}` : poData.po_number;
        shipment.company_name = shipment.customer_name || poData.linked_customer_name || poData.vendor_name;
      }
    }
  } else {
    // Standard Sales Order based shipment - fetch only dispatched items from shipment job cards
    let queryStr = `
      SELECT 
        soi.item_code,
        soi.description,
        soi.drawing_no,
        soi.unit,
        SUM(COALESCE(jc.dispatch_qty, jc.accepted_qty, 0)) as quantity,
        COALESCE(w.warehouse_name, 'MAIN STORE') as warehouse
      FROM sales_order_items soi
      JOIN work_orders wo ON wo.sales_order_item_id = soi.id
      JOIN job_cards jc ON jc.work_order_id = wo.id
      LEFT JOIN warehouses w ON jc.target_warehouse_id = w.id
    `;
    let queryParams = [];
    if (shipment.job_card_id) {
      queryStr += ` WHERE jc.id = ? `;
      queryParams.push(shipment.job_card_id);
    } else if (shipment.sales_order_item_id) {
      queryStr += ` WHERE soi.id = ? AND (jc.operation_name = 'shipment' OR jc.operation_name = 'dispatch') `;
      queryParams.push(shipment.sales_order_item_id);
    } else {
      queryStr += ` WHERE soi.sales_order_id = ? AND (jc.operation_name = 'shipment' OR jc.operation_name = 'dispatch') `;
      queryParams.push(shipment.sales_order_id);
    }
    queryStr += ` GROUP BY soi.id, w.warehouse_name HAVING quantity > 0 `;

    const [dispatchedItems] = await pool.query(queryStr, queryParams);

    if (shipment.job_card_id && shipment.quantity !== null && shipment.quantity !== undefined) {
      for (const item of dispatchedItems) {
        item.quantity = shipment.quantity;
      }
    }

    if (dispatchedItems.length > 0) {
      items = dispatchedItems;
    } else if (shipment.shipment_code && shipment.shipment_code.includes('-ORD')) {
      // Fallback to order_items if it's an ORD-based shipment
      let ordQueryStr = `
        SELECT 
          oi.item_code,
          oi.drawing_no,
          oi.description,
          oi.unit,
          SUM(COALESCE(jc.dispatch_qty, jc.accepted_qty, 0)) as quantity,
          COALESCE(w.warehouse_name, 'MAIN STORE') as warehouse
        FROM order_items oi
        JOIN work_orders wo ON wo.sales_order_item_id = oi.id
        JOIN job_cards jc ON jc.work_order_id = wo.id
        LEFT JOIN warehouses w ON jc.target_warehouse_id = w.id
      `;
      let ordQueryParams = [];
      if (shipment.job_card_id) {
        ordQueryStr += ` WHERE jc.id = ? `;
        ordQueryParams.push(shipment.job_card_id);
      } else if (shipment.sales_order_item_id) {
        ordQueryStr += ` WHERE oi.id = ? AND (jc.operation_name = 'shipment' OR jc.operation_name = 'dispatch') `;
        ordQueryParams.push(shipment.sales_order_item_id);
      } else {
        ordQueryStr += ` WHERE oi.order_id = ? AND (jc.operation_name = 'shipment' OR jc.operation_name = 'dispatch') `;
        ordQueryParams.push(shipment.sales_order_id);
      }
      ordQueryStr += ` GROUP BY oi.id, w.warehouse_name HAVING quantity > 0 `;

      const [orderItems] = await pool.query(ordQueryStr, ordQueryParams);
      items = orderItems;
    }

    shipment.po_number = shipment.customer_po_number;
    shipment.so_number = shipment.customer_po_number || (shipment.so_id ? `SO-${String(shipment.so_id).padStart(4, '0')}` : null);
    shipment.company_name = shipment.customer_name;
  }

  shipment.shipment_order_id = shipment.id;
  shipment.items = items;
  return shipment;
};

const updateShipmentStatus = async (shipmentOrderId, status) => {
  console.log(`Updating shipment status. ID: ${shipmentOrderId}, Status: ${status}`);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Get current shipment data (locked so two clicks can't dispatch twice)
    const [currentRows] = await connection.query('SELECT * FROM shipment_orders WHERE id = ? FOR UPDATE', [shipmentOrderId]);
    if (currentRows.length === 0) {
      console.error(`Shipment not found for ID: ${shipmentOrderId}`);
      throw new Error(`Shipment order not found (ID: ${shipmentOrderId})`);
    }
    const shipment = currentRows[0];

    let emailToTrigger = null;
    status = assertShipmentTransition(shipment.status, status);
    if (String(shipment.status || '').toUpperCase() === status) {
      // Re-sending the current status is a no-op: no second stock movement or challan
      await connection.commit();
      return { success: true, status, unchanged: true };
    }

    // 2. Update Shipment Order Status
    await connection.execute(
      'UPDATE shipment_orders SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, shipmentOrderId]
    );

    // 3. Handle specific status transitions
    if (status === 'ACCEPTED') {
      if (shipment.sales_order_id) {
        // A later partial shipment must not pull a PARTIALLY_SHIPPED order back
        const [soRows] = await connection.query('SELECT status FROM sales_orders WHERE id = ?', [shipment.sales_order_id]);
        if (soRows.length && salesOrderRank(soRows[0].status) <= SALES_ORDER_STAGES.READY_FOR_SHIPMENT &&
            canTransitionSalesOrder(soRows[0].status, 'READY_FOR_SHIPMENT').ok) {
          await connection.execute(
            "UPDATE sales_orders SET status = 'READY_FOR_SHIPMENT', updated_at = NOW() WHERE id = ?",
            [shipment.sales_order_id]
          );
        }
      }
    } else if (status === 'DISPATCHED') {
      // Start Dispatch - Reduce stock
      // We need the items for this shipment
      let items = [];
      if (shipment.shipment_code && shipment.shipment_code.includes('-QC')) {
        const match = shipment.shipment_code.match(/-QC(\d+)$/);
        if (match) {
          const qcId = parseInt(match[1], 10);
          const [qcItems] = await connection.query(`
            SELECT 
              COALESCE(NULLIF(TRIM(qci.item_code), ''), qci.drawing_no) as item_code,
              COALESCE(NULLIF(TRIM(poi.material_name), ''), poi.description) as description,
              qci.po_qty as quantity, 
              poi.unit as unit,
              qci.warehouse_id
            FROM qc_inspection_items qci
            LEFT JOIN grn_items gi ON qci.grn_item_id = gi.id
            LEFT JOIN purchase_order_items poi ON gi.po_item_id = poi.id
            LEFT JOIN stock_balance sb ON sb.item_code = qci.item_code
            WHERE qci.qc_inspection_id = ?
            AND (sb.material_type = 'FG' OR qci.item_code LIKE '%FG%')
          `, [qcId]);
          items = qcItems;
        }
      } else {
        // Standard Sales Order based shipment
        let queryStr = `
          SELECT 
            COALESCE(NULLIF(TRIM(soi.item_code), ''), soi.drawing_no) as item_code,
            soi.description,
            SUM(COALESCE(jc.dispatch_qty, jc.accepted_qty, 0)) as quantity,
            soi.unit,
            COALESCE(w.warehouse_name, 'MAIN STORE') as warehouse,
            jc.target_warehouse_id as warehouse_id
          FROM sales_order_items soi
          JOIN work_orders wo ON wo.sales_order_item_id = soi.id
          JOIN job_cards jc ON jc.work_order_id = wo.id
          LEFT JOIN warehouses w ON jc.target_warehouse_id = w.id
        `;
        let queryParams = [];
        if (shipment.job_card_id) {
          queryStr += ` WHERE jc.id = ? `;
          queryParams.push(shipment.job_card_id);
        } else if (shipment.sales_order_item_id) {
          queryStr += ` WHERE soi.id = ? AND (jc.operation_name = 'shipment' OR jc.operation_name = 'dispatch') `;
          queryParams.push(shipment.sales_order_item_id);
        } else {
          queryStr += ` WHERE soi.sales_order_id = ? AND (jc.operation_name = 'shipment' OR jc.operation_name = 'dispatch') `;
          queryParams.push(shipment.sales_order_id);
        }
        queryStr += ` GROUP BY soi.id, w.warehouse_name HAVING quantity > 0 `;

        const [soItems] = await connection.query(queryStr, queryParams);

        if (soItems.length > 0 && shipment.job_card_id && parseFloat(shipment.quantity) > 0) {
          // A job-card shipment carries only the increment released for it,
          // not the job card's cumulative dispatch quantity
          items = soItems.map(item => ({ ...item, quantity: parseFloat(shipment.quantity) }));
        } else if (soItems.length > 0) {
          // Whole-order shipment: ship only what other shipments haven't already taken
          const [alreadyRows] = await connection.query(
            `SELECT dci.item_code, COALESCE(SUM(dci.quantity), 0) AS qty
             FROM delivery_challan_items dci
             JOIN delivery_challans dc ON dci.challan_id = dc.id
             JOIN shipment_orders s ON dc.shipment_id = s.id
             WHERE s.sales_order_id = ? AND s.id <> ?
             GROUP BY dci.item_code`,
            [shipment.sales_order_id, shipmentOrderId]
          );
          const already = new Map(alreadyRows.map(row => [String(row.item_code), parseFloat(row.qty) || 0]));
          items = soItems
            .map(item => ({ ...item, quantity: Math.max(0, (parseFloat(item.quantity) || 0) - (already.get(String(item.item_code)) || 0)) }))
            .filter(item => item.quantity > 0);
        } else if (shipment.shipment_code && shipment.shipment_code.includes('-ORD')) {
          let ordQueryStr = `
            SELECT 
              COALESCE(NULLIF(TRIM(oi.item_code), ''), oi.drawing_no) as item_code,
              oi.description,
              SUM(COALESCE(jc.dispatch_qty, jc.accepted_qty, 0)) as quantity,
              'PCS' as unit,
              COALESCE(w.warehouse_name, 'MAIN STORE') as warehouse,
              jc.target_warehouse_id as warehouse_id
            FROM order_items oi
            JOIN work_orders wo ON wo.sales_order_item_id = oi.id
            JOIN job_cards jc ON jc.work_order_id = wo.id
            LEFT JOIN warehouses w ON jc.target_warehouse_id = w.id
          `;
          let ordQueryParams = [];
          if (shipment.job_card_id) {
            ordQueryStr += ` WHERE jc.id = ? `;
            ordQueryParams.push(shipment.job_card_id);
          } else if (shipment.sales_order_item_id) {
            ordQueryStr += ` WHERE oi.id = ? AND (jc.operation_name = 'shipment' OR jc.operation_name = 'dispatch') `;
            ordQueryParams.push(shipment.sales_order_item_id);
          } else {
            ordQueryStr += ` WHERE oi.order_id = ? AND (jc.operation_name = 'shipment' OR jc.operation_name = 'dispatch') `;
            ordQueryParams.push(shipment.sales_order_id);
          }
          ordQueryStr += ` GROUP BY oi.id, w.warehouse_name HAVING quantity > 0 `;

          const [orderItems] = await connection.query(ordQueryStr, ordQueryParams);
          items = orderItems;
        }
      }

      if (items.length === 0) {
        throw workflowError(
          'Nothing to dispatch: no released quantity found for this shipment. Record the dispatch quantity on the shipment job card first.'
        );
      }

      if (items.length > 0) {
        for (const item of items) {
          const itemCode = item.item_code || item.drawing_no || 'UNKNOWN';
          if (itemCode === 'UNKNOWN') {
            console.warn(`Skipping stock ledger entry for item with no code/drawing for shipment ${shipment.shipment_code}`);
          } else {
            // Update stock_ledger and stock_balance using addStockLedgerEntry
            // This ensures warehouse-specific tracking is updated correctly
            await addStockLedgerEntry(
              itemCode,
              'OUT',
              item.quantity,
              'DISPATCH',
              shipmentOrderId,
              shipment.shipment_code,
              {
                connection,
                remarks: `Dispatched for shipment ${shipment.shipment_code}`,
                warehouse: item.warehouse_id || item.warehouse || 'MAIN STORE'
              }
            );
          }
        }
      }

      // 4. Auto-create Delivery Challan (number reserved under a row lock)
      const challanNumber = await nextDocumentNumber(connection, 'DELIVERY_CHALLAN');

      const [challanResult] = await connection.execute(
        'INSERT INTO delivery_challans (challan_number, shipment_id, customer_id, delivery_status, dispatch_time) VALUES (?, ?, ?, ?, NOW())',
        [challanNumber, shipmentOrderId, shipment.customer_id, 'DRAFT']
      );
      const challanId = challanResult.insertId;

      // Insert items into delivery_challan_items
      for (const item of items) {
        await connection.execute(
          'INSERT INTO delivery_challan_items (challan_id, item_code, description, quantity, unit) VALUES (?, ?, ?, ?, ?)',
          [challanId, item.item_code || item.drawing_no || 'UNKNOWN', item.description || '', item.quantity, item.unit || 'NOS']
        );
      }

      // 5. Trigger DISPATCHED Email
      // We do this after commit or here? Better after commit to be safe, but we need connection data.
      // Let's gather data and send after commit.
      emailToTrigger = {
        status: 'DISPATCHED',
        shipment,
        challan: {
          challan_number: challanNumber,
          shipment_code: shipment.shipment_code,
          dispatch_time: new Date(),
          customer_name: shipment.customer_name,
          snapshot_customer_name: shipment.customer_name,
          snapshot_customer_phone: shipment.customer_phone,
          snapshot_customer_email: shipment.customer_email,
          snapshot_shipping_address: shipment.shipping_address,
          snapshot_billing_address: shipment.billing_address,
          transporter: shipment.transporter,
          vehicle_number: shipment.vehicle_number,
          driver_name: shipment.driver_name,
          driver_contact: shipment.driver_contact,
          items: items
        }
      };

    } else if (status === 'OUT_FOR_DELIVERY') {
      emailToTrigger = { status: 'OUT_FOR_DELIVERY', shipment };
    } else if (status === 'DELIVERED') {
      // Logic for auto-creating Delivery Challan could go here
      // For now just update the date
      await connection.execute(
        'UPDATE shipment_orders SET actual_delivery_date = NOW(), updated_at = NOW() WHERE id = ?',
        [shipmentOrderId]
      );
      emailToTrigger = { status: 'DELIVERED', shipment };
    }

    if (['DISPATCHED', 'DELIVERED', 'CLOSED'].includes(status)) {
      await syncSalesOrderShippingStatus(connection, shipment.sales_order_id);
    }

    await connection.commit();

    // 6. Async Email Sending (Outside transaction)
    if (emailToTrigger) {
      const { status: emailStatus, shipment: sData, challan } = emailToTrigger;

      (async () => {
        try {
          let attachments = [];
          if (emailStatus === 'DISPATCHED' && challan) {
            const html = emailService.generateChallanHTML(challan);
            const browser = await puppeteer.launch({
              headless: 'new',
              args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            });
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'networkidle0' });
            const pdfBuffer = await page.pdf({
              format: 'A4',
              printBackground: true,
              margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
            });
            await browser.close();

            attachments.push({
              filename: `Delivery_Challan_${challan.challan_number}.pdf`,
              content: pdfBuffer
            });
          }

          await emailService.sendShipmentStatusEmail(sData, emailStatus, attachments);
        } catch (err) {
          console.error('[Shipment Service] Post-status email trigger failed:', err);
        }
      })();
    }

    return { success: true, status };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateShipmentPlanning = async (id, planningData) => {
  const {
    planned_dispatch_date,
    transporter,
    vehicle_number,
    driver_name,
    driver_contact,
    driver_email,
    estimated_delivery_date,
    packing_status,
    status,
    customer_name,
    customer_phone,
    customer_email,
    shipping_address,
    billing_address
  } = planningData;

  // Planning may only move a shipment between planning states; dispatch and
  // delivery go through updateShipmentStatus (stock movement + challan).
  if (status) {
    const planningStatuses = ['PLANNING', 'PLANNED', 'READY_TO_DISPATCH'];
    if (!planningStatuses.includes(String(status).toUpperCase())) {
      throw workflowError(`Status ${status} cannot be set from shipment planning`, 400);
    }
    const [rows] = await pool.query('SELECT status FROM shipment_orders WHERE id = ?', [id]);
    if (!rows.length) throw workflowError('Shipment order not found', 404);
    assertShipmentTransition(rows[0].status, status);
  }

  const [result] = await pool.execute(
    `UPDATE shipment_orders SET 
      planned_dispatch_date = ?,
      transporter = ?,
      vehicle_number = ?,
      driver_name = ?,
      driver_contact = ?,
      driver_email = ?,
      estimated_delivery_date = ?,
      packing_status = ?,
      status = COALESCE(?, status),
      customer_name = ?,
      customer_phone = ?,
      customer_email = ?,
      shipping_address = ?,
      billing_address = ?,
      updated_at = NOW()
     WHERE id = ?`,
    [
      planned_dispatch_date || null,
      transporter || null,
      vehicle_number || null,
      driver_name || null,
      driver_contact || null,
      driver_email || null,
      estimated_delivery_date || null,
      packing_status || 'PENDING',
      status || null,
      customer_name || null,
      customer_phone || null,
      customer_email || null,
      shipping_address || null,
      billing_address || null,
      id
    ]
  );

  return { success: result.affectedRows > 0 };
};

const updateTracking = async (shipmentId, { lat, lng }) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Update shipment_orders
    await connection.execute(
      'UPDATE shipment_orders SET current_lat = ?, current_lng = ?, last_location_update = NOW() WHERE id = ?',
      [lat, lng, shipmentId]
    );

    // 2. Add log entry
    await connection.execute(
      'INSERT INTO shipment_tracking_logs (shipment_id, lat, lng) VALUES (?, ?, ?)',
      [shipmentId, lat, lng]
    );

    await connection.commit();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getTrackingHistory = async (shipmentId) => {
  const [rows] = await pool.query(
    'SELECT * FROM shipment_tracking_logs WHERE shipment_id = ? ORDER BY timestamp ASC',
    [shipmentId]
  );
  return rows;
};

const getTrackingDashboard = async () => {
  const [counts] = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'READY_TO_DISPATCH' THEN 1 END) as ready,
      COUNT(CASE WHEN status = 'DISPATCHED' THEN 1 END) as dispatched,
      COUNT(CASE WHEN status = 'IN_TRANSIT' THEN 1 END) as in_transit,
      COUNT(CASE WHEN status = 'OUT_FOR_DELIVERY' THEN 1 END) as out_for_delivery,
      COUNT(CASE WHEN status = 'DELIVERED' AND DATE(actual_delivery_date) = CURDATE() THEN 1 END) as delivered_today,
      COUNT(CASE WHEN status != 'DELIVERED' AND estimated_delivery_date < NOW() THEN 1 END) as "delayed"
    FROM shipment_orders
    WHERE status IN ('READY_TO_DISPATCH', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED')
  `);

  const [activeShipments] = await pool.query(`
    SELECT 
      s.id, s.shipment_code, s.status, s.driver_name, s.driver_contact, s.vehicle_number, s.estimated_delivery_date,
      s.current_lat, s.current_lng, s.customer_name as snapshot_customer_name,
      c.company_name as customer_name
    FROM shipment_orders s
    LEFT JOIN companies c ON s.customer_id = c.id
    WHERE s.status IN ('READY_TO_DISPATCH', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY')
    ORDER BY s.updated_at DESC
  `);

  return {
    stats: counts[0],
    activeShipments: activeShipments.map(s => ({
      ...s,
      customer: s.snapshot_customer_name || s.customer_name
    }))
  };
};

const getShipmentDashboard = async () => {
  // 1. KPI Stats
  const [counts] = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status IN ('READY_TO_DISPATCH', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY') THEN 1 END) as active,
      COUNT(CASE WHEN status = 'IN_TRANSIT' THEN 1 END) as in_transit,
      COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END) as delivered,
      COUNT(CASE WHEN status != 'DELIVERED' AND estimated_delivery_date < NOW() THEN 1 END) as \`delayed\`,
      (SELECT COUNT(*) FROM shipment_returns) as returns,
      COUNT(CASE WHEN status = 'DISPATCHED' THEN 1 END) as dispatched
    FROM shipment_orders
  `);

  // 2. Monthly Trend (Last 6 months)
  const [monthlyData] = await pool.query(`
    SELECT 
      DATE_FORMAT(created_at, '%b') as month,
      COUNT(*) as ordered,
      COUNT(CASE WHEN status IN ('DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED') THEN 1 END) as dispatched,
      COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END) as delivered,
      COUNT(CASE WHEN status LIKE 'RETURN_%' THEN 1 END) as returned,
      COUNT(CASE WHEN status != 'DELIVERED' AND estimated_delivery_date < created_at THEN 1 END) as \`delayed\`
    FROM shipment_orders
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
    GROUP BY DATE_FORMAT(created_at, '%Y-%m'), month
    ORDER BY DATE_FORMAT(created_at, '%Y-%m') ASC
  `);

  // 3. Recent Shipments
  const [recentShipments] = await pool.query(`
    SELECT 
      s.id, s.shipment_code, s.status, s.updated_at as date,
      COALESCE(s.customer_name, c.company_name) as customer
    FROM shipment_orders s
    LEFT JOIN companies c ON s.customer_id = c.id
    ORDER BY s.updated_at DESC
    LIMIT 10
  `);

  return {
    stats: counts[0],
    monthlyData,
    recentShipments: recentShipments.map(s => ({
      ...s,
      date: s.date ? new Date(s.date).toLocaleDateString() : 'N/A'
    }))
  };
};

const getShipmentReports = async () => {
  // 1. Overall Stats with growth (mock growth for now)
  const [counts] = await pool.query(`
    SELECT 
      COUNT(*) as total_shipments,
      COUNT(CASE WHEN status != 'DELIVERED' AND estimated_delivery_date < NOW() THEN 1 END) as total_delayed,
      (SELECT COUNT(*) FROM shipment_returns) as total_returns,
      (SELECT COUNT(DISTINCT customer_id) FROM shipment_orders) as total_customers,
      (SELECT COALESCE(SUM(soi.quantity * soi.rate), 0) FROM sales_order_items soi JOIN shipment_orders s ON s.sales_order_id = soi.sales_order_id) as total_revenue
    FROM shipment_orders
  `);

  // 2. Shipments by Status (Monthly)
  const [statusTrends] = await pool.query(`
    SELECT 
      DATE_FORMAT(created_at, '%b') as month,
      COUNT(CASE WHEN status = 'READY_TO_DISPATCH' THEN 1 END) as ordered,
      COUNT(CASE WHEN status = 'DISPATCHED' THEN 1 END) as dispatched,
      COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END) as delivered,
      COUNT(CASE WHEN status LIKE 'RETURN_%' THEN 1 END) as returned,
      COUNT(CASE WHEN status != 'DELIVERED' AND estimated_delivery_date < created_at THEN 1 END) as \`delayed\`
    FROM shipment_orders
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
    GROUP BY DATE_FORMAT(created_at, '%Y-%m'), month
    ORDER BY DATE_FORMAT(created_at, '%Y-%m') ASC
  `);

  // 3. Shipments by Region (Top Drivers as proxy for regions if no region field)
  const [byRegion] = await pool.query(`
    SELECT 
      driver_name as name,
      status,
      COUNT(*) as count
    FROM shipment_orders
    WHERE driver_name IS NOT NULL
    GROUP BY driver_name, status
    LIMIT 10
  `);

  // 4. Shipments by Destination (Top Cities/Companies)
  const [byDestination] = await pool.query(`
    SELECT 
      COALESCE(s.customer_name, c.company_name) as destination,
      COUNT(*) as count,
      COUNT(CASE WHEN s.status = 'DELIVERED' THEN 1 END) as delivered,
      COUNT(CASE WHEN s.status != 'DELIVERED' AND s.estimated_delivery_date < NOW() THEN 1 END) as \`delayed\`
    FROM shipment_orders s
    LEFT JOIN companies c ON s.customer_id = c.id
    GROUP BY destination
    ORDER BY count DESC
    LIMIT 5
  `);

  // 5. Detailed Shipment Report (Daily for last 30 days)
  const [detailedTrend] = await pool.query(`
    SELECT 
      DATE_FORMAT(created_at, '%d %b') as date,
      COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END) as delivered,
      COUNT(CASE WHEN status != 'DELIVERED' AND estimated_delivery_date < created_at THEN 1 END) as \`delayed\`
    FROM shipment_orders
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY DATE(created_at), date
    ORDER BY DATE(created_at) ASC
  `);

  // 6. Recent Deliveries
  const [recentDeliveries] = await pool.query(`
    SELECT 
      s.id, s.shipment_code, s.status, s.updated_at as date,
      COALESCE(s.customer_name, c.company_name) as customer
    FROM shipment_orders s
    LEFT JOIN companies c ON s.customer_id = c.id
    ORDER BY s.updated_at DESC
    LIMIT 10
  `);

  return {
    stats: {
      ...counts[0],
      shipmentsGrowth: '+34%',
      delayedGrowth: '-9%',
      returnsGrowth: '+20%',
      customersGrowth: '+14%'
    },
    statusTrends,
    byRegion,
    byDestination,
    detailedTrend,
    recentDeliveries
  };
};

const deleteShipmentOrder = async (id) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Get shipment info first to see if it's linked to a Sales Order
    const [shipment] = await connection.query('SELECT sales_order_id, status, shipment_code FROM shipment_orders WHERE id = ? FOR UPDATE', [id]);
    if (!shipment.length) throw new Error('Shipment order not found');

    // Dispatched shipments have moved stock and issued a challan; they are records now
    if (SHIPMENT_DISPATCHED_STATUSES.includes(String(shipment[0].status || '').toUpperCase())) {
      throw workflowError(`Shipment ${shipment[0].shipment_code} is ${shipment[0].status} and cannot be deleted. Use a return instead.`);
    }

    // 2. Delete tracking logs
    await connection.execute('DELETE FROM shipment_tracking_logs WHERE shipment_id = ?', [id]);

    // 3. Delete delivery challans (and items)
    const [challans] = await connection.query('SELECT id FROM delivery_challans WHERE shipment_id = ?', [id]);
    for (const challan of challans) {
      await connection.execute('DELETE FROM delivery_challan_items WHERE challan_id = ?', [challan.id]);
    }
    await connection.execute('DELETE FROM delivery_challans WHERE shipment_id = ?', [id]);

    // 4. If it was linked to a Sales Order and not dispatched, we might want to reset the SO status
    // But usually deletion is a hard reset. We'll set SO status back to PRODUCTION_COMPLETED if it was READY_FOR_SHIPMENT
    if (shipment[0].sales_order_id && shipment[0].status !== 'DISPATCHED' && shipment[0].status !== 'DELIVERED') {
      await connection.execute(
        "UPDATE sales_orders SET status = 'PRODUCTION_COMPLETED', current_department = 'QUALITY' WHERE id = ? AND status = 'READY_FOR_SHIPMENT'",
        [shipment[0].sales_order_id]
      );
    }

    // 5. Delete the shipment order itself
    await connection.execute('DELETE FROM shipment_orders WHERE id = ?', [id]);

    await connection.commit();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  getShipmentOrders,
  getShipmentOrderById,
  updateShipmentStatus,
  updateShipmentPlanning,
  deleteShipmentOrder,
  updateTracking,
  getTrackingHistory,
  getTrackingDashboard,
  getShipmentDashboard,
  getShipmentReports
};
