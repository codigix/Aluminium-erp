
import { createPool } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function checkSchema() {
  const db = createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'aluminium_erp',
  });

  try {
    const [columns] = await db.execute("SHOW COLUMNS FROM client_po_drawings");
    console.log('Columns in client_po_drawings:');
    columns.forEach(col => console.log(`- ${col.Field} (${col.Type})`));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.end();
  }
}

checkSchema();
