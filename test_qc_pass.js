const finalQCService = require('./backend/src/services/finalQCService');
async function test() {
  try {
    const result = await finalQCService.completeFinalQC(5, {
      status: 'PASSED',
      remarks: 'Test pass',
      passedQty: 10,
      failedQty: 0
    });
    console.log('QC Result:', result);

    const pool = require('./backend/src/config/db');
    const [sh] = await pool.query('SELECT * FROM shipment_orders WHERE sales_order_id = 5');
    console.log('Shipment Orders for SO 5:', sh);
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
test();
