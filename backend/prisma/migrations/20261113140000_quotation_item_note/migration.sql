-- Per-drawing description / note on quotation lines, printed in brackets ( ) in the quotation PDF Description column.
-- Additive and nullable; existing lines are not changed. Safe to run more than once.
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotation_items' AND COLUMN_NAME = 'item_note'
);
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE `quotation_items` ADD COLUMN `item_note` VARCHAR(500) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
