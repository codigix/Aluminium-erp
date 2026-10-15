const pool = require('./src/config/db');

async function applyMigration() {
  try {
    console.log('Applying Migration 029: Bank Accounts enhancements...');
    
    // Check branch_name column
    const [branchCol] = await pool.query("SHOW COLUMNS FROM bank_accounts LIKE 'branch_name'");
    if (branchCol.length === 0) {
      await pool.query("ALTER TABLE bank_accounts ADD COLUMN branch_name VARCHAR(255) NULL AFTER ifsc_code");
      console.log('Added branch_name column to bank_accounts');
    } else {
      console.log('branch_name column already exists');
    }

    // Check opening_balance column
    const [balanceCol] = await pool.query("SHOW COLUMNS FROM bank_accounts LIKE 'opening_balance'");
    if (balanceCol.length === 0) {
      await pool.query("ALTER TABLE bank_accounts ADD COLUMN opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER account_type");
      console.log('Added opening_balance column to bank_accounts');
    } else {
      console.log('opening_balance column already exists');
    }

    // Modify account_type to VARCHAR(50)
    await pool.query("ALTER TABLE bank_accounts MODIFY COLUMN account_type VARCHAR(50) NOT NULL DEFAULT 'CURRENT'");
    console.log('Modified account_type to VARCHAR(50)');

    const [cols] = await pool.query('SHOW COLUMNS FROM bank_accounts');
    console.log('Updated bank_accounts columns:', cols.map(c => `${c.Field} (${c.Type})`));

    console.log('Migration 029 applied successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error applying migration 029:', error);
    process.exit(1);
  }
}

applyMigration();
