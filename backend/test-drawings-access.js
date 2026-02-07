const http = require('http');

async function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: data
          });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  try {
    // 1. Login
    console.log('Logging in as admin@company.com...');
    const loginRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'admin@company.com',
      password: 'Admin@123'
    });

    if (loginRes.statusCode !== 200) {
      console.error('Login failed:', loginRes.statusCode, loginRes.body);
      process.exit(1);
    }

    const token = loginRes.body.token;
    console.log('✓ Login successful');

    // 2. Access /api/drawings
    console.log('Accessing /api/drawings...');
    const drawingsRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/drawings',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('Response Status:', drawingsRes.statusCode);
    console.log('Response Body:', JSON.stringify(drawingsRes.body, null, 2));

    if (drawingsRes.statusCode === 200) {
      console.log('✓ Access successful!');
    } else {
      console.log('✗ Access failed');
    }

    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

run();
