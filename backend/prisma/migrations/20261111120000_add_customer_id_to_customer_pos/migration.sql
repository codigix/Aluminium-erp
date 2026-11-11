-- Idempotent: safe to run on databases where this column already exists.
-- Customer PO → Customer Master (customers.id) link. Existing POs keep NULL; company_id is unchanged.

-- AlterTable customer_pos
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `customer_pos` ADD COLUMN `customer_id` INT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_pos' AND COLUMN_NAME = 'customer_id');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
