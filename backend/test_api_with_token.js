const http = require('http');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwidXNlcm5hbWUiOiJ0ZXN0dXNlciIsInJvbGVfaWQiOjEsImRlcGFydG1lbnRfaWQiOjUsImlhdCI6MTc2ODQwNzIwNywiZXhwIjoxNzY4NDkzNjA3fQ.O7RoJZEV9-O6NM356Pm1qx3vgvRoabEAFAZ_eGJD3ic';

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/sales-orders/approved-drawings',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
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
      if (Array.isArray(parsed)) {
        console.log(`API Response: ${parsed.length} orders returned`);
        if (parsed.length > 0) {
          const first = parsed[0];
          console.log('\nFirst order details:');
          console.log('  company_name:', first.company_name);
          console.log('  email:', first.email);
          console.log('  phone:', first.phone);
          console.log('  contact_person:', first.contact_person);
          console.log('  _debug_contacts:', JSON.stringify(first._debug_contacts));
        }
      } else {
        console.log('Response:', JSON.stringify(parsed, null, 2));
      }
    } catch (e) {
      console.log('Response:', data.substring(0, 500));
    }
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
  process.exit(1);
});

req.end();
