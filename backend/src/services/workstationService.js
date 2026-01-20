const pool = require('../config/db');

const getAllWorkstations = async () => {
  const [rows] = await pool.query('SELECT * FROM workstations ORDER BY workstation_name ASC');
  return rows;
};

const getWorkstationById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM workstations WHERE id = ?', [id]);
  return rows[0];
};

const createWorkstation = async (data) => {
  const [result] = await pool.query(
    `INSERT INTO workstations (workstation_code, workstation_name, workstation_type, department, capacity_type, hourly_rate, status) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.workstation_code, data.workstation_name, data.workstation_type, data.department, data.capacity_type, data.hourly_rate, data.status || 'Active']
  );
  return { id: result.insertId, ...data };
};

const updateWorkstation = async (id, data) => {
  await pool.query(
    `UPDATE workstations SET 
      workstation_code = ?, 
      workstation_name = ?, 
      workstation_type = ?, 
      department = ?, 
      capacity_type = ?, 
      hourly_rate = ?, 
      status = ?
     WHERE id = ?`,
    [data.workstation_code, data.workstation_name, data.workstation_type, data.department, data.capacity_type, data.hourly_rate, data.status, id]
  );
  return { id, ...data };
};

const deleteWorkstation = async (id) => {
  await pool.query('DELETE FROM workstations WHERE id = ?', [id]);
  return { success: true };
};

const generateWorkstationCode = async () => {
  const [result] = await pool.query(
    'SELECT workstation_code FROM workstations WHERE workstation_code LIKE "WS-%" ORDER BY workstation_code DESC LIMIT 1'
  );
  
  if (result.length === 0) {
    return 'WS-0001';
  }

  const lastCode = result[0].workstation_code;
  const match = lastCode.match(/WS-(\d+)/);
  const currentNumber = match ? parseInt(match[1]) : 0;
  const nextNumber = currentNumber + 1;
  return `WS-${String(nextNumber).padStart(4, '0')}`;
};

module.exports = {
  getAllWorkstations,
  getWorkstationById,
  createWorkstation,
  updateWorkstation,
  deleteWorkstation,
  generateWorkstationCode
};
