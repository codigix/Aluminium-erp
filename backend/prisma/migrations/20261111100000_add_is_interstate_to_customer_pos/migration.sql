-- Idempotent: safe to run on databases where this column already exists.
-- Customer PO Tax Type: 0 = Intra (CGST+SGST), 1 = Inter (IGST).

-- AlterTable customer_pos
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `customer_pos` ADD COLUMN `is_interstate` TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_pos' AND COLUMN_NAME = 'is_interstate');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
