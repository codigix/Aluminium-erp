const purchaseOrderService = require('./src/services/purchaseOrderService');

async function testServiceUpdate() {
  try {
    console.log('🔧 Testing updatePurchaseOrder service function...\n');

    const poId = 37;
    const payload = { status: 'PENDING_PAYMENT' };

    console.log(`Input:`);
    console.log(`  PO ID: ${poId}`);
    console.log(`  Payload: ${JSON.stringify(payload)}\n`);

    console.log('Executing updatePurchaseOrder...');
    const result = await purchaseOrderService.updatePurchaseOrder(poId, payload);

    console.log('\n✅ Update successful!');
    console.log(`Result:`, result);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nFull error:');
    console.error(error);
    process.exit(1);
  }
}

testServiceUpdate();
