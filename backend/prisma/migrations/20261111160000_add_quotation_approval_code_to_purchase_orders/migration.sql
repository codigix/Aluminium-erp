-- Admin Approval Reference Code of the source quotation, stored on the Purchase Order (additive, nullable)
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'quotation_approval_code'
);
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE `purchase_orders` ADD COLUMN `quotation_approval_code` VARCHAR(30) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
