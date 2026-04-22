const pool = require('./src/config/db');

async function migrate() {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log('Checking for shared_with_design column...');
    const [cols] = await connection.query("SHOW COLUMNS FROM customer_drawings LIKE 'shared_with_design'");
    
    if (cols.length === 0) {
      console.log('Adding shared_with_design and shared_at columns to customer_drawings...');
      await connection.query(`
        ALTER TABLE customer_drawings 
        ADD COLUMN shared_with_design TINYINT(1) DEFAULT 0,
        ADD COLUMN shared_at TIMESTAMP NULL
      `);
      console.log('Successfully added columns to customer_drawings');
    } else {
      console.log('Columns already exist');
    }
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

migrate();
