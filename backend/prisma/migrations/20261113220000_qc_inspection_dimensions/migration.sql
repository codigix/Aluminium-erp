-- QC "Inspection Dimension" (record only): the size measured by QC per QC line.
-- Added to qc_inspection_items: qc_length / qc_width / qc_thickness / qc_diameter / qc_outer_diameter (DECIMAL(12,4) NULL).
-- NULL = not entered. Stock / QC quantities are not affected. Additive; existing rows unchanged. Safe to run more than once.
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'qc_inspection_items' AND COLUMN_NAME = 'qc_length');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE `qc_inspection_items` ADD COLUMN `qc_length` DECIMAL(12,4) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'qc_inspection_items' AND COLUMN_NAME = 'qc_width');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE `qc_inspection_items` ADD COLUMN `qc_width` DECIMAL(12,4) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'qc_inspection_items' AND COLUMN_NAME = 'qc_thickness');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE `qc_inspection_items` ADD COLUMN `qc_thickness` DECIMAL(12,4) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'qc_inspection_items' AND COLUMN_NAME = 'qc_diameter');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE `qc_inspection_items` ADD COLUMN `qc_diameter` DECIMAL(12,4) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'qc_inspection_items' AND COLUMN_NAME = 'qc_outer_diameter');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE `qc_inspection_items` ADD COLUMN `qc_outer_diameter` DECIMAL(12,4) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;