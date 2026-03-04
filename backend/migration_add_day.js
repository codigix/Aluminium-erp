const pool = require('./src/config/db');

async function runMigration() {
  try {
    console.log('Starting migration: Adding "day" column to log tables...');
    
    const tables = ['job_card_time_logs', 'job_card_quality_logs', 'job_card_downtime_logs'];
    
    for (const table of tables) {
      const [columns] = await pool.query(`SHOW COLUMNS FROM ${table} LIKE "day"`);
      if (columns.length === 0) {
        await pool.query(`ALTER TABLE ${table} ADD COLUMN day INT AFTER job_card_id`);
        console.log(`Added day column to ${table}.`);
      } else {
        console.log(`Column day already exists in ${table}.`);
      }
    }
    
    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
