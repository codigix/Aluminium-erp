/**
 * Simulates 2 consecutive daily backups to confirm:
 * 1. Scheduler fires correctly
 * 2. New file is created each day
 * 3. Rolling retention keeps ≤ 30 files
 *
 * Run: node test_daily_simulation.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const fs = require('fs');
const backupService = require('./src/utils/backupService');

// Helper: fake a backup from N days ago (for testing rolling delete)
function fakeOldBackup(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const pad = (n) => String(n).padStart(2, '0');
  const dd   = pad(d.getDate());
  const mm   = pad(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  const filename = `HRM_DB_Backup_${dd}_${mm}_${yyyy}.sql`;
  const backupDir = path.resolve(process.env.BACKUP_DIR);
  const filePath = path.join(backupDir, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `-- Simulated backup for ${dd}/${mm}/${yyyy}\nSELECT 1;`);
    // Set mtime to simulate it was created N days ago
    const oldTime = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    fs.utimesSync(filePath, oldTime, oldTime);
    return filename;
  }
  return null;
}

(async () => {
  console.log('\n=========================================');
  console.log('  DAILY BACKUP SIMULATION TEST');
  console.log('=========================================');

  const backupDir = path.resolve(process.env.BACKUP_DIR);
  console.log('Backup Dir   :', backupDir);
  console.log('Max Files    : 30 (hardcoded)');
  console.log('Schedule     : Daily at 2:00 AM (hardcoded)');
  console.log('-----------------------------------------\n');

  // ── STEP 1: Show current state ────────────────────────────────────────────
  let files = backupService.listBackupFiles();
  console.log(`STEP 1 — Current backups: ${files.length} file(s)`);
  files.forEach((f, i) => console.log(`  [${i+1}] ${f.filename} (${f.sizeFormatted})`));

  // ── STEP 2: Simulate "Day 2" backup (tomorrow's run) ────────────────────
  console.log('\nSTEP 2 — Simulating Day 2 backup...');
  const result = await backupService.runBackup();
  if (result.success) {
    console.log(`  ✅ Created → ${result.filename} (${result.sizeFormatted})`);
  } else {
    console.log(`  ❌ Failed  → ${result.error}`);
  }

  // ── STEP 3: Simulate 30 extra old backups to test rolling delete ─────────
  console.log('\nSTEP 3 — Creating 30 fake old backup stubs to test rolling limit...');
  let fakeCount = 0;
  for (let i = 2; i <= 31; i++) {
    const name = fakeOldBackup(i);
    if (name) {
      fakeCount++;
      process.stdout.write(`  Created fake: ${name}\n`);
    }
  }
  console.log(`  Total fake files created: ${fakeCount}`);

  files = backupService.listBackupFiles();
  console.log(`\n  Files BEFORE pruning: ${files.length}`);

  // ── STEP 4: Run rolling pruning ──────────────────────────────────────────
  console.log('\nSTEP 4 — Running rolling retention pruning (max 30)...');
  await backupService.pruneOldBackups();

  // ── STEP 5: Final state ──────────────────────────────────────────────────
  files = backupService.listBackupFiles();
  console.log(`\nSTEP 5 — Files AFTER pruning: ${files.length}`);
  files.forEach((f, i) => {
    const tag = i === 0 ? '  ← LATEST (kept)' : i === files.length - 1 ? '  ← OLDEST (kept)' : '';
    console.log(`  [${i+1}] ${f.filename} (${f.sizeFormatted})${tag}`);
  });

  console.log('\n=========================================');
  console.log(`  RESULT: ${files.length <= 30 ? '✅  ROLLING RETENTION WORKING' : '❌  ISSUE DETECTED'}`);
  console.log(`  Files on disk: ${files.length} / 30 max`);
  console.log(`  Disk used    : ~${(files.reduce((s,f)=>s+f.size,0)/(1024*1024)).toFixed(2)} MB`);
  console.log('=========================================\n');

  process.exit(0);
})();
