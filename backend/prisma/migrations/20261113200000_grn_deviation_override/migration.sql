-- GRN "Tolerance Override (Deviation)" (record only): a tick + reason per GRN line, entered on Create GRN.
-- Added to po_receipt_items and grn_items: deviation_override TINYINT(1) NOT NULL DEFAULT 0, deviation_reason VARCHAR(500) NULL.
-- Additive; existing rows get 0 / NULL. Safe to run more than once.
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'po_receipt_items' AND COLUMN_NAME = 'deviation_override');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE `po_receipt_items` ADD COLUMN `deviation_override` TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'po_receipt_items' AND COLUMN_NAME = 'deviation_reason');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE `po_receipt_items` ADD COLUMN `deviation_reason` VARCHAR(500) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'grn_items' AND COLUMN_NAME = 'deviation_override');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE `grn_items` ADD COLUMN `deviation_override` TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'grn_items' AND COLUMN_NAME = 'deviation_reason');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE `grn_items` ADD COLUMN `deviation_reason` VARCHAR(500) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;