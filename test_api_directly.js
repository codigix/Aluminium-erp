const pool = require('./backend/src/config/db');
const service = require('./backend/src/services/salesOrderService');
async function test() {
  try {
    const rows = await service.listSalesOrders(true);
    console.log('Rows count:', rows.length);
    console.log('Rows with status BOM_SUBMITTED:');
    console.log(JSON.stringify(rows.filter(r => r.status === 'BOM_SUBMITTED').map(r => ({id: r.id, status: r.status, customer_po_id: r.customer_po_id})), null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
test();
