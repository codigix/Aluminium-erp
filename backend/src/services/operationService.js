const pool = require('../config/db');

const getAllOperations = async () => {
  const [rows] = await pool.query(`
    SELECT o.*, w.workstation_name, w.workstation_code,
           o.hourly_rate as operation_rate,
           w.hourly_rate as workstation_rate,
           COALESCE(NULLIF(o.hourly_rate, 0), w.hourly_rate, 0) as hourly_rate
    FROM operations o
    LEFT JOIN workstations w ON o.workstation_id = w.id
    ORDER BY o.operation_code ASC
  `);
  return rows;
};

const getOperationById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM operations WHERE id = ?', [id]);
  return rows[0];
};

const createOperation = async (data) => {
  const [result] = await pool.query(
    `INSERT INTO operations (
      operation_code, operation_name, workstation_id, std_time, time_uom, hourly_rate, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.operation_code, data.operation_name, data.workstation_id, 
      data.std_time, data.time_uom || 'Hr', data.hourly_rate || 0,
      data.is_active !== undefined ? data.is_active : 1
    ]
  );
  return { id: result.insertId, ...data };
};

const updateOperation = async (id, data) => {
  await pool.query(
    `UPDATE operations SET 
      operation_code = ?, 
      operation_name = ?, 
      workstation_id = ?, 
      std_time = ?, 
      time_uom = ?, 
      hourly_rate = ?,
      is_active = ?
     WHERE id = ?`,
    [
      data.operation_code, data.operation_name, data.workstation_id, 
      data.std_time, data.time_uom, data.hourly_rate || 0, data.is_active, id
    ]
  );
  return { id, ...data };
};

const deleteOperation = async (id) => {
  // ERP logic: No Delete if used (this should be checked if we had references)
  // For now, let's just implement the delete or a soft-disable if requested
  await pool.query('DELETE FROM operations WHERE id = ?', [id]);
  return { success: true };
};

const generateOperationCode = async () => {
  const [result] = await pool.query(
    'SELECT operation_code FROM operations WHERE operation_code LIKE "OP-%" ORDER BY operation_code DESC LIMIT 1'
  );
  
  if (result.length === 0) {
    return 'OP-10';
  }

  const lastCode = result[0].operation_code;
  const match = lastCode.match(/OP-(\d+)/);
  const currentNumber = match ? parseInt(match[1]) : 0;
  const nextNumber = currentNumber + 10;
  return `OP-${String(nextNumber)}`;
};

module.exports = {
  getAllOperations,
  getOperationById,
  createOperation,
  updateOperation,
  deleteOperation,
  generateOperationCode
};
