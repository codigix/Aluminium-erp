-- Idempotent: safe to run on databases where these columns / tables already exist.
-- Payment History: vouchers are cancelled (reversed), never deleted, and every edit / cancel is audited.

-- Journal and contra vouchers get a status (POSTED / CANCELLED)
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `journal_vouchers` ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT ''POSTED''', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'journal_vouchers' AND COLUMN_NAME = 'status');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `contra_vouchers` ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT ''POSTED''', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contra_vouchers' AND COLUMN_NAME = 'status');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- cancelled_at / cancel_reason on every voucher table (debit_notes was also missing cancelled_at, used by its cancel)
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `journal_vouchers` ADD COLUMN `cancelled_at` TIMESTAMP NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'journal_vouchers' AND COLUMN_NAME = 'cancelled_at');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `journal_vouchers` ADD COLUMN `cancel_reason` TEXT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'journal_vouchers' AND COLUMN_NAME = 'cancel_reason');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `contra_vouchers` ADD COLUMN `cancelled_at` TIMESTAMP NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contra_vouchers' AND COLUMN_NAME = 'cancelled_at');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `contra_vouchers` ADD COLUMN `cancel_reason` TEXT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contra_vouchers' AND COLUMN_NAME = 'cancel_reason');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `debit_notes` ADD COLUMN `cancelled_at` TIMESTAMP NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'debit_notes' AND COLUMN_NAME = 'cancelled_at');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `debit_notes` ADD COLUMN `cancel_reason` TEXT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'debit_notes' AND COLUMN_NAME = 'cancel_reason');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `credit_notes` ADD COLUMN `cancelled_at` TIMESTAMP NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credit_notes' AND COLUMN_NAME = 'cancelled_at');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `credit_notes` ADD COLUMN `cancel_reason` TEXT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credit_notes' AND COLUMN_NAME = 'cancel_reason');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `customer_payments` ADD COLUMN `cancelled_at` TIMESTAMP NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_payments' AND COLUMN_NAME = 'cancelled_at');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `customer_payments` ADD COLUMN `cancel_reason` TEXT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_payments' AND COLUMN_NAME = 'cancel_reason');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `payments` ADD COLUMN `cancelled_at` TIMESTAMP NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'cancelled_at');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `payments` ADD COLUMN `cancel_reason` TEXT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'cancel_reason');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Receipts / vendor payments can be CANCELLED (re-running this MODIFY is harmless)
ALTER TABLE `customer_payments` MODIFY COLUMN `status` ENUM('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED') NULL DEFAULT 'CONFIRMED';
ALTER TABLE `payments` MODIFY COLUMN `status` ENUM('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED') NULL DEFAULT 'CONFIRMED';

-- Who changed or cancelled which voucher, when, why, and what it changed
CREATE TABLE IF NOT EXISTS `voucher_audit_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `voucher_kind` VARCHAR(30) NOT NULL,
    `voucher_id` INTEGER NOT NULL,
    `voucher_no` VARCHAR(60) NULL,
    `action` VARCHAR(20) NOT NULL,
    `reason` TEXT NULL,
    `old_values` JSON NULL,
    `new_values` JSON NULL,
    `effects` JSON NULL,
    `user_id` INTEGER NULL,
    `user_name` VARCHAR(150) NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    INDEX `idx_val_voucher` (`voucher_kind`, `voucher_id`),
    INDEX `idx_val_created` (`created_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
