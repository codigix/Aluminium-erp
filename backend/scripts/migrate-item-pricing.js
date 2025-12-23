import mysql from 'mysql2/promise'

async function migrate() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'backend',
    database: 'aluminium_erp'
  })

  try {
    console.log('Starting item table migration...')

    // Check if columns exist
    const [columns] = await connection.execute("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'item' AND TABLE_SCHEMA = 'aluminium_erp'")
    const columnNames = columns.map(col => col.COLUMN_NAME)

    console.log('Existing columns:', columnNames)

    // Add valuation_rate if it doesn't exist
    if (!columnNames.includes('valuation_rate')) {
      await connection.execute('ALTER TABLE item ADD COLUMN valuation_rate DECIMAL(15,2) DEFAULT 0')
      console.log('✓ Added valuation_rate column')
    } else {
      console.log('✓ valuation_rate column already exists')
    }

    // Add standard_selling_rate if it doesn't exist
    if (!columnNames.includes('standard_selling_rate')) {
      await connection.execute('ALTER TABLE item ADD COLUMN standard_selling_rate DECIMAL(15,2) DEFAULT 0')
      console.log('✓ Added standard_selling_rate column')
    } else {
      console.log('✓ standard_selling_rate column already exists')
    }

    // Try to add indexes (they may fail if they already exist, which is fine)
    try {
      await connection.execute('ALTER TABLE item ADD INDEX idx_valuation_rate (valuation_rate)')
      console.log('✓ Added index on valuation_rate')
    } catch (e) {
      console.log('✓ Index on valuation_rate already exists or could not be added')
    }

    try {
      await connection.execute('ALTER TABLE item ADD INDEX idx_standard_selling_rate (standard_selling_rate)')
      console.log('✓ Added index on standard_selling_rate')
    } catch (e) {
      console.log('✓ Index on standard_selling_rate already exists or could not be added')
    }

    const [structure] = await connection.execute('DESCRIBE item')
    console.log('\n✓ Item table structure updated:')
    const relevantCols = structure.filter(col => ['valuation_rate', 'standard_selling_rate'].includes(col.Field))
    console.table(relevantCols)

    console.log('\n✓ Migration completed successfully!')
  } catch (error) {
    console.error('✗ Migration failed:', error.message)
    throw error
  } finally {
    await connection.end()
  }
}

migrate()
