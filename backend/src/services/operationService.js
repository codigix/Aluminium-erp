const pool = require('../config/db');

const getAllOperations = async () => {
  const [rows] = await pool.query(`
    SELECT o.*, 
           GROUP_CONCAT(w.workstation_name SEPARATOR ', ') as workstation_names,
           GROUP_CONCAT(w.workstation_code SEPARATOR ', ') as workstation_codes,
           GROUP_CONCAT(w.id SEPARATOR ',') as workstation_ids,
           o.hourly_rate as operation_rate
    FROM operations o
    LEFT JOIN operation_workstations ow ON o.id = ow.operation_id
    LEFT JOIN workstations w ON ow.workstation_id = w.id
    GROUP BY o.id
    ORDER BY CAST(SUBSTRING(o.operation_code, 4) AS UNSIGNED) ASC
  `);
  
  return rows.map(row => ({
    ...row,
    workstation_ids: row.workstation_ids ? row.workstation_ids.split(',').map(Number) : []
  }));
};

const getOperationById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM operations WHERE id = ?', [id]);
  if (rows.length === 0) return null;
  
  const [wsRows] = await pool.query('SELECT workstation_id FROM operation_workstations WHERE operation_id = ?', [id]);
  return {
    ...rows[0],
    workstation_ids: wsRows.map(r => r.workstation_id)
  };
};

const createOperation = async (data) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO operations (
        operation_code, operation_name, std_time, time_uom, hourly_rate, is_active
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.operation_code, data.operation_name, 
        data.std_time, data.time_uom || 'Hr', data.hourly_rate || 0,
        data.is_active !== undefined ? data.is_active : 1
      ]
    );

    const operationId = result.insertId;

    if (data.workstation_ids && Array.isArray(data.workstation_ids)) {
      for (const wsId of data.workstation_ids) {
        await connection.query(
          'INSERT INTO operation_workstations (operation_id, workstation_id) VALUES (?, ?)',
          [operationId, wsId]
        );
      }
    } else if (data.workstation_id) {
      await connection.query(
        'INSERT INTO operation_workstations (operation_id, workstation_id) VALUES (?, ?)',
        [operationId, data.workstation_id]
      );
    }

    await connection.commit();
    return { id: operationId, ...data };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateOperation = async (id, data) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      `UPDATE operations SET 
        operation_code = ?, 
        operation_name = ?, 
        std_time = ?, 
        time_uom = ?, 
        hourly_rate = ?,
        is_active = ?
       WHERE id = ?`,
      [
        data.operation_code, data.operation_name, 
        data.std_time, data.time_uom, data.hourly_rate || 0, data.is_active, id
      ]
    );

    await connection.query('DELETE FROM operation_workstations WHERE operation_id = ?', [id]);

    if (data.workstation_ids && Array.isArray(data.workstation_ids)) {
      for (const wsId of data.workstation_ids) {
        await connection.query(
          'INSERT INTO operation_workstations (operation_id, workstation_id) VALUES (?, ?)',
          [id, wsId]
        );
      }
    } else if (data.workstation_id) {
      await connection.query(
        'INSERT INTO operation_workstations (operation_id, workstation_id) VALUES (?, ?)',
        [id, data.workstation_id]
      );
    }

    await connection.commit();
    return { id, ...data };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const deleteOperation = async (id) => {
  // ERP logic: No Delete if used (this should be checked if we had references)
  // For now, let's just implement the delete or a soft-disable if requested
  await pool.query('DELETE FROM operations WHERE id = ?', [id]);
  return { success: true };
};

const generateOperationCode = async () => {
  const [result] = await pool.query(
    `SELECT operation_code FROM operations 
     WHERE operation_code LIKE "OP-%" 
     ORDER BY CAST(SUBSTRING(operation_code, 4) AS UNSIGNED) DESC LIMIT 1`
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
