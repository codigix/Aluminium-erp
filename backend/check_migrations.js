const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function check() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    multipleStatements: true
  });

  try {
    const [version] = await connection.query("SELECT VERSION()");
    console.log("MySQL Version:", version[0]['VERSION()']);

    const [rows] = await connection.query("SHOW TABLES LIKE 'migrations'");
    let appliedMigrations = [];
    if (rows.length > 0) {
      const [applied] = await connection.query("SELECT file_name FROM migrations");
      appliedMigrations = applied.map(r => r.file_name);
    } else {
      console.log("Migrations table does not exist. It will be created if we run a migration script.");
    }

    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    
    const pending = migrationFiles.filter(f => !appliedMigrations.includes(f));
    
    console.log("Total migration files:", migrationFiles.length);
    console.log("Applied migrations:", appliedMigrations.length);
    console.log("Pending migrations:", pending.length);
    if (pending.length > 0) {
      console.log("Pending files:", pending);
    }

    try {
      const [userCount] = await connection.query("SELECT COUNT(*) as count FROM users");
      console.log("User count in database:", userCount[0].count);
    } catch (err) {
      console.log("Error checking users:", err.message);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

check();
