const pool = require('../config/db');

const sanitizeValue = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
};

const createWarehouse = async (payload) => {
  const {
    warehouseCode,
    warehouseName,
    warehouseType,
    location,
    capacity,
    status = 'ACTIVE'
  } = payload;

  if (!warehouseCode || !warehouseName) {
    const error = new Error('Warehouse code and name are required');
    error.statusCode = 400;
    throw error;
  }

  const [result] = await pool.execute(
    `INSERT INTO warehouses
      (warehouse_code, warehouse_name, warehouse_type, location, capacity, status)
     VALUES (?, ?, ?, ?, ?, ?)`
    ,
    [
      warehouseCode,
      warehouseName,
      sanitizeValue(warehouseType),
      sanitizeValue(location),
      parseFloat(capacity) || null,
      status
    ]
  );

  return { id: result.insertId, warehouseCode };
};

const getWarehouses = async () => {
  const [warehouses] = await pool.query(
    'SELECT * FROM warehouses ORDER BY warehouse_code ASC'
  );
  return warehouses;
};

const getWarehouseById = async (id) => {
  const [rows] = await pool.query(
    'SELECT * FROM warehouses WHERE id = ?',
    [id]
  );

  if (!rows.length) {
    const error = new Error('Warehouse not found');
    error.statusCode = 404;
    throw error;
  }

  return rows[0];
};

const updateWarehouse = async (id, payload) => {
  const {
    warehouseCode,
    warehouseName,
    warehouseType,
    location,
    capacity,
    status
  } = payload;

  await getWarehouseById(id);

  const updateFields = [];
  const updateValues = [];

  if (warehouseCode !== undefined) {
    updateFields.push('warehouse_code = ?');
    updateValues.push(warehouseCode);
  }

  if (warehouseName !== undefined) {
    updateFields.push('warehouse_name = ?');
    updateValues.push(warehouseName);
  }

  if (warehouseType !== undefined) {
    updateFields.push('warehouse_type = ?');
    updateValues.push(sanitizeValue(warehouseType));
  }

  if (location !== undefined) {
    updateFields.push('location = ?');
    updateValues.push(sanitizeValue(location));
  }

  if (capacity !== undefined) {
    updateFields.push('capacity = ?');
    updateValues.push(parseFloat(capacity) || null);
  }

  if (status !== undefined) {
    updateFields.push('status = ?');
    updateValues.push(status);
  }

  if (updateFields.length === 0) {
    return { id };
  }

  updateValues.push(id);

  await pool.execute(
    `UPDATE warehouses SET ${updateFields.join(', ')} WHERE id = ?`,
    updateValues
  );

  return { id };
};

const deleteWarehouse = async (id) => {
  await getWarehouseById(id);
  await pool.execute('DELETE FROM warehouses WHERE id = ?', [id]);
};

module.exports = {
  createWarehouse,
  getWarehouses,
  getWarehouseById,
  updateWarehouse,
  deleteWarehouse
};
