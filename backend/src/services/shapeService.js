const pool = require('../config/db');

class ShapeService {
  async getAll() {
    const [rows] = await pool.query('SELECT * FROM shapes ORDER BY name');
    return rows;
  }

  async getById(id) {
    const [rows] = await pool.query('SELECT * FROM shapes WHERE id = ?', [id]);
    return rows[0];
  }

  async create(data) {
    const [result] = await pool.query(
      'INSERT INTO shapes (name, status) VALUES (?, ?)',
      [data.name, data.status || 'ACTIVE']
    );
    return { id: result.insertId, ...data };
  }

  async update(id, data) {
    await pool.query(
      'UPDATE shapes SET name = ?, status = ? WHERE id = ?',
      [data.name, data.status, id]
    );
    return { id, ...data };
  }

  async delete(id) {
    await pool.query('DELETE FROM shapes WHERE id = ?', [id]);
    return { success: true };
  }
}

module.exports = new ShapeService();
