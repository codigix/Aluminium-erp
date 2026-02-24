const pool = require('../config/db');

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
      s.sales_order_id
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
          row.company_name = row.customer_name || poRows[0].vendor_name;
        }
      }
    } else {
      row.so_number = row.customer_po_number;
      row.company_name = row.customer_name;
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
          qci.item_code,
          poi.material_name as description,
          qci.po_qty as quantity,
          poi.unit as unit,
          COALESCE(w.warehouse_name, 'MAIN STORE') as warehouse
        FROM qc_inspection_items qci
        LEFT JOIN grn_items gi ON qci.grn_item_id = gi.id
        LEFT JOIN purchase_order_items poi ON gi.po_item_id = poi.id
        LEFT JOIN warehouses w ON qci.warehouse_id = w.id
        WHERE qci.qc_inspection_id = ?
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
    `, [shipment.sales_order_id]);
    items = soItems;
    
    shipment.po_number = shipment.customer_po_number;
    shipment.company_name = shipment.customer_name;
  }

  shipment.items = items;
  return shipment;
};

const updateShipmentStatus = async (shipmentOrderId, status) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Update Shipment Order Status
    await connection.execute(
      'UPDATE shipment_orders SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, shipmentOrderId]
    );

    // 2. If status is ACCEPTED, update Sales Order to reflect planning
    if (status === 'ACCEPTED') {
       const [shipRows] = await connection.query('SELECT sales_order_id FROM shipment_orders WHERE id = ?', [shipmentOrderId]);
       const salesOrderId = shipRows[0]?.sales_order_id;
       
       if (salesOrderId) {
         await connection.execute(
           "UPDATE sales_orders SET status = 'READY_FOR_SHIPMENT', updated_at = NOW() WHERE id = ?",
           [salesOrderId]
         );
       }
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

module.exports = {
  getShipmentOrders,
  getShipmentOrderById,
  updateShipmentStatus
};
