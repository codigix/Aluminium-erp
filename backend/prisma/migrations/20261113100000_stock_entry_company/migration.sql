-- Stock Entry issuing company (Company Master id). Additive and nullable: existing entries stay NULL ("No company")
-- and nothing else is changed. Safe to run more than once.
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_entries' AND COLUMN_NAME = 'host_company_id'
);
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE `stock_entries` ADD COLUMN `host_company_id` INT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
