const pool = require('./backend/src/config/db');

async function createTables() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS shapes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS materials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      density DECIMAL(10, 4) NOT NULL,
      status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  try {
    for (const sql of queries) {
      await pool.query(sql);
    }
    console.log('Shapes and materials tables created successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error creating tables:', err);
    process.exit(1);
  }
}

createTables();
