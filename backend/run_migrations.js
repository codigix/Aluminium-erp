const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function runMigrations() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    multipleStatements: true
  });

  try {
    // Ensure migrations table exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get applied migrations
    const [applied] = await connection.query("SELECT file_name FROM migrations");
    const appliedSet = new Set(applied.map(r => r.file_name));

    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${migrationFiles.length} total migration files.`);

    for (const file of migrationFiles) {
      if (appliedSet.has(file)) {
        console.log(`Skipping already applied migration: ${file}`);
        continue;
      }

      console.log(`Applying migration: ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      try {
        await connection.query(sql);
        await connection.query("INSERT INTO migrations (file_name) VALUES (?)", [file]);
        console.log(`Successfully applied ${file}`);
      } catch (err) {
        console.error(`Error applying migration ${file}:`, err.message);
        // If it's a "duplicate" error, we might want to skip it or handle it
        if (err.code === 'ER_DUP_ENTRY' || err.code === 'ER_TABLE_EXISTS_ERROR' || err.code === 'ER_DUP_KEYNAME' || err.code === 'ER_DUP_FIELDNAME') {
            console.log(`Migration ${file} seems partially applied or conflicting but it's okay, marking as done.`);
            await connection.query("INSERT INTO migrations (file_name) VALUES (?)", [file]);
        } else {
            throw err;
        }
      }
    }

    console.log("All migrations completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await connection.end();
  }
}

runMigrations();
