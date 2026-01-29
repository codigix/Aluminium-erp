const db = require('./src/config/db');
const pool = require('./src/config/db');

async function fixSchema() {
  console.log('Starting manual schema fix for stock_balance...');
  let connection;
  try {
    connection = await pool.getConnection();
    
    const requiredStockCols = [
      { name: 'material_name', definition: 'VARCHAR(255) NULL' },
      { name: 'material_type', definition: 'VARCHAR(100) NULL' },
      { name: 'product_type', definition: 'VARCHAR(100) NULL' },
      { name: 'valuation_rate', definition: 'DECIMAL(12, 2) DEFAULT 0' },
      { name: 'selling_rate', definition: 'DECIMAL(12, 2) DEFAULT 0' },
      { name: 'no_of_cavity', definition: 'INT DEFAULT 1' },
      { name: 'weight_per_unit', definition: 'DECIMAL(12, 3) DEFAULT 0' },
      { name: 'weight_uom', definition: 'VARCHAR(20) NULL' },
      { name: 'drawing_no', definition: 'VARCHAR(120) NULL' },
      { name: 'drawing_id', definition: 'INT NULL' },
      { name: 'revision', definition: 'VARCHAR(50) NULL' },
      { name: 'material_grade', definition: 'VARCHAR(100) NULL' },
      { name: 'unit', definition: 'VARCHAR(20) DEFAULT "Nos"' }
    ];

    // Check stock_balance table
    console.log('Checking stock_balance columns...');
    const [balanceCols] = await connection.query('SHOW COLUMNS FROM stock_balance');
    const existingBalanceCols = new Set(balanceCols.map(c => c.Field));
    
    const missingBalanceCols = requiredStockCols.filter(c => !existingBalanceCols.has(c.name));
    if (missingBalanceCols.length > 0) {
      console.log('Missing columns in stock_balance:', missingBalanceCols.map(c => c.name));
      const alterBalanceSql = `ALTER TABLE stock_balance ${missingBalanceCols
        .map(c => `ADD COLUMN \`${c.name}\` ${c.definition}`)
        .join(', ')};`;
      console.log('Executing:', alterBalanceSql);
      await connection.query(alterBalanceSql);
      console.log('stock_balance table updated successfully');
    } else {
      console.log('stock_balance table is already up to date');
    }

    // Check stock_ledger table
    console.log('Checking stock_ledger columns...');
    const [ledgerCols] = await connection.query('SHOW COLUMNS FROM stock_ledger');
    const existingLedgerCols = new Set(ledgerCols.map(c => c.Field));
    
    const missingLedgerCols = requiredStockCols.filter(c => !existingLedgerCols.has(c.name));
    if (missingLedgerCols.length > 0) {
      console.log('Missing columns in stock_ledger:', missingLedgerCols.map(c => c.name));
      const alterLedgerSql = `ALTER TABLE stock_ledger ${missingLedgerCols
        .map(c => `ADD COLUMN \`${c.name}\` ${c.definition}`)
        .join(', ')};`;
      console.log('Executing:', alterLedgerSql);
      await connection.query(alterLedgerSql);
      console.log('stock_ledger table updated successfully');
    } else {
      console.log('stock_ledger table is already up to date');
    }

  } catch (error) {
    console.error('Error fixing schema:', error);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

fixSchema();
