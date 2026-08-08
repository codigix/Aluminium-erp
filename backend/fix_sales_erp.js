const mysql = require('mysql2/promise');

async function fixDatabase(dbName) {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'backend',
    database: dbName
  });

  console.log(`\nChecking and adding missing columns in database: ${dbName}...`);

  try {
    // 1. Check stock_ledger columns
    const [ledgerCols] = await connection.query('SHOW COLUMNS FROM stock_ledger');
    const ledgerFields = ledgerCols.map(c => c.Field);

    const ledgerMissing = [];
    if (!ledgerFields.includes('weight_in')) {
      ledgerMissing.push("ADD COLUMN `weight_in` DECIMAL(12,3) NOT NULL DEFAULT 0.000");
    }
    if (!ledgerFields.includes('weight_out')) {
      ledgerMissing.push("ADD COLUMN `weight_out` DECIMAL(12,3) NOT NULL DEFAULT 0.000");
    }
    if (!ledgerFields.includes('weight_after')) {
      ledgerMissing.push("ADD COLUMN `weight_after` DECIMAL(12,3) NOT NULL DEFAULT 0.000");
    }
    if (!ledgerFields.includes('min_stock')) {
      ledgerMissing.push("ADD COLUMN `min_stock` DECIMAL(12,3) NOT NULL DEFAULT 10.000");
    }
    if (!ledgerFields.includes('max_stock')) {
      ledgerMissing.push("ADD COLUMN `max_stock` DECIMAL(12,3) NOT NULL DEFAULT 500.000");
    }
    if (!ledgerFields.includes('reorder_level')) {
      ledgerMissing.push("ADD COLUMN `reorder_level` DECIMAL(12,3) NOT NULL DEFAULT 20.000");
    }

    if (ledgerMissing.length > 0) {
      console.log(`Adding missing columns to stock_ledger in ${dbName}...`);
      const alterSql = `ALTER TABLE \`stock_ledger\` ${ledgerMissing.join(', ')}`;
      await connection.query(alterSql);
      console.log(`✅ successfully updated stock_ledger!`);
    } else {
      console.log(`✅ stock_ledger is already up to date.`);
    }

    // 2. Check stock_balance columns
    const [balanceCols] = await connection.query('SHOW COLUMNS FROM stock_balance');
    const balanceFields = balanceCols.map(c => c.Field);

    const balanceMissing = [];
    if (!balanceFields.includes('current_weight')) {
      balanceMissing.push("ADD COLUMN `current_weight` DECIMAL(12,3) NOT NULL DEFAULT 0.000");
    }
    if (!balanceFields.includes('min_stock')) {
      balanceMissing.push("ADD COLUMN `min_stock` DECIMAL(12,3) NOT NULL DEFAULT 10.000");
    }
    if (!balanceFields.includes('max_stock')) {
      balanceMissing.push("ADD COLUMN `max_stock` DECIMAL(12,3) NOT NULL DEFAULT 500.000");
    }
    if (!balanceFields.includes('reorder_level')) {
      balanceMissing.push("ADD COLUMN `reorder_level` DECIMAL(12,3) NOT NULL DEFAULT 20.000");
    }

    if (balanceMissing.length > 0) {
      console.log(`Adding missing columns to stock_balance in ${dbName}...`);
      const alterSql = `ALTER TABLE \`stock_balance\` ${balanceMissing.join(', ')}`;
      await connection.query(alterSql);
      console.log(`✅ successfully updated stock_balance!`);
    } else {
      console.log(`✅ stock_balance is already up to date.`);
    }

  } catch (error) {
    console.error(`Error fixing database ${dbName}:`, error.message);
  } finally {
    await connection.end();
  }
}

async function run() {
  await fixDatabase('sales_erp');
}

run();
