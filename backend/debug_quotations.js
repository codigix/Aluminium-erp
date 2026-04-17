const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkQuotations() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sales_erp'
  };

  const connection = await mysql.createConnection(config);

  try {
    const [dbResult] = await connection.query('SELECT DATABASE() as db');
    console.log(`Connected to database: ${dbResult[0].db}`);

    const [drows] = await connection.query('DESCRIBE quotation_requests');
    console.log('--- DESCRIBE quotation_requests ---');
    drows.forEach(r => console.log(`${r.Field} (${r.Type})` ));

    console.log('\nFetching last 10 quotation batches...');
    const [rows] = await connection.query('SELECT id, version, parent_id, drawing_no, project_name, status, total_amount, created_at FROM quotation_requests ORDER BY created_at DESC LIMIT 20');
    console.table(rows);
    process.exit(0);

    if (rows.length > 0) {
        const firstParentId = rows[0].parent_id;
        if (firstParentId) {
            console.log(`\nItems with parent_id = ${firstParentId}:`);
            const [prows] = await connection.query('SELECT id, version, drawing_no, total_amount, created_at FROM quotation_requests WHERE parent_id = ? OR id = ?', [firstParentId, firstParentId]);
            console.table(prows);
        }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkQuotations();
