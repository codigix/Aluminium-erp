const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function testQuery() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'aluminium_user',
    password: 'C0digix$309',
    database: 'sales_erp',
    port: 3307
  });

  try {
    const [rows] = await connection.query(`
      SELECT o.*, 
             GROUP_CONCAT(w.workstation_name SEPARATOR ', ') as workstation_names,
             GROUP_CONCAT(w.workstation_code SEPARATOR ', ') as workstation_codes,
             GROUP_CONCAT(w.id SEPARATOR ',') as workstation_ids,
             o.hourly_rate as operation_rate
      FROM operations o
      LEFT JOIN operation_workstations ow ON o.id = ow.operation_id
      LEFT JOIN workstations w ON ow.workstation_id = w.id
      GROUP BY o.id
      ORDER BY CAST(SUBSTRING(o.operation_code, 4) AS UNSIGNED) ASC
    `);
    console.log('Query successful, found rows:', rows.length);
  } catch (error) {
    console.error('Query failed:', error);
  } finally {
    await connection.end();
  }
}

testQuery();
