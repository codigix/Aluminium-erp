const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/auth');

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      department_id: user.department_id,
      department_code: user.department_code,
      role_id: user.role_id,
      role: user.role_code || user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

exports.register = async (req, res) => {
  try {
    const { username, email, password, first_name, last_name, department_id, role_id, phone } = req.body;

    if (!username || !email || !password || !department_id || !role_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Self sign-up can never grant admin rights
    const [roleRows] = await db.query('SELECT code FROM roles WHERE id = ?', [role_id]);
    if (roleRows.length === 0) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    if (roleRows[0].code === 'SYS_ADMIN') {
      return res.status(403).json({ error: 'Administrator accounts can only be created by an administrator' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // New accounts start INACTIVE and must be activated by a user with USER_MANAGE
    // (PUT /users/:id/reactivate). Login only accepts ACTIVE users.
    const query = `
      INSERT INTO users (username, email, password, first_name, last_name, department_id, role_id, phone, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'INACTIVE')
    `;

    const [results] = await db.query(query, [username, email, hashedPassword, first_name, last_name, department_id, role_id, phone || null]);

    res.status(201).json({
      message: 'Account created. An administrator must activate it before you can log in.',
      pendingApproval: true,
      user: { id: results.insertId, username, email, first_name, last_name, department_id, role_id }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const query = `
      SELECT u.*, d.name as department_name, d.code as department_code, r.name as role_name, r.code as role_code
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.email = ? AND u.status = 'ACTIVE'
    `;

    const [results] = await db.query(query, [email]);

    if (results.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = results[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        department_id: user.department_id,
        department_name: user.department_name,
        department_code: user.department_code,
        role_id: user.role_id,
        role_name: user.role_name,
        role_code: user.role_code,
        phone: user.phone
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.verifyToken = (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT u.*, d.name as department_name, d.code as department_code, r.name as role_name, r.code as role_code
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `;

    const [results] = await db.query(query, [userId]);

    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = results[0];
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      department_id: user.department_id,
      department_name: user.department_name,
      department_code: user.department_code,
      role_id: user.role_id,
      role_name: user.role_name,
      role_code: user.role_code,
      phone: user.phone
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
