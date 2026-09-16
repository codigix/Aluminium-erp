const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the backup directory path from .env, creating it if it doesn't exist.
 */
function getBackupDir() {
  const dir = process.env.BACKUP_DIR
    ? path.resolve(process.env.BACKUP_DIR)
    : path.resolve(__dirname, '..', '..', '..', '..', 'backups');

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[BACKUP] Created backup directory: ${dir}`);
  }
  return dir;
}

/**
 * Builds the filename: HRM_DB_Backup_DD_MM_YYYY.sql
 * Example: HRM_DB_Backup_15_09_2026.sql
 */
function buildFilename(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const dd   = pad(date.getDate());
  const mm   = pad(date.getMonth() + 1);
  const yyyy = date.getFullYear();
  return `HRM_DB_Backup_${dd}_${mm}_${yyyy}.sql`;
}

/**
 * Returns human-readable file size string.
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Sends an admin failure email using the existing emailService.
 */
async function sendFailureEmail(error) {
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_FROM_ADDRESS,
        pass: process.env.MAIL_PASSWORD,
      },
    });

    const adminEmail =
      process.env.BACKUP_ADMIN_EMAIL ||
      process.env.MAIL_FROM_ADDRESS;

    await transporter.sendMail({
      from: `"ERP System" <${process.env.MAIL_FROM_ADDRESS}>`,
      to: adminEmail,
      subject: '⚠️ Database Backup Failed — Aluminium ERP',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px;">
          <h2 style="color:#dc2626;">❌ Database Backup Failed</h2>
          <p style="color:#374151;">The scheduled database backup for <strong>${process.env.DB_NAME}</strong> has failed.</p>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:16px;margin:16px 0;">
            <strong style="color:#dc2626;">Error Details:</strong>
            <pre style="margin:8px 0;color:#7f1d1d;white-space:pre-wrap;">${String(error)}</pre>
          </div>
          <p style="color:#6b7280;font-size:13px;">Time: ${new Date().toLocaleString('en-IN')}</p>
          <p style="color:#6b7280;font-size:13px;">Please check the server and ensure <code>mysqldump</code> is available in PATH.</p>
        </div>
      `,
    });
    console.log('[BACKUP] Failure notification email sent to', adminEmail);
  } catch (emailErr) {
    console.error('[BACKUP] Could not send failure email:', emailErr.message);
  }
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Runs a full database backup using mysqldump.
 * Returns { success, filename, filePath, size, sizeFormatted, timestamp } on success
 * Returns { success: false, error }                                         on failure
 */
async function runBackup() {
  const now = new Date();
  const filename = buildFilename(now);
  const backupDir = getBackupDir();
  const filePath = path.join(backupDir, filename);

  const host     = process.env.DB_HOST     || 'localhost';
  const port     = process.env.DB_PORT     || '3306';
  const user     = process.env.DB_USER     || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME     || 'sales_erp';

  // Use --no-tablespaces to avoid needing PROCESS privilege
  const command = `mysqldump --no-tablespaces -h ${host} -P ${port} -u ${user} -p"${password}" ${database} --result-file="${filePath}"`;

  console.log(`[BACKUP] Starting backup → ${filename}`);

  try {
    const { stderr } = await execAsync(command, { timeout: 5 * 60 * 1000 }); // 5 min timeout

    // mysqldump can emit warnings to stderr even on success; check file actually exists & has content
    if (!fs.existsSync(filePath)) {
      throw new Error('Backup file was not created. stderr: ' + stderr);
    }

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      fs.unlinkSync(filePath);
      throw new Error('Backup file is empty (0 bytes). Check DB credentials.');
    }

    console.log(`[BACKUP] ✅ Success → ${filename} (${formatBytes(stats.size)})`);
    return {
      success: true,
      filename,
      filePath,
      size: stats.size,
      sizeFormatted: formatBytes(stats.size),
      timestamp: now.toISOString(),
    };
  } catch (err) {
    console.error('[BACKUP] ❌ Failed:', err.message);
    await sendFailureEmail(err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Rolling retention: keeps only the latest BACKUP_MAX_COUNT backup files.
 * Sorts all .sql files newest → oldest, then deletes everything beyond the limit.
 *
 * Example with BACKUP_MAX_COUNT=30:
 *   Day 31 → 31 files exist → delete the oldest 1 → always 30 files remain
 *   Day 60 → same, always 30 latest files kept
 */
async function pruneOldBackups() {
  // Max backups to keep — hardcoded to 30 (rolling retention)
  const maxCount = 30;
  const backupDir = getBackupDir();

  try {
    // Get all .sql files with their modified times
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.endsWith('.sql'))
      .map((filename) => {
        const filePath = path.join(backupDir, filename);
        const { mtime } = fs.statSync(filePath);
        return { filename, filePath, mtime: mtime.getTime() };
      })
      .sort((a, b) => b.mtime - a.mtime); // newest first

    // Everything beyond maxCount gets deleted
    const toDelete = files.slice(maxCount);

    if (toDelete.length === 0) {
      console.log(`[BACKUP] Rolling retention OK — ${files.length}/${maxCount} backups stored.`);
      return;
    }

    for (const file of toDelete) {
      fs.unlinkSync(file.filePath);
      console.log(`[BACKUP] 🗑️  Rolling delete → ${file.filename}`);
    }

    console.log(`[BACKUP] Pruned ${toDelete.length} old backup(s). Keeping latest ${maxCount}.`);
  } catch (err) {
    console.error('[BACKUP] Error during rolling pruning:', err.message);
  }
}

/**
 * Lists all backup files in the backup directory.
 * Returns array of { filename, filePath, size, sizeFormatted, createdAt, age }
 */
function listBackupFiles() {
  const backupDir = getBackupDir();
  const now = Date.now();

  try {
    return fs
      .readdirSync(backupDir)
      .filter((f) => f.endsWith('.sql'))
      .map((filename) => {
        const filePath = path.join(backupDir, filename);
        const stats = fs.statSync(filePath);
        const ageMs = now - stats.mtime.getTime();
        const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
        return {
          filename,
          filePath,
          size: stats.size,
          sizeFormatted: formatBytes(stats.size),
          createdAt: stats.mtime.toISOString(),
          ageDays,
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // newest first
  } catch (err) {
    console.error('[BACKUP] Error listing backups:', err.message);
    return [];
  }
}

/**
 * Returns the backup directory path (resolved).
 */
function getBackupDirPath() {
  return getBackupDir();
}

module.exports = {
  runBackup,
  pruneOldBackups,
  listBackupFiles,
  getBackupDirPath,
  buildFilename,
  formatBytes,
};
