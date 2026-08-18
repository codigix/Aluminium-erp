const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const payload = {
  id: 1,
  email: 'test@example.com',
  username: 'testuser',
  role_id: 1,
  department_id: 5
};

const token = jwt.sign(payload, secret, { expiresIn: '1h' });
console.log('Generated fresh token using secret:', secret.substring(0, 10) + '...');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/dashboard/sales?start=2026-04-01&end=2026-08-16',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
};

console.log('Sending request to /api/dashboard/sales...');
const t0 = Date.now();

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    const duration = Date.now() - t0;
    console.log(`HTTP Status: ${res.statusCode}`);
    console.log(`Request completed in: ${duration} ms`);
    console.log(`Response length: ${data.length} bytes`);
    if (res.statusCode !== 200) {
      console.log('Response:', data.substring(0, 500));
    } else {
      try {
        const parsed = JSON.parse(data);
        console.log('Successfully received valid JSON response!');
        console.log('KPIs:', parsed.kpis);
      } catch (e) {
        console.error('Error parsing response JSON:', e.message);
      }
    }
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
  process.exit(1);
});

req.end();
