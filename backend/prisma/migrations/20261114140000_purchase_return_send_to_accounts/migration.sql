-- Purchase Return (type DEBIT_NOTE) "Send to Accounts":
--   sent_to_accounts_at / _by  set when Procurement sends a dispatched return to Accounts.
--   It then shows under Accounts → Debit Note → "Pending Debit Notes" until a debit note is posted
--   (purchase_returns.debit_note_id is linked and the return becomes CLOSED).
-- Additive only; existing rows unchanged. Safe to run more than once.
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_returns' AND COLUMN_NAME = 'sent_to_accounts_at');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE `purchase_returns` ADD COLUMN `sent_to_accounts_at` TIMESTAMP NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_returns' AND COLUMN_NAME = 'sent_to_accounts_by');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE `purchase_returns` ADD COLUMN `sent_to_accounts_by` INT NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
