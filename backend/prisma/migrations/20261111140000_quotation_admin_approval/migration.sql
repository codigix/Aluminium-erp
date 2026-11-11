-- RFQ Vendor Quotation → Admin Approval workflow.
-- Idempotent and additive only: existing quotations and purchase orders are not modified.

-- 1. New status PENDING_APPROVAL (REVIEWED keeps meaning "Approved").
--    Skipped when the value already exists (the backend adds it at startup), so existing enum values are never touched.
SET @has_val = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations' AND COLUMN_NAME = 'status'
    AND COLUMN_TYPE LIKE '%''PENDING_APPROVAL''%'
);
SET @ddl = IF(@has_val = 0,
  'ALTER TABLE `quotations` MODIFY COLUMN `status` ENUM(''DRAFT'',''SENT'',''RECEIVED'',''REVIEWED'',''CLOSED'',''PENDING'',''EMAIL_RECEIVED'',''SUPERSEDED'',''REJECTED'',''MERGED'',''PENDING_APPROVAL'') DEFAULT ''DRAFT''',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Approval reference fields on quotations
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `quotations` ADD COLUMN `approval_code` VARCHAR(30) NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations' AND COLUMN_NAME = 'approval_code');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `quotations` ADD COLUMN `approval_remarks` TEXT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations' AND COLUMN_NAME = 'approval_remarks');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `quotations` ADD COLUMN `approved_by` INT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations' AND COLUMN_NAME = 'approved_by');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `quotations` ADD COLUMN `approved_at` DATETIME NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations' AND COLUMN_NAME = 'approved_at');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `quotations` ADD COLUMN `submitted_for_approval_by` INT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations' AND COLUMN_NAME = 'submitted_for_approval_by');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `quotations` ADD COLUMN `submitted_for_approval_at` DATETIME NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations' AND COLUMN_NAME = 'submitted_for_approval_at');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `quotations` ADD UNIQUE INDEX `uq_quotations_approval_code` (`approval_code`)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations' AND INDEX_NAME = 'uq_quotations_approval_code');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Approval history (audit trail)
CREATE TABLE IF NOT EXISTS `quotation_approval_history` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `quotation_id` INT NOT NULL,
  `quote_number` VARCHAR(100) NULL,
  `base_quote_number` VARCHAR(100) NULL,
  `vendor_id` INT NULL,
  `action` VARCHAR(20) NOT NULL,
  `approval_code` VARCHAR(30) NULL,
  `grand_total` DECIMAL(14,2) NULL,
  `remarks` TEXT NULL,
  `acted_by` INT NULL,
  `acted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_qah_quotation` (`quotation_id`),
  INDEX `idx_qah_base` (`base_quote_number`),
  INDEX `idx_qah_action` (`action`)
);

-- 4. Per-month approval code counter (QA-YYYY-MM-####)
CREATE TABLE IF NOT EXISTS `quotation_approval_sequences` (
  `period` CHAR(7) NOT NULL,
  `last_seq` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`period`)
);

-- 5. Permission (System Admin passes all checks; this lets the right be granted to other roles later)
INSERT IGNORE INTO `permissions` (`name`, `code`, `description`, `resource`, `action`, `status`)
VALUES ('Approve Quotations', 'QUOTATION_APPROVE', 'Approve or reject vendor quotations (Admin approval)', 'quotations', 'approve', 'ACTIVE');
