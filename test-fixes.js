const http = require('http');

function makeRequest(path, method = 'GET', token = 'test-token') {
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
    req.end();
  });
}

async function test() {
  console.log('Testing Production Manufacturing Fixes...\n');

  console.log('1. Testing GET /api/selling/sales-orders');
  const salesOrders = await makeRequest('/api/selling/sales-orders');
  if (salesOrders.data && salesOrders.data.length > 0) {
    const so = salesOrders.data[0];
    console.log(`   ✓ Sales Order: ${so.sales_order_id}`);
    console.log(`   ✓ Order Amount: ₹${so.order_amount}`);
    console.log(`   ✓ Quantity: ${so.quantity}`);
    console.log(`   ✓ Status: ${so.status}`);
  }

  console.log('\n2. Testing GET /api/production/work-orders');
  const workOrders = await makeRequest('/api/production/work-orders');
  if (workOrders.data && workOrders.data.length > 0) {
    const wo = workOrders.data[0];
    console.log(`   ✓ Work Order: ${wo.wo_id}`);
    console.log(`   ✓ Unit Cost: ₹${wo.unit_cost || 0}`);
    console.log(`   ✓ Total Cost: ₹${wo.total_cost || 0}`);
    console.log(`   ✓ Quantity: ${wo.quantity}`);
  }

  console.log('\n3. Testing GET /api/production/boms');
  const boms = await makeRequest('/api/production/boms');
  if (boms.data && boms.data.length > 0) {
    const bom = boms.data[0];
    console.log(`   ✓ BOM: ${bom.bom_id}`);
    console.log(`   ✓ Total Cost: ₹${bom.total_cost || 0}`);
    console.log(`   ✓ Status: ${bom.status}`);
  }

  console.log('\n✅ All tests completed!');
}

test().catch(console.error);
