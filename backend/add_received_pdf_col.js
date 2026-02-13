const pool = require('./src/config/db');

async function runMigration() {
  try {
    console.log('Adding received_pdf_path to quotations...');
    const [columns] = await pool.query('SHOW COLUMNS FROM quotations LIKE "received_pdf_path"');
    
    if (columns.length === 0) {
      await pool.query('ALTER TABLE quotations ADD COLUMN received_pdf_path VARCHAR(500) AFTER notes');
      console.log('Added received_pdf_path column.');
    } else {
      console.log('Column already exists.');
    }
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

runMigration();
