const pool = require('./src/config/db');

async function migrate() {
  let connection;
  try {
    connection = await pool.getConnection();
    const [cols] = await connection.query("SHOW COLUMNS FROM customer_drawings LIKE 'status'");
    if (cols.length === 0) {
      await connection.query("ALTER TABLE customer_drawings ADD COLUMN status ENUM('PENDING', 'SHARED') DEFAULT 'PENDING' AFTER uploaded_by");
      console.log('Added status column to customer_drawings');
    } else {
      console.log('Status column already exists');
    }
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

migrate();
