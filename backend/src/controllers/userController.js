const bcrypt = require('bcrypt');
const db = require('../config/db');

exports.getAllUsers = async (req, res) => {
  try {
    const query = `
      SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.status, u.created_at,
             d.name as department_name, d.id as department_id,
             r.name as role_name, r.id as role_id
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN roles r ON u.role_id = r.id
      ORDER BY u.first_name, u.last_name
    `;

    const [results] = await db.query(query);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT u.*, d.name as department_name, r.name as role_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `;

    const [results] = await db.query(query, [id]);

    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = results[0];
    delete user.password;

    const permissionsQuery = `
      SELECT p.* FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ?
    `;

    const [permissions] = await db.query(permissionsQuery, [user.role_id]);

    res.json({ ...user, permissions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, email, phone, department_id, role_id, status } = req.body;

    const query = `
      UPDATE users 
      SET first_name = ?, last_name = ?, email = ?, phone = ?, 
          department_id = ?, role_id = ?, status = ?, updated_at = NOW()
      WHERE id = ?
    `;

    const [results] = await db.query(query, [first_name, last_name, email, phone, department_id, role_id, status, id]);

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Old and new password required' });
    }

    const query = 'SELECT password FROM users WHERE id = ?';

    const [results] = await db.query(query, [id]);

    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const passwordMatch = await bcrypt.compare(oldPassword, results[0].password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updateQuery = 'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?';

    await db.query(updateQuery, [hashedPassword, id]);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deactivateUser = async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?';

    const [results] = await db.query(query, ['INACTIVE', id]);

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.reactivateUser = async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?';

    const [results] = await db.query(query, ['ACTIVE', id]);

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User reactivated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUsersByDepartment = async (req, res) => {
  try {
    const { departmentId } = req.params;

    const query = `
      SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.status,
             r.name as role_name, r.id as role_id
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.department_id = ?
      ORDER BY u.first_name, u.last_name
    `;

    const [results] = await db.query(query, [departmentId]);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
