const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkVendor() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp',
        port: process.env.DB_PORT || 3306
    };

    const connection = await mysql.createConnection(config);

    try {
        const [vendors] = await connection.query("SELECT id, vendor_name, email, phone, location FROM vendors WHERE vendor_name LIKE '%ABC%'");
        console.log('Vendors:', JSON.stringify(vendors, null, 2));

        if (vendors.length > 0) {
            const vendorId = vendors[0].id;
            const [contacts] = await connection.query("SELECT * FROM contacts WHERE company_id = ?", [vendorId]);
            console.log('Contacts for vendor ' + vendorId + ':', JSON.stringify(contacts, null, 2));

            const [addresses] = await connection.query("SELECT * FROM company_addresses WHERE company_id = ?", [vendorId]);
            console.log('Addresses for vendor ' + vendorId + ':', JSON.stringify(addresses, null, 2));
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkVendor();
