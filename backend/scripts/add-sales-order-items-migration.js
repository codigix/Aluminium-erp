import mysql from 'mysql2/promise'

const config = {
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'aluminium_erp'
}

async function migrateSalesOrderItems() {
  let connection
  try {
    connection = await mysql.createConnection(config)
    
    console.log('Creating sales_order_items table...')
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sales_order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sales_order_id VARCHAR(50) NOT NULL,
        item_code VARCHAR(100),
        item_name VARCHAR(255),
        delivery_date DATE,
        qty DECIMAL(10, 2) NOT NULL DEFAULT 1,
        rate DECIMAL(15, 2) NOT NULL DEFAULT 0,
        amount DECIMAL(15, 2) GENERATED ALWAYS AS (qty * rate) STORED,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (sales_order_id) REFERENCES selling_sales_order(sales_order_id) ON DELETE CASCADE,
        INDEX idx_sales_order (sales_order_id),
        INDEX idx_item_code (item_code)
      )
    `)
    
    console.log('✓ sales_order_items table created successfully')
    
  } catch (error) {
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('✓ sales_order_items table already exists')
    } else {
      console.error('Error creating table:', error.message)
      throw error
    }
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

migrateSalesOrderItems()
  .then(() => {
    console.log('Migration completed')
    process.exit(0)
  })
  .catch(err => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
