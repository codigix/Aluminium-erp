const pool = require('../config/db');

const getDeliveryChallans = async () => {
  const [rows] = await pool.query(`
    SELECT 
      dc.*, 
      s.shipment_code, 
      c.company_name as customer_name,
      so.id as so_id
    FROM delivery_challans dc
    JOIN shipment_orders s ON dc.shipment_id = s.id
    JOIN companies c ON dc.customer_id = c.id
    LEFT JOIN sales_orders so ON s.sales_order_id = so.id
    ORDER BY dc.created_at DESC
  `);
  
  for (const row of rows) {
    row.so_number = row.so_id ? `SO-${String(row.so_id).padStart(4, '0')}` : '—';
  }
  
  return rows;
};

const getDeliveryChallanById = async (id) => {
  const [challanRows] = await pool.query(`
    SELECT 
      dc.*, 
      s.shipment_code, 
      c.company_name as customer_name,
      so.id as so_id,
      s.transporter,
      s.vehicle_number,
      s.driver_name,
      s.driver_contact,
      s.customer_name as snapshot_customer_name,
      s.customer_phone as snapshot_customer_phone,
      s.customer_email as snapshot_customer_email,
      s.shipping_address as snapshot_shipping_address,
      s.billing_address as snapshot_billing_address
    FROM delivery_challans dc
    JOIN shipment_orders s ON dc.shipment_id = s.id
    JOIN companies c ON dc.customer_id = c.id
    LEFT JOIN sales_orders so ON s.sales_order_id = so.id
    WHERE dc.id = ?
  `, [id]);

  if (challanRows.length === 0) return null;
  const challan = challanRows[0];
  challan.so_number = challan.so_id ? `SO-${String(challan.so_id).padStart(4, '0')}` : '—';

  const [itemRows] = await pool.query(`
    SELECT * FROM delivery_challan_items WHERE challan_id = ?
  `, [id]);
  challan.items = itemRows;

  return challan;
};

const updateDeliveryChallan = async (id, data) => {
  const { 
    delivery_status, 
    delivery_time, 
    receiver_name, 
    receiver_mobile 
  } = data;

  const [result] = await pool.execute(
    `UPDATE delivery_challans SET 
      delivery_status = COALESCE(?, delivery_status),
      delivery_time = COALESCE(?, delivery_time),
      receiver_name = COALESCE(?, receiver_name),
      receiver_mobile = COALESCE(?, receiver_mobile),
      updated_at = NOW()
     WHERE id = ?`,
    [delivery_status || null, delivery_time || null, receiver_name || null, receiver_mobile || null, id]
  );

  return { success: result.affectedRows > 0 };
};

module.exports = {
  getDeliveryChallans,
  getDeliveryChallanById,
  updateDeliveryChallan
};
