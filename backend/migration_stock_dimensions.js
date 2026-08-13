const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function run() {
  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'aluminium_user',
    password: process.env.DB_PASSWORD || 'C0digix$309',
    database: process.env.DB_NAME || 'spTech_dev',
    port: parseInt(process.env.DB_PORT || '3307')
  };

  const connection = await mysql.createConnection(config);
  try {
    console.log('Starting schema migration...');

    // 1. Add columns to stock_ledger
    const [cols] = await connection.query('SHOW COLUMNS FROM stock_ledger');
    const existingCols = new Set(cols.map(c => c.Field));

    const newCols = [
      { name: 'length', definition: 'DECIMAL(12, 4) NULL' },
      { name: 'width', definition: 'DECIMAL(12, 4) NULL' },
      { name: 'thickness', definition: 'DECIMAL(12, 4) NULL' },
      { name: 'diameter', definition: 'DECIMAL(12, 4) NULL' },
      { name: 'outer_diameter', definition: 'DECIMAL(12, 4) NULL' },
      { name: 'density', definition: 'DECIMAL(10, 4) NULL' }
    ];

    const toAdd = newCols.filter(c => !existingCols.has(c.name));
    if (toAdd.length > 0) {
      const sql = `ALTER TABLE stock_ledger ${toAdd.map(c => `ADD COLUMN \`${c.name}\` ${c.definition}`).join(', ')}`;
      console.log('Adding columns to stock_ledger:', sql);
      await connection.query(sql);
      console.log('Columns added successfully.');
    } else {
      console.log('Columns already exist in stock_ledger.');
    }

    // 2. Drop unique index unique_item_warehouse on stock_balance
    const [indexes] = await connection.query('SHOW INDEX FROM stock_balance');
    const oldUniqueIdx = indexes.find(idx => idx.Key_name === 'unique_item_warehouse' && idx.Non_unique === 0);
    if (oldUniqueIdx) {
      console.log('Dropping unique index unique_item_warehouse from stock_balance...');
      await connection.query('ALTER TABLE stock_balance DROP INDEX unique_item_warehouse');
      console.log('Dropped unique index.');
    } else {
      console.log('Unique index unique_item_warehouse does not exist or already dropped.');
    }

    // 3. Add non-unique index idx_item_warehouse on stock_balance
    const hasIdx = indexes.some(idx => idx.Key_name === 'idx_item_warehouse');
    if (!hasIdx) {
      console.log('Adding non-unique index idx_item_warehouse to stock_balance...');
      await connection.query('ALTER TABLE stock_balance ADD INDEX idx_item_warehouse (item_code, warehouse)');
      console.log('Non-unique index added successfully.');
    } else {
      console.log('Non-unique index idx_item_warehouse already exists.');
    }

    console.log('Schema migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

run();
