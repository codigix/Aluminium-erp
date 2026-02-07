const pool = require('./src/config/db');

async function migrate() {
  const connection = await pool.getConnection();
  try {
    console.log('Starting stock ledger QC integration migration...');

    console.log('Updating transaction_type ENUM...');
    try {
      await connection.query(
        `ALTER TABLE stock_ledger MODIFY transaction_type ENUM('IN', 'OUT', 'ADJUSTMENT', 'RETURN', 'GRN_IN') NOT NULL`
      );
      console.log('✓ Updated transaction_type ENUM');
    } catch (e) {
      if (e.message.includes('Duplicate')) {
        console.log('⚠ transaction_type already updated');
      } else {
        throw e;
      }
    }

    console.log('Checking for qc_id column...');
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'stock_ledger' AND COLUMN_NAME = 'qc_id' AND TABLE_SCHEMA = 'sales_erp'`
    );

    if (columns.length === 0) {
      console.log('Adding qc_id column...');
      await connection.query(`ALTER TABLE stock_ledger ADD COLUMN qc_id INT AFTER reference_doc_number`);
      console.log('✓ Added qc_id column');
    } else {
      console.log('⚠ qc_id column already exists');
    }

    console.log('Checking for grn_item_id column...');
    const [grn_columns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'stock_ledger' AND COLUMN_NAME = 'grn_item_id' AND TABLE_SCHEMA = 'sales_erp'`
    );

    if (grn_columns.length === 0) {
      console.log('Adding grn_item_id column...');
      await connection.query(`ALTER TABLE stock_ledger ADD COLUMN grn_item_id INT AFTER qc_id`);
      console.log('✓ Added grn_item_id column');
    } else {
      console.log('⚠ grn_item_id column already exists');
    }

    console.log('Checking for idx_qc_id index...');
    const [idx_qc] = await connection.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_NAME = 'stock_ledger' AND INDEX_NAME = 'idx_qc_id' AND TABLE_SCHEMA = 'sales_erp'`
    );

    if (idx_qc.length === 0) {
      console.log('Adding idx_qc_id index...');
      await connection.query(`ALTER TABLE stock_ledger ADD INDEX idx_qc_id (qc_id)`);
      console.log('✓ Added idx_qc_id index');
    } else {
      console.log('⚠ idx_qc_id index already exists');
    }

    console.log('Checking for unique_grn_ledger constraint...');
    const [unique_const] = await connection.query(
      `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME = 'stock_ledger' AND CONSTRAINT_NAME = 'unique_grn_ledger' AND TABLE_SCHEMA = 'sales_erp'`
    );

    if (unique_const.length === 0) {
      console.log('Adding unique_grn_ledger constraint...');
      await connection.query(
        `ALTER TABLE stock_ledger ADD UNIQUE KEY unique_grn_ledger (reference_doc_id, grn_item_id, transaction_type)`
      );
      console.log('✓ Added unique_grn_ledger constraint');
    } else {
      console.log('⚠ unique_grn_ledger constraint already exists');
    }

    console.log('\n✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    connection.release();
    await pool.end();
  }
}

migrate();
