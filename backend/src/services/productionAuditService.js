const pool = require('../config/db');

// Best-effort audit write: a failure to log must never break the production
// action itself, so errors are reported and swallowed. Pass the caller's
// connection so the entry commits (or rolls back) with the action it describes.
const logProductionEvent = async (connectionOrPool, { entityType, entityId = null, action, oldValue = null, newValue = null, reason = null, userId = null }) => {
  const conn = connectionOrPool || pool;
  try {
    await conn.execute(
      `INSERT INTO production_audit_log (entity_type, entity_id, action, old_value, new_value, reason, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entityType,
        entityId,
        action,
        oldValue === null || oldValue === undefined ? null : String(typeof oldValue === 'object' ? JSON.stringify(oldValue) : oldValue),
        newValue === null || newValue === undefined ? null : String(typeof newValue === 'object' ? JSON.stringify(newValue) : newValue),
        reason ? String(reason).slice(0, 500) : null,
        userId
      ]
    );
  } catch (error) {
    console.error('[productionAudit] failed to write audit entry:', error.message);
  }
};

module.exports = { logProductionEvent };
