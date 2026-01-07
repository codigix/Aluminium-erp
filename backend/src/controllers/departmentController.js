const db = require('../config/db');

exports.getAllDepartments = async (req, res) => {
  try {
    const query = `
      SELECT d.*, COUNT(u.id) as user_count
      FROM departments d
      LEFT JOIN users u ON d.id = u.department_id
      WHERE d.status = 'ACTIVE'
      GROUP BY d.id
      ORDER BY d.name
    `;

    const [results] = await db.query(query);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT d.*, COUNT(u.id) as user_count
      FROM departments d
      LEFT JOIN users u ON d.id = u.department_id
      WHERE d.id = ?
      GROUP BY d.id
    `;

    const [results] = await db.query(query, [id]);

    if (results.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }

    const department = results[0];

    const rolesQuery = `
      SELECT * FROM roles WHERE department_id = ? AND status = 'ACTIVE'
    `;

    const [roles] = await db.query(rolesQuery, [id]);

    const usersQuery = `
      SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.department_id = ?
    `;

    const [users] = await db.query(usersQuery, [id]);

    res.json({
      ...department,
      roles,
      users
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getDepartmentUsers = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.status, r.name as role_name, r.code as role_code
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.department_id = ?
      ORDER BY u.first_name, u.last_name
    `;

    const [results] = await db.query(query, [id]);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getRolesByDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT r.*, 
             (SELECT COUNT(*) FROM role_permissions WHERE role_id = r.id) as permission_count
      FROM roles r
      WHERE r.department_id = ? AND r.status = 'ACTIVE'
    `;

    const [results] = await db.query(query, [id]);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getRolePermissions = async (req, res) => {
  try {
    const { roleId } = req.params;

    const query = `
      SELECT p.* FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ? AND p.status = 'ACTIVE'
    `;

    const [results] = await db.query(query, [roleId]);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
