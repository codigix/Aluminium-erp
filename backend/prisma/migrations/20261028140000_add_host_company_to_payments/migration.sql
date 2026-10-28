-- Idempotent: safe to run on databases where these columns / indexes already exist.
-- Company (company_master) each receipt, payment, journal, contra, debit note and credit note was recorded for.

-- AlterTable customer_payments
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `customer_payments` ADD COLUMN `host_company_id` INTEGER NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_payments' AND COLUMN_NAME = 'host_company_id');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'CREATE INDEX `idx_cp_host_company` ON `customer_payments` (`host_company_id`)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_payments' AND INDEX_NAME = 'idx_cp_host_company');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- AlterTable payments
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `payments` ADD COLUMN `host_company_id` INTEGER NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'host_company_id');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'CREATE INDEX `idx_pay_host_company` ON `payments` (`host_company_id`)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND INDEX_NAME = 'idx_pay_host_company');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- AlterTable journal_vouchers
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `journal_vouchers` ADD COLUMN `host_company_id` INTEGER NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'journal_vouchers' AND COLUMN_NAME = 'host_company_id');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'CREATE INDEX `idx_jv_host_company` ON `journal_vouchers` (`host_company_id`)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'journal_vouchers' AND INDEX_NAME = 'idx_jv_host_company');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- AlterTable contra_vouchers
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `contra_vouchers` ADD COLUMN `host_company_id` INTEGER NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contra_vouchers' AND COLUMN_NAME = 'host_company_id');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'CREATE INDEX `idx_contra_host_company` ON `contra_vouchers` (`host_company_id`)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contra_vouchers' AND INDEX_NAME = 'idx_contra_host_company');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- AlterTable debit_notes
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `debit_notes` ADD COLUMN `host_company_id` INTEGER NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'debit_notes' AND COLUMN_NAME = 'host_company_id');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'CREATE INDEX `idx_dn_host_company` ON `debit_notes` (`host_company_id`)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'debit_notes' AND INDEX_NAME = 'idx_dn_host_company');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- AlterTable credit_notes
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `credit_notes` ADD COLUMN `host_company_id` INTEGER NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credit_notes' AND COLUMN_NAME = 'host_company_id');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'CREATE INDEX `idx_cn_host_company` ON `credit_notes` (`host_company_id`)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credit_notes' AND INDEX_NAME = 'idx_cn_host_company');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
