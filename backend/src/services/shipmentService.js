const pool = require('../config/db');
const { postInventoryFromDispatch } = require('./inventoryPostingService');
const { addStockLedgerEntry } = require('./stockService');

const getShipmentOrders = async () => {
  const [rows] = await pool.query(`
    SELECT 
      so.id as so_id,
      c.company_name as customer_name, 
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
      s.estimated_delivery_date,
      s.packing_status,
      s.customer_name as snapshot_customer_name,
      s.customer_phone as snapshot_customer_phone,
      s.customer_email as snapshot_customer_email,
      s.shipping_address as snapshot_shipping_address,
      s.billing_address as snapshot_billing_address
    FROM shipment_orders s
    LEFT JOIN sales_orders so ON s.sales_order_id = so.id
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
          SELECT g.po_number, v.vendor_name
          FROM qc_inspections qc
          JOIN grns g ON qc.grn_id = g.id
          LEFT JOIN purchase_orders po ON g.po_number = po.po_number
          LEFT JOIN vendors v ON po.vendor_id = v.id
          WHERE qc.id = ?
        `, [qcId]);
        if (poRows.length > 0) {
          row.so_number = poRows[0].po_number;
          row.company_name = row.snapshot_customer_name || row.customer_name || poRows[0].vendor_name;
        }
      }
    } else {
      row.so_number = row.customer_po_number || (row.so_id ? `SO-${String(row.so_id).padStart(4, '0')}` : null);
      row.company_name = row.snapshot_customer_name || row.customer_name;
      row.id = row.so_id;
    }
  }
  return rows;
};

const getShipmentOrderById = async (id) => {
  const [rows] = await pool.query(`
    SELECT 
      s.*, 
      so.id as so_id,
      so.project_name,
      c.company_name as customer_name, 
      cp.po_number as customer_po_number, 
      s.status as shipment_status
    FROM shipment_orders s
    LEFT JOIN sales_orders so ON s.sales_order_id = so.id
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
        SELECT g.po_number, v.vendor_name
        FROM qc_inspections qc
        JOIN grns g ON qc.grn_id = g.id
        LEFT JOIN purchase_orders po ON g.po_number = po.po_number
        LEFT JOIN vendors v ON po.vendor_id = v.id
        WHERE qc.id = ?
      `, [qcId]);
      
      if (poRows.length > 0) {
        shipment.po_number = poRows[0].po_number;
        shipment.company_name = shipment.customer_name || poRows[0].vendor_name;
      }
    }
  } else {
    // Standard Sales Order based shipment
    const [soItems] = await pool.query(`
      SELECT 
        soi.*,
        COALESCE(sb.warehouse, 'MAIN STORE') as warehouse
      FROM sales_order_items soi
      LEFT JOIN stock_balance sb ON sb.item_code = soi.item_code
      WHERE soi.sales_order_id = ? 
      AND (sb.material_type = 'FG' OR soi.item_type = 'FG' OR soi.description LIKE '%FG%')
    `, [shipment.sales_order_id]);
    items = soItems;
    
    shipment.po_number = shipment.customer_po_number;
    shipment.so_number = shipment.customer_po_number || (shipment.so_id ? `SO-${String(shipment.so_id).padStart(4, '0')}` : null);
    shipment.company_name = shipment.customer_name;
  }

  shipment.items = items;
  return shipment;
};

const updateShipmentStatus = async (shipmentOrderId, status) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Get current shipment data
    const [currentRows] = await connection.query('SELECT * FROM shipment_orders WHERE id = ?', [shipmentOrderId]);
    if (currentRows.length === 0) {
      throw new Error('Shipment order not found');
    }
    const shipment = currentRows[0];

    // 2. Update Shipment Order Status
    await connection.execute(
      'UPDATE shipment_orders SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, shipmentOrderId]
    );

    // 3. Handle specific status transitions
    if (status === 'ACCEPTED') {
       if (shipment.sales_order_id) {
         await connection.execute(
           "UPDATE sales_orders SET status = 'READY_FOR_SHIPMENT', updated_at = NOW() WHERE id = ?",
           [shipment.sales_order_id]
         );
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
            SELECT qci.item_code, qci.po_qty as quantity, qci.warehouse_id
            FROM qc_inspection_items qci
            LEFT JOIN stock_balance sb ON sb.item_code = qci.item_code
            WHERE qci.qc_inspection_id = ?
            AND (sb.material_type = 'FG' OR qci.item_code LIKE '%FG%')
          `, [qcId]);
          items = qcItems;
        }
      } else {
        const [soItems] = await connection.query(`
          SELECT soi.item_code, soi.quantity
          FROM sales_order_items soi
          LEFT JOIN stock_balance sb ON sb.item_code = soi.item_code
          WHERE soi.sales_order_id = ?
          AND (sb.material_type = 'FG' OR soi.item_type = 'FG' OR soi.description LIKE '%FG%')
        `, [shipment.sales_order_id]);
        items = soItems;
      }

      if (items.length > 0) {
        for (const item of items) {
          // 1. Update inventory master table
          await connection.execute(
            `UPDATE inventory SET stock_on_hand = stock_on_hand - ?, updated_at = NOW() WHERE item_code = ?`,
            [item.quantity, item.item_code]
          );

          // 2. Create entry in inventory_postings
          const [invRows] = await connection.query('SELECT id FROM inventory WHERE item_code = ?', [item.item_code]);
          if (invRows.length > 0) {
            await connection.execute(
              `INSERT INTO inventory_postings (inventory_id, posting_type, quantity, reference_type, reference_id, remarks) 
               VALUES (?, 'OUTWARD', ?, 'DISPATCH', ?, ?)`,
              [invRows[0].id, item.quantity, shipmentOrderId, `Dispatched for shipment ${shipment.shipment_code}`]
            );
          }

          // 3. Update stock_ledger and stock_balance using addStockLedgerEntry
          // This ensures warehouse-specific tracking is updated correctly
          await addStockLedgerEntry(
            item.item_code,
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
    } else if (status === 'DELIVERED') {
       // Logic for auto-creating Delivery Challan could go here
       // For now just update the date
       await connection.execute(
         'UPDATE shipment_orders SET actual_delivery_date = NOW(), updated_at = NOW() WHERE id = ?',
         [shipmentOrderId]
       );
    }

    await connection.commit();
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
    estimated_delivery_date,
    packing_status,
    status,
    customer_name,
    customer_phone,
    customer_email,
    shipping_address,
    billing_address
  } = planningData;

  const [result] = await pool.execute(
    `UPDATE shipment_orders SET 
      planned_dispatch_date = ?,
      transporter = ?,
      vehicle_number = ?,
      driver_name = ?,
      driver_contact = ?,
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

module.exports = {
  getShipmentOrders,
  getShipmentOrderById,
  updateShipmentStatus,
  updateShipmentPlanning
};
