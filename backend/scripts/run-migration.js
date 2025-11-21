import { createPool } from 'mysql2/promise'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config()

const db = createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'aluminium_erp',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

async function runMigration() {
  try {
    console.log('Reading GRN requests schema...')
    const schemaPath = path.join(process.cwd(), 'scripts', 'grn_requests_schema.sql')
    const schemaSql = fs.readFileSync(schemaPath, 'utf8')

    const connection = await db.getConnection()
    
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && !s.startsWith('/*'))

    for (const statement of statements) {
      if (statement.length > 0) {
        console.log(`Executing: ${statement.substring(0, 60)}...`)
        await connection.query(statement)
      }
    }

    console.log('✓ GRN requests tables created successfully')
    connection.release()
    await db.end()
  } catch (error) {
    console.error('✗ Migration failed:', error.message)
    process.exit(1)
  }
}

runMigration()
