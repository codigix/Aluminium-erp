const pool = require('../config/db');

class ItemGroupService {
  async getAll() {
    const [rows] = await pool.query('SELECT * FROM item_groups ORDER BY name');
    return rows;
  }

  async getById(id) {
    const [rows] = await pool.query('SELECT * FROM item_groups WHERE id = ?', [id]);
    return rows[0];
  }

  async create(data) {
    const [result] = await pool.query(
      'INSERT INTO item_groups (name, status) VALUES (?, ?)',
      [data.name, data.status || 'ACTIVE']
    );
    return { id: result.insertId, ...data };
  }

  async update(id, data) {
    await pool.query(
      'UPDATE item_groups SET name = ?, status = ? WHERE id = ?',
      [data.name, data.status, id]
    );
    return { id, ...data };
  }

  async delete(id) {
    await pool.query('DELETE FROM item_groups WHERE id = ?', [id]);
    return { success: true };
  }
}

module.exports = new ItemGroupService();
