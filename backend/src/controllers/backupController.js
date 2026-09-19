const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const backupService = require('../utils/backupService');

// ─── Security helper ─────────────────────────────────────────────────────────
/**
 * Validates that a filename is a safe HRM_DB_Backup_*.sql filename.
 * Prevents path traversal attacks.
 */
function isSafeFilename(filename) {
  // Must match exactly: HRM_DB_Backup_DD_MM_YYYY.sql
  return /^HRM_DB_Backup_\d{2}_\d{2}_\d{4}\.sql$/.test(filename);
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/backups
 * Returns list of all backup files with metadata.
 */
exports.listBackups = async (req, res) => {
  try {
    const files = backupService.listBackupFiles();
    const maxCount = parseInt(process.env.BACKUP_MAX_COUNT || '30', 10);
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);

    return res.json({
      success: true,
      total: files.length,
      totalSizeFormatted: backupService.formatBytes(totalSize),
      maxCount,
      backupDir: backupService.getBackupDirPath(),
      files,
    });
  } catch (err) {
    console.error('[BACKUP CTRL] listBackups error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * POST /api/backups/trigger
 * Triggers a manual database backup immediately.
 */
exports.triggerBackup = async (req, res) => {
  try {
    console.log(`[BACKUP CTRL] Manual trigger by user ${req.user?.id}`);
    const result = await backupService.runBackup();
    await backupService.pruneOldBackups();

    if (result.success) {
      return res.json({
        success: true,
        message: 'Backup completed successfully.',
        filename: result.filename,
        size: result.sizeFormatted,
        timestamp: result.timestamp,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Backup failed. Admin has been notified.',
        error: result.error,
      });
    }
  } catch (err) {
    console.error('[BACKUP CTRL] triggerBackup error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/backups/config
 * Returns the current backup configuration (sanitized — no passwords).
 */
exports.getConfig = async (req, res) => {
  try {
    // Schedule and maxCount are hardcoded in backend (not from .env)
    const BACKUP_SCHEDULE  = '0 2 * * *';
    const BACKUP_MAX_COUNT = 30;

    return res.json({
      success: true,
      config: {
        backupDir: backupService.getBackupDirPath(),
        maxCount: BACKUP_MAX_COUNT,
        cronSchedule: BACKUP_SCHEDULE,
        cronHuman: 'Daily at 2:00 AM',
        adminEmail: process.env.BACKUP_ADMIN_EMAIL || process.env.MAIL_FROM_ADDRESS,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/backups/:filename/download
 * Downloads a specific backup file.
 */
exports.downloadBackup = async (req, res) => {
  try {
    const { filename } = req.params;

    if (!isSafeFilename(filename)) {
      return res.status(400).json({ success: false, error: 'Invalid backup filename.' });
    }

    const backupDir = backupService.getBackupDirPath();
    const filePath = path.join(backupDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Backup file not found.' });
    }

    console.log(`[BACKUP CTRL] Download: ${filename} by user ${req.user?.id}`);

    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', fs.statSync(filePath).size);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    console.error('[BACKUP CTRL] downloadBackup error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * POST /api/backups/:filename/restore
 * Restores the database from a specific backup file.
 */
exports.restoreBackup = async (req, res) => {
  try {
    const { filename } = req.params;

    if (!isSafeFilename(filename)) {
      return res.status(400).json({ success: false, error: 'Invalid backup filename.' });
    }

    const backupDir = backupService.getBackupDirPath();
    const filePath = path.join(backupDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Backup file not found.' });
    }

    console.log(`[BACKUP CTRL] 🔄 Restore started: ${filename} by user ${req.user?.id}`);

    const host     = process.env.DB_HOST     || 'localhost';
    const port     = process.env.DB_PORT     || '3306';
    const user     = process.env.DB_USER     || 'root';
    const password = process.env.DB_PASSWORD || '';
    const database = process.env.DB_NAME     || 'sales_erp';

    const command = `mysql -h ${host} -P ${port} -u ${user} -p"${password}" ${database} < "${filePath}"`;

    const { stderr } = await execAsync(command, { timeout: 10 * 60 * 1000 }); // 10 min timeout

    console.log(`[BACKUP CTRL] ✅ Restore complete: ${filename}`);

    return res.json({
      success: true,
      message: `Database restored from ${filename}.`,
      restoredFile: filename,
      warnings: stderr || null,
    });
  } catch (err) {
    console.error('[BACKUP CTRL] restoreBackup error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * DELETE /api/backups/:filename
 * Deletes a specific backup file from disk.
 */
exports.deleteBackup = async (req, res) => {
  try {
    const { filename } = req.params;

    if (!isSafeFilename(filename)) {
      return res.status(400).json({ success: false, error: 'Invalid backup filename.' });
    }

    const backupDir = backupService.getBackupDirPath();
    const filePath = path.join(backupDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Backup file not found.' });
    }

    fs.unlinkSync(filePath);
    console.log(`[BACKUP CTRL] 🗑️ Deleted: ${filename} by user ${req.user?.id}`);

    return res.json({ success: true, message: `Backup "${filename}" deleted successfully.` });
  } catch (err) {
    console.error('[BACKUP CTRL] deleteBackup error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
