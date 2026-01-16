const jwt = require('jsonwebtoken');

const secret = 'your-super-secret-jwt-key-change-in-production';
const payload = {
  id: 1,
  email: 'test@example.com',
  username: 'testuser',
  role_id: 1,
  department_id: 5
};

const token = jwt.sign(payload, secret, { expiresIn: '24h' });
console.log('Generated token:');
console.log(token);
