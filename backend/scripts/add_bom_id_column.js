import { createPool } from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend root
const envPath = path.join(__dirname, '../.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

async function addBomIdColumn() {
  let connection;
  try {
    connection = await createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: 'backend', // Hardcoding based on previous script
      database: process.env.DB_NAME || 'aluminium_erp',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log('Connected to database');

    // Check if column exists
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'selling_sales_order' AND COLUMN_NAME = 'bom_id'`,
      [process.env.DB_NAME || 'aluminium_erp']
    );

    if (columns.length === 0) {
      console.log('Adding bom_id column to selling_sales_order...');
      await connection.execute(
        `ALTER TABLE selling_sales_order 
         ADD COLUMN bom_id VARCHAR(255) NULL AFTER customer_id`
      );
      console.log('Column bom_id added successfully');
    } else {
      console.log('Column bom_id already exists');
    }

    // Also check for quantity column if needed, but usually quantity is on items.
    // The frontend sends 'quantity' which seems to be the multiplier for the BOM.
    // If we want to store it, we should add it too.
    const [qtyColumns] = await connection.execute(
        `SELECT COLUMN_NAME 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'selling_sales_order' AND COLUMN_NAME = 'quantity'`,
        [process.env.DB_NAME || 'aluminium_erp']
      );
  
      if (qtyColumns.length === 0) {
        console.log('Adding quantity column to selling_sales_order...');
        await connection.execute(
          `ALTER TABLE selling_sales_order 
           ADD COLUMN quantity DECIMAL(10,2) DEFAULT 1 AFTER bom_id`
        );
        console.log('Column quantity added successfully');
      } else {
        console.log('Column quantity already exists');
      }

  } catch (error) {
    console.error('Error altering table:', error);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

addBomIdColumn();
