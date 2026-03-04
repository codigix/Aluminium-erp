const pool = require('./src/config/db');

async function runMigration() {
  try {
    console.log('Starting migration: Creating bom_approval_history table...');
    
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS bom_approval_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sales_order_id INT NOT NULL,
            user_id INT NOT NULL,
            action ENUM('APPROVED', 'REJECTED') NOT NULL,
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    `;
    
    await pool.query(createTableQuery);
    console.log('Successfully created bom_approval_history table.');
    
    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
