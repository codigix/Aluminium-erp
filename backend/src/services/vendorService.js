const pool = require('../config/db');

const normalizeCode = (name) => {
  if (!name) return `SUP-${Date.now()}`;
  return `SUP-${Date.now()}`; // Matching screenshot style
};

const sanitizeValue = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
};

const createVendor = async (payload) => {
  const {
    vendorName,
    category,
    email,
    phone,
    location,
    rating = 0,
    status = 'ACTIVE',
    gstin,
    groupName,
    leadTime
  } = payload;

  if (!vendorName) {
    const error = new Error('Vendor name is required');
    error.statusCode = 400;
    throw error;
  }

  const [result] = await pool.execute(
    `INSERT INTO vendors
      (vendor_name, vendor_code, category, email, phone, location, rating, status, gstin, group_name, lead_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ,
    [
      vendorName,
      normalizeCode(vendorName),
      sanitizeValue(category),
      sanitizeValue(email),
      sanitizeValue(phone),
      sanitizeValue(location),
      parseFloat(rating) || 0,
      status,
      sanitizeValue(gstin),
      sanitizeValue(groupName),
      sanitizeValue(leadTime)
    ]
  );

  return { id: result.insertId, vendorName };
};

const getVendors = async () => {
  const [vendors] = await pool.query(
    'SELECT * FROM vendors ORDER BY status DESC, created_at DESC'
  );
  return vendors;
};

const getVendorById = async (vendorId) => {
  const [rows] = await pool.query(
    'SELECT * FROM vendors WHERE id = ?',
    [vendorId]
  );

  if (!rows.length) {
    const error = new Error('Vendor not found');
    error.statusCode = 404;
    throw error;
  }

  return rows[0];
};

const updateVendor = async (vendorId, payload) => {
  const {
    vendorName,
    category,
    email,
    phone,
    location,
    rating,
    status,
    gstin,
    groupName,
    leadTime
  } = payload;

  await getVendorById(vendorId);

  const updateFields = [];
  const updateValues = [];

  if (vendorName !== undefined) {
    updateFields.push('vendor_name = ?');
    updateValues.push(vendorName);
  }

  if (category !== undefined) {
    updateFields.push('category = ?');
    updateValues.push(sanitizeValue(category));
  }

  if (email !== undefined) {
    updateFields.push('email = ?');
    updateValues.push(sanitizeValue(email));
  }

  if (phone !== undefined) {
    updateFields.push('phone = ?');
    updateValues.push(sanitizeValue(phone));
  }

  if (location !== undefined) {
    updateFields.push('location = ?');
    updateValues.push(sanitizeValue(location));
  }

  if (rating !== undefined) {
    updateFields.push('rating = ?');
    updateValues.push(parseFloat(rating) || 0);
  }

  if (status !== undefined) {
    updateFields.push('status = ?');
    updateValues.push(status);
  }

  if (gstin !== undefined) {
    updateFields.push('gstin = ?');
    updateValues.push(sanitizeValue(gstin));
  }

  if (groupName !== undefined) {
    updateFields.push('group_name = ?');
    updateValues.push(sanitizeValue(groupName));
  }

  if (leadTime !== undefined) {
    updateFields.push('lead_time = ?');
    updateValues.push(sanitizeValue(leadTime));
  }

  if (updateFields.length === 0) {
    return { id: vendorId };
  }

  updateValues.push(vendorId);

  await pool.execute(
    `UPDATE vendors SET ${updateFields.join(', ')} WHERE id = ?`,
    updateValues
  );

  return { id: vendorId };
};

const deleteVendor = async (vendorId) => {
  await getVendorById(vendorId);
  await pool.execute('DELETE FROM vendors WHERE id = ?', [vendorId]);
};

const updateVendorStatus = async (vendorId, status) => {
  const validStatuses = ['ACTIVE', 'INACTIVE', 'BLOCKED'];
  if (!validStatuses.includes(status)) {
    const error = new Error('Invalid status');
    error.statusCode = 400;
    throw error;
  }

  await getVendorById(vendorId);
  await pool.execute('UPDATE vendors SET status = ? WHERE id = ?', [status, vendorId]);
  return status;
};

const getVendorStats = async () => {
  const [stats] = await pool.query(`
    SELECT 
      COUNT(*) as total_vendors,
      SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_vendors,
      AVG(rating) as avg_rating,
      SUM(total_orders) as total_orders
    FROM vendors
  `);

  return stats[0] || {
    total_vendors: 0,
    active_vendors: 0,
    avg_rating: 0,
    total_orders: 0
  };
};

module.exports = {
  createVendor,
  getVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
  updateVendorStatus,
  getVendorStats
};
