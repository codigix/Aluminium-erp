import mysql from 'mysql2/promise'

async function testConnection() {
  const configs = [
    { host: 'localhost', user: 'root', password: '', database: 'aluminium_erp' },
    { host: 'localhost', user: 'root', password: 'backend', database: 'aluminium_erp' },
  ]

  for (const config of configs) {
    try {
      console.log(`\nTesting connection with password="${config.password}"...`)
      const connection = await mysql.createConnection(config)
      const [result] = await connection.execute('SELECT 1')
      console.log('✓ Connection successful!')
      await connection.end()
    } catch (error) {
      console.log(`✗ Connection failed: ${error.message}`)
    }
  }
}

testConnection()
