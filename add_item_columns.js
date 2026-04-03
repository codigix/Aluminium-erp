const pool = require('./backend/src/config/db');

async function addColumns() {
  const columnsToAdd = [
    { name: 'material_id', type: 'INT' },
    { name: 'shape_id', type: 'INT' },
    { name: 'length', type: 'DECIMAL(12, 4)' },
    { name: 'width', type: 'DECIMAL(12, 4)' },
    { name: 'thickness', type: 'DECIMAL(12, 4)' },
    { name: 'diameter', type: 'DECIMAL(12, 4)' },
    { name: 'outer_diameter', type: 'DECIMAL(12, 4)' },
    { name: 'density', type: 'DECIMAL(10, 4)' }
  ];

  try {
    const [existingColumns] = await pool.query(`SHOW COLUMNS FROM stock_balance`);
    const columnNames = existingColumns.map(col => col.Field);

    for (const col of columnsToAdd) {
      if (!columnNames.includes(col.name)) {
        console.log(`Adding column: ${col.name}`);
        await pool.query(`ALTER TABLE stock_balance ADD COLUMN ${col.name} ${col.type}`);
      } else {
        console.log(`Column ${col.name} already exists`);
      }
    }
    console.log('Stock balance table columns processed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error adding columns:', err);
    process.exit(1);
  }
}

addColumns();
