-- QC Decision per Incoming-QC line: ACCEPT / TOLERANCE (Accept with Tolerance) / REJECT.
--   qc_decision           NULL = not decided (older inspections keep working as before)
--   tolerance_diff_weight actual (QC) weight minus received weight, kg (or qty for bought-out)
--   tolerance_pct         that difference as % of the received weight / qty
--   tolerance_reason      mandatory for TOLERANCE
--   decision_by / _at     who saved the decision (the QC save is the tolerance approval)
-- Plus app_settings (key/value) holding the global allowed tolerance % (default 5).
-- Stock posting is unchanged: accepted qty/weight go to stock, rejected never does.
-- Additive only; existing rows unchanged. Safe to run more than once.
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'qc_inspection_items' AND COLUMN_NAME = 'qc_decision');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE `qc_inspection_items` ADD COLUMN `qc_decision` VARCHAR(20) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'qc_inspection_items' AND COLUMN_NAME = 'tolerance_diff_weight');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE `qc_inspection_items` ADD COLUMN `tolerance_diff_weight` DECIMAL(12,3) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'qc_inspection_items' AND COLUMN_NAME = 'tolerance_pct');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE `qc_inspection_items` ADD COLUMN `tolerance_pct` DECIMAL(8,3) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'qc_inspection_items' AND COLUMN_NAME = 'tolerance_reason');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE `qc_inspection_items` ADD COLUMN `tolerance_reason` VARCHAR(500) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'qc_inspection_items' AND COLUMN_NAME = 'decision_by');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE `qc_inspection_items` ADD COLUMN `decision_by` INT NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'qc_inspection_items' AND COLUMN_NAME = 'decision_at');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE `qc_inspection_items` ADD COLUMN `decision_at` TIMESTAMP NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
CREATE TABLE IF NOT EXISTS `app_settings` (
  `setting_key` VARCHAR(100) NOT NULL,
  `setting_value` VARCHAR(500) NULL,
  `updated_by` INT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
);
INSERT IGNORE INTO `app_settings` (`setting_key`, `setting_value`) VALUES ('qc_weight_tolerance_pct', '5');
