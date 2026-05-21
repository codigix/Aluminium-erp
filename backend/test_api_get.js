const http = require('http');

function post(url, data) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const postData = JSON.stringify(data);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function get(url, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'GET',
      headers
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  try {
    console.log('Logging in as design@company.com / Design@123...');
    const loginRes = await post('http://localhost:5000/api/auth/login', {
      email: 'design@company.com',
      password: 'Design@123'
    });
    
    console.log('Login Response Status:', loginRes.statusCode);
    if (loginRes.statusCode !== 200) {
      console.log('Login failed with:', loginRes.body);
      return;
    }
    
    const token = loginRes.body.token;
    console.log('Successfully logged in! Fetching stock balance...');
    const stockRes = await get('http://localhost:5000/api/stock?includeAll=true', token);
    console.log('Stock Response Status:', stockRes.statusCode);
    console.log('Items Count:', Array.isArray(stockRes.body) ? stockRes.body.length : 'Not an array');
    if (Array.isArray(stockRes.body)) {
      console.log('Top 5 items in API response:');
      console.log(stockRes.body.slice(0, 5).map(item => ({
        item_code: item.item_code,
        material_name: item.material_name,
        material_type: item.material_type
      })));
    } else {
      console.log('API returned:', stockRes.body);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
