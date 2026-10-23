// Brings the test database up to the schema the rework flow needs, using the repository's own
// migration. Runs only against the test database (spTech_dev by default), never production.
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const MIGRATION = path.join(__dirname, '..', 'prisma', 'migrations', '20261019103000_add_rework_routing_to_quality_logs', 'migration.sql');

module.exports = async () => {
  const database = process.env.TEST_DB_NAME || 'spTech_dev';
  if (database === 'spTech_prod') throw new Error('Refusing to prepare the production database for tests');

  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database
  });
  try {
    const [cols] = await db.query("SHOW COLUMNS FROM job_card_quality_logs LIKE 'rework_%'");
    if (cols.length < 2) {
      const sql = fs.readFileSync(MIGRATION, 'utf8').replace(/^--.*$/gm, '').trim();
      await db.query(sql);
      console.log(`[global-setup] applied 20261019103000_add_rework_routing_to_quality_logs to ${database}`);
    }
  } finally {
    await db.end();
  }
};
