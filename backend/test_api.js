const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/sales-orders/approved-drawings',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer test-token'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('API Response status:', res.statusCode);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log('Total orders:', parsed.length);
        console.log('First order:');
        const first = parsed[0];
        console.log('  company_name:', first.company_name);
        console.log('  email:', first.email);
        console.log('  phone:', first.phone);
        console.log('  contact_person:', first.contact_person);
        console.log('  _debug_contacts:', first._debug_contacts);
      } else {
        console.log('Response:', parsed);
      }
    } catch (e) {
      console.log('Raw response:', data.substring(0, 500));
    }
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
  process.exit(1);
});

req.end();
