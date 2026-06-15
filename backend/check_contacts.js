const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });
const customerPoService = require('./src/services/customerPoService');

async function check() {
  try {
    const po = await customerPoService.getCustomerPoById(38);
    console.log('PO 38 Details:');
    console.log('company_email:', po.company_email);
    console.log('billing_contact_name:', po.billing_contact_name);
    console.log('billing_contact_phone:', po.billing_contact_phone);
    console.log('billing_address:', po.billing_address);
    console.log('shipping_address:', po.shipping_address);
  } catch (err) {
    console.error(err);
  }
}
check();
