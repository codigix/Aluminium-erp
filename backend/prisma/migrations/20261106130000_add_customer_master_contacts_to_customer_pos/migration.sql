-- Idempotent: safe to run on databases where this column already exists.
-- Contact persons (customer_contacts.id, JSON array) selected from Customer Master on a Customer PO.

-- AlterTable customer_pos
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `customer_pos` ADD COLUMN `customer_master_contact_ids` TEXT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_pos' AND COLUMN_NAME = 'customer_master_contact_ids');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
