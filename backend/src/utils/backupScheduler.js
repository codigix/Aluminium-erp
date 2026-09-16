const cron = require('node-cron');
const backupService = require('./backupService');

let scheduledTask = null;

/**
 * Starts the daily backup scheduler.
 * Schedule: every day at 02:00 AM (hardcoded)
 * Max backups: 30 rolling files (hardcoded)
 */
function startScheduler() {
  // Hardcoded: daily at 2:00 AM
  const BACKUP_SCHEDULE = '0 2 * * *';
  const BACKUP_MAX      = 30;

  console.log(`[BACKUP SCHEDULER] Started. Runs daily at 2:00 AM. Max files: ${BACKUP_MAX}.`);

  scheduledTask = cron.schedule(BACKUP_SCHEDULE, async () => {
    const startTime = new Date();
    console.log(`[BACKUP SCHEDULER] ⏰ Triggered at ${startTime.toLocaleString('en-IN')}`);

    // Run backup
    const result = await backupService.runBackup();

    if (result.success) {
      console.log(`[BACKUP SCHEDULER] ✅ Backup completed: ${result.filename} (${result.sizeFormatted})`);
    } else {
      console.error(`[BACKUP SCHEDULER] ❌ Backup failed: ${result.error}`);
    }

    // Prune old backups after each run
    await backupService.pruneOldBackups();

    const elapsed = ((Date.now() - startTime.getTime()) / 1000).toFixed(1);
    console.log(`[BACKUP SCHEDULER] Cycle done in ${elapsed}s`);
  });
}

/**
 * Stops the scheduler gracefully (used during server shutdown / tests).
 */
function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[BACKUP SCHEDULER] Stopped.');
  }
}

module.exports = { startScheduler, stopScheduler };
