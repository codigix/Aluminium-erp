const pool = require('./src/config/db');
const salesOrderService = require('./src/services/salesOrderService');

(async () => {
  try {
    const orders = await salesOrderService.getApprovedDrawings();
    console.log(`Total orders fetched: ${orders.length}`);
    
    if (orders.length > 0) {
      const first = orders[0];
      console.log('\nFirst order data:');
      console.log('  company_name:', first.company_name);
      console.log('  email:', first.email);
      console.log('  phone:', first.phone);
      console.log('  contact_person:', first.contact_person);
      console.log('  _debug_contacts:', first._debug_contacts);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
