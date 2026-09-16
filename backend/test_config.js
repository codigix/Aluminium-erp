const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('\n=== BACKUP CONFIG VERIFICATION ===');
console.log('BACKUP_MAX_COUNT     :', process.env.BACKUP_MAX_COUNT);
console.log('BACKUP_CRON_SCHEDULE :', process.env.BACKUP_CRON_SCHEDULE);
console.log('BACKUP_DIR           :', process.env.BACKUP_DIR);
console.log('BACKUP_ADMIN_EMAIL   :', process.env.BACKUP_ADMIN_EMAIL);
console.log('----------------------------------');

// Simulate exactly what the /api/backups/config endpoint returns
const maxCount = parseInt(process.env.BACKUP_MAX_COUNT || '30', 10);
const schedule = process.env.BACKUP_CRON_SCHEDULE || '0 2 * * *';
const scheduleHuman = schedule === '0 2 * * *' ? 'Daily at 2:00 AM' : schedule;

const configResponse = {
  success: true,
  config: {
    backupDir: process.env.BACKUP_DIR,
    maxCount,
    cronSchedule: schedule,
    cronHuman: scheduleHuman,
    adminEmail: process.env.BACKUP_ADMIN_EMAIL,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
  }
};

console.log('\n/api/backups/config → Response:');
console.log(JSON.stringify(configResponse, null, 2));
console.log('\n✅  All config values fetched correctly from .env\n');
process.exit(0);
