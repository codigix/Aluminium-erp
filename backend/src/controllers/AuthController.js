const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

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
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '24h' }
  );
};

exports.register = async (req, res) => {
  try {
    const { username, email, password, first_name, last_name, department_id, role_id, phone } = req.body;

    if (!username || !email || !password || !department_id || !role_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const query = `
      INSERT INTO users (username, email, password, first_name, last_name, department_id, role_id, phone, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `;

    const [results] = await db.query(query, [username, email, hashedPassword, first_name, last_name, department_id, role_id, phone || null]);

    const user = { id: results.insertId, username, email, department_id, role_id };
    const token = generateToken(user);

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: user.id, username, email, first_name, last_name, department_id, role_id }
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
      return res.status(401).json({ error: 'ZENCODER_TEST_INVALID_CREDENTIALS' });
    }

    const user = results[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'ZENCODER_TEST_INVALID_CREDENTIALS' });
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

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
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
