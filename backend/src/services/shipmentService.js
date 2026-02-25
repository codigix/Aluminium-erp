const pool = require('../config/db');
const { postInventoryFromDispatch } = require('./inventoryPostingService');
const { addStockLedgerEntry } = require('./stockService');

const getShipmentOrders = async () => {
  const [rows] = await pool.query(`
    SELECT 
      s.id,
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
      s.billing_address as snapshot_billing_address,
      s.current_lat,
      s.current_lng,
      s.last_location_update
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

  shipment.shipment_order_id = shipment.id;
  shipment.items = items;
  return shipment;
};

const updateShipmentStatus = async (shipmentOrderId, status) => {
  console.log(`Updating shipment status. ID: ${shipmentOrderId}, Status: ${status}`);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Get current shipment data
    const [currentRows] = await connection.query('SELECT * FROM shipment_orders WHERE id = ?', [shipmentOrderId]);
    if (currentRows.length === 0) {
      console.error(`Shipment not found for ID: ${shipmentOrderId}`);
      throw new Error(`Shipment order not found (ID: ${shipmentOrderId})`);
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
        const [soItems] = await connection.query(`
          SELECT 
            COALESCE(NULLIF(TRIM(soi.item_code), ''), soi.drawing_no) as item_code,
            soi.description,
            soi.quantity,
            soi.unit
          FROM sales_order_items soi
          LEFT JOIN stock_balance sb ON sb.item_code = soi.item_code
          WHERE soi.sales_order_id = ?
          AND (sb.material_type = 'FG' OR soi.item_type = 'FG' OR soi.description LIKE '%FG%')
        `, [shipment.sales_order_id]);
        items = soItems;
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

      // 4. Auto-create Delivery Challan
      const [maxChallanRows] = await connection.query('SELECT MAX(id) as max_id FROM delivery_challans');
      const nextId = (maxChallanRows[0].max_id || 0) + 1;
      const challanNumber = `DC-${new Date().getFullYear()}-${String(nextId).padStart(5, '0')}`;
      
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

module.exports = {
  getShipmentOrders,
  getShipmentOrderById,
  updateShipmentStatus,
  updateShipmentPlanning,
  updateTracking,
  getTrackingHistory,
  getTrackingDashboard,
  getShipmentDashboard,
  getShipmentReports
};
