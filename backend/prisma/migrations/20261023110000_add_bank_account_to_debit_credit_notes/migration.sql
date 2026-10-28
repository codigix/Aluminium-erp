-- Idempotent: safe to run on databases where these columns / indexes already exist.
-- AlterTable: company bank account the debit note amount relates to
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `debit_notes` ADD COLUMN `bank_account_id` INTEGER NULL AFTER `po_id`', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'debit_notes' AND COLUMN_NAME = 'bank_account_id');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'CREATE INDEX `idx_dn_bank_account` ON `debit_notes` (`bank_account_id`)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'debit_notes' AND INDEX_NAME = 'idx_dn_bank_account');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- AlterTable: company bank account the credit note amount relates to
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `credit_notes` ADD COLUMN `bank_account_id` INTEGER NULL AFTER `sales_invoice_id`', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credit_notes' AND COLUMN_NAME = 'bank_account_id');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'CREATE INDEX `idx_cn_bank_account` ON `credit_notes` (`bank_account_id`)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credit_notes' AND INDEX_NAME = 'idx_cn_bank_account');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
