import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: 'aluminium_erp',
    port: process.env.DB_PORT || 3306
  })

  try {
    console.log('🔄 Running rejection table migration...')

    const queries = [
      `CREATE TABLE IF NOT EXISTS rejection (
        rejection_id VARCHAR(50) PRIMARY KEY,
        production_entry_id VARCHAR(50) NOT NULL,
        rejection_reason VARCHAR(255) NOT NULL,
        rejection_count DECIMAL(18,6) NOT NULL,
        root_cause VARCHAR(500),
        corrective_action VARCHAR(500),
        reported_by_id VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_production_entry_id (production_entry_id),
        INDEX idx_rejection_reason (rejection_reason),
        INDEX idx_created_at (created_at)
      )`
    ]

    for (const query of queries) {
      try {
        await connection.execute(query)
        console.log('✓ Created rejection table successfully')
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('ℹ️  Table rejection already exists')
        } else {
          throw error
        }
      }
    }

    console.log('✓ Migration completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  } finally {
    await connection.end()
  }
}

runMigration()
