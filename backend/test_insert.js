const mysql = require('mysql2/promise');

async function run() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'aluminium_user',
    password: 'C0digix$309',
    database: 'spTech_dev'
  });

  try {
    const sql = `INSERT INTO customer_drawings 
        (client_name, project_name, drawing_no, revision, qty, description, drawing_type, file_path, file_type, remarks, 
         uploaded_by, contact_person, phone, email, 
         customer_type, gstin, city, state, billing_address, shipping_address, excel_path, zip_path, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`;
    
    const params = [
        'Test Client', 'Test Project', 'TEST-001', '0', 1, 'Test Desc', 'Part', 'test.pdf', 'pdf', 'remarks', 
        'Sales', 'Contact', '1234567890', 'test@test.com',
        'Customer', 'GSTIN123', 'City', 'State', 'Billing', 'Shipping',
        null, null
    ];

    console.log('Attempting test insert...');
    const [result] = await connection.execute(sql, params);
    console.log('Insert successful, id:', result.insertId);
    
    // Cleanup
    await connection.query('DELETE FROM customer_drawings WHERE id = ?', [result.insertId]);
    console.log('Cleanup successful');

  } catch (err) {
    console.error('Test insert failed:', err);
  } finally {
    await connection.end();
  }
}

run();
