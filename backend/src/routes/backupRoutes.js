const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const backupController = require('../controllers/backupController');

// ─── Admin-only middleware ────────────────────────────────────────────────────
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated.' });
    }

    // Allow SYS_ADMIN from JWT token role field
    if (req.user.role === 'SYS_ADMIN') return next();

    // Fallback: check via DB
    const db = require('../config/db');
    const [rows] = await db.query('SELECT code FROM roles WHERE id = ?', [req.user.role_id]);
    if (rows.length > 0 && rows[0].code === 'SYS_ADMIN') return next();

    return res.status(403).json({ error: 'Access denied. Admin only.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─── Backup Routes (all protected: authenticate + requireAdmin) ───────────────

// GET    /api/backups             → list all backups
router.get('/', authenticate, requireAdmin, backupController.listBackups);

// POST   /api/backups/trigger     → run a manual backup now
router.post('/trigger', authenticate, requireAdmin, backupController.triggerBackup);

// GET    /api/backups/config      → get backup configuration
router.get('/config', authenticate, requireAdmin, backupController.getConfig);

// GET    /api/backups/:filename/download  → download a backup file
router.get('/:filename/download', authenticate, requireAdmin, backupController.downloadBackup);

// POST   /api/backups/:filename/restore   → restore DB from backup
router.post('/:filename/restore', authenticate, requireAdmin, backupController.restoreBackup);

// DELETE /api/backups/:filename           → delete a backup file
router.delete('/:filename', authenticate, requireAdmin, backupController.deleteBackup);

module.exports = router;
