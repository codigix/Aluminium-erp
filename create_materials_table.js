const pool = require('./backend/src/config/db');

async function createTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS sales_order_item_materials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sales_order_item_id INT NOT NULL,
      material_name VARCHAR(255) NOT NULL,
      material_type ENUM('RAW', 'BOUGHT', 'SERVICE', 'CONSUMABLE') DEFAULT 'RAW',
      qty_per_pc DECIMAL(12,4) NOT NULL,
      uom VARCHAR(20) DEFAULT 'KG',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (sales_order_item_id) REFERENCES sales_order_items(id) ON DELETE CASCADE
    )
  `;
  try {
    await pool.query(sql);
    console.log('sales_order_item_materials table created successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error creating table:', err);
    process.exit(1);
  }
}

createTable();
