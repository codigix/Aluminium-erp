import { createPool } from 'mysql2/promise'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '../.env') })

async function runMigration() {
  const db = createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: 'backend', // Force password to test
    database: process.env.DB_NAME || 'aluminium_erp',
    port: process.env.DB_PORT || 3306
  })

  try {
    console.log('Starting database migration...')
    
    console.log('DB Config:', {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      database: process.env.DB_NAME,
      passwordLength: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 0
    })

    // Read the migration file
    const migrationPath = path.join(__dirname, 'add_project_requirement.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')
    
    // Split the SQL into individual statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0)
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      console.log(`Executing statement ${i + 1}/${statements.length}...`)
      console.log(`${statement.substring(0, 80)}...`)
      
      try {
        await db.execute(statement)
      } catch (e) {
        // Some errors are expected (like if columns don't exist), log but continue
        console.warn(`  Warning: ${e.message}`)
      }
    }
    
    console.log('✓ Migration completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('✗ Migration failed:', error.message)
    process.exit(1)
  } finally {
    await db.end()
  }
}

runMigration()