-- PO line remark (from the quotation line Description, or typed in Create / Edit PO), printed in brackets under the
-- size in the PO PDF. Additive and nullable; existing PO lines are not changed. Safe to run more than once.
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_order_items' AND COLUMN_NAME = 'item_note'
);
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE `purchase_order_items` ADD COLUMN `item_note` VARCHAR(500) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
