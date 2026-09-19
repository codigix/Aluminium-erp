const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const backupService = require('./src/utils/backupService');

const maxCount = parseInt(process.env.BACKUP_MAX_COUNT || '30', 10);
const files = backupService.listBackupFiles();

console.log('\n=== ROLLING RETENTION VERIFICATION ===');
console.log('BACKUP_MAX_COUNT :', maxCount);
console.log('Backup Directory :', process.env.BACKUP_DIR);
console.log('--------------------------------------');
console.log('Current backup files:');
if (files.length === 0) {
  console.log('  (no files yet)');
} else {
  files.forEach((f, i) => {
    const tag = i === 0 ? ' ← LATEST' : i >= maxCount ? ' ← WOULD DELETE' : '';
    console.log('  [' + (i + 1) + '] ' + f.filename + ' — ' + f.sizeFormatted + tag);
  });
}
console.log('--------------------------------------');
console.log('Total files     :', files.length);
console.log('Max allowed     :', maxCount);
console.log('Files to prune  :', Math.max(0, files.length - maxCount));
console.log('Status          :', files.length <= maxCount ? '✅  Within rolling limit' : '⚠️  Pruning needed');
console.log('======================================\n');
process.exit(0);
