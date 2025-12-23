const http = require('http');

function makeRequest(path, method = 'GET', token = 'test-token', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  console.log('Testing Work Order Cost Calculation...\n');

  console.log('1. Creating a Work Order...');
  const woPayload = {
    item_code: 'ITEM-001',
    bom_no: 'BOM-1764161170640',
    quantity: 5,
    priority: 'medium',
    notes: 'Test WO for cost calculation'
  };

  const woResponse = await makeRequest('/api/production/work-orders', 'POST', 'test-token', woPayload);
  
  if (woResponse.success && woResponse.data) {
    console.log(`   ✓ Work Order Created: ${woResponse.data.wo_id}`);
    console.log(`   ✓ Unit Cost: ₹${woResponse.data.unit_cost || 'N/A'}`);
    console.log(`   ✓ Total Cost: ₹${woResponse.data.total_cost || 'N/A'}`);
    console.log(`   ✓ Quantity: ${woResponse.data.quantity}`);
  } else {
    console.log(`   ✗ Error: ${woResponse.message || 'Unknown error'}`);
    console.log(`   Details: ${JSON.stringify(woResponse)}`);
  }

  console.log('\n2. Fetching Work Orders...');
  const wos = await makeRequest('/api/production/work-orders');
  if (wos.data && wos.data.length > 0) {
    const wo = wos.data[wos.data.length - 1];
    console.log(`   ✓ Latest WO: ${wo.wo_id}`);
    console.log(`   ✓ Unit Cost: ₹${wo.unit_cost || 0}`);
    console.log(`   ✓ Total Cost: ₹${wo.total_cost || 0}`);
    console.log(`   ✓ Status: ${wo.status}`);
  } else {
    console.log('   No work orders found');
  }

  console.log('\n✅ Test completed!');
}

test().catch(console.error);
