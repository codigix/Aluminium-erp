const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./src/config/db');
const { exec } = require('child_process');

async function runSeeding() {
  try {
    console.log('Reading seed-data.sql...');
    const seedDataPath = path.join(__dirname, '../database/seed-data.sql');
    const sql = fs.readFileSync(seedDataPath, 'utf8');
    
    const statements = sql.split(';').filter(stmt => stmt.trim());
    
    console.log(`Executing ${statements.length} SQL statements...`);
    for (const statement of statements) {
      if (statement.trim()) {
        await db.query(statement);
      }
    }
    console.log('✓ seed-data.sql executed successfully');

    console.log('Running seed.js to create users...');
    exec('node seed.js', { cwd: path.join(__dirname) }, (error, stdout, stderr) => {
      if (error) {
        console.error(`✗ Error running seed.js: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }
      console.log(stdout);
      console.log('✓ Seeding complete');
      process.exit(0);
    });

  } catch (error) {
    console.error('✗ Seeding failed:', error.message);
    process.exit(1);
  }
}

runSeeding();
