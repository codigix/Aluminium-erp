const pool = require('../config/db');

class MaterialService {
  async getAll() {
    const [rows] = await pool.query('SELECT * FROM materials ORDER BY name');
    return rows;
  }

  async getById(id) {
    const [rows] = await pool.query('SELECT * FROM materials WHERE id = ?', [id]);
    return rows[0];
  }

  async create(data) {
    const [result] = await pool.query(
      'INSERT INTO materials (name, density, status) VALUES (?, ?, ?)',
      [data.name, data.density, data.status || 'ACTIVE']
    );
    return { id: result.insertId, ...data };
  }

  async update(id, data) {
    await pool.query(
      'UPDATE materials SET name = ?, density = ?, status = ? WHERE id = ?',
      [data.name, data.density, data.status, id]
    );
    return { id, ...data };
  }

  async delete(id) {
    await pool.query('DELETE FROM materials WHERE id = ?', [id]);
    return { success: true };
  }
}

module.exports = new MaterialService();
