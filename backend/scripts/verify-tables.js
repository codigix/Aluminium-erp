import { createPool } from 'mysql2/promise'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

dotenv.config({ path: path.join(__dirname, '../.env') })

async function verifyTables() {
  const pool = createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'aluminium_erp',
    port: process.env.DB_PORT || 3306
  })

  try {
    const [tables] = await pool.query(`
      SELECT TABLE_NAME FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = 'aluminium_erp' 
      AND (TABLE_NAME = 'sales_order' 
           OR TABLE_NAME = 'work_order'
           OR TABLE_NAME = 'production_plan'
           OR TABLE_NAME = 'production_entry'
           OR TABLE_NAME = 'machine_master'
           OR TABLE_NAME = 'operator_master')
      ORDER BY TABLE_NAME
    `)
    
    console.log('📊 Production-related tables status:')
    const expectedTables = [
      'sales_order',
      'work_order',
      'production_plan',
      'production_entry',
      'machine_master',
      'operator_master'
    ]
    
    const existingTables = tables.map(t => t.TABLE_NAME)
    
    expectedTables.forEach(table => {
      if (existingTables.includes(table)) {
        console.log(`  ✅ ${table}`)
      } else {
        console.log(`  ❌ ${table} (MISSING)`)
      }
    })
    
    console.log(`\n✅ Total: ${tables.length}/${expectedTables.length} tables created`)
    
    await pool.end()
  } catch (error) {
    console.error('Error:', error.message)
  }
}

verifyTables()