/**
 * Test script: manually triggers a database backup and reports the result.
 * Run from: e:\codigix-project\Aluminium-erp\backend\
 *   node test_backup.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const backupService = require('./src/utils/backupService');

(async () => {
  console.log('\n================================================');
  console.log('  DATABASE BACKUP TEST');
  console.log('================================================');
  console.log('DB Host     :', process.env.DB_HOST);
  console.log('DB Port     :', process.env.DB_PORT);
  console.log('DB Name     :', process.env.DB_NAME);
  console.log('DB User     :', process.env.DB_USER);
  console.log('Backup Dir  :', process.env.BACKUP_DIR);
  console.log('------------------------------------------------\n');

  console.log('⏳ Running backup now...\n');

  const result = await backupService.runBackup();

  console.log('\n------------------------------------------------');
  if (result.success) {
    console.log('✅  BACKUP SUCCEEDED!');
    console.log('   File     :', result.filename);
    console.log('   Path     :', result.filePath);
    console.log('   Size     :', result.sizeFormatted);
    console.log('   Created  :', new Date(result.timestamp).toLocaleString('en-IN'));
  } else {
    console.log('❌  BACKUP FAILED!');
    console.log('   Error    :', result.error);
    console.log('\n👉 Possible causes:');
    console.log('   1. mysqldump not in PATH');
    console.log('   2. Wrong DB credentials in .env');
    console.log('   3. MySQL server not running on port', process.env.DB_PORT);
  }
  console.log('================================================\n');

  process.exit(result.success ? 0 : 1);
})();
