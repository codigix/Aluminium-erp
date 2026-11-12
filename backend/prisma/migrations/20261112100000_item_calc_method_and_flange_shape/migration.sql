-- Item Master calculation method (additive, nullable). NULL = existing/standard calculation (e.g. Pipe Calculation 1).
-- Values: 'PIPE_HOLLOW' (Pipe Calculation 2 - OD/ID/L), 'FLANGE' (OD/ID/T). Existing rows are not changed.
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_balance' AND COLUMN_NAME = 'calc_method'
);
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE `stock_balance` ADD COLUMN `calc_method` VARCHAR(30) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Flange shape (only if not already present)
INSERT INTO `shapes` (`name`, `status`)
SELECT 'Flange', 'ACTIVE' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `shapes` WHERE LOWER(TRIM(`name`)) = 'flange');
