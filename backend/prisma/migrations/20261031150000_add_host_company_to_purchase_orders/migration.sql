-- Idempotent: safe to run on databases where this column / index already exists.
-- Issuing billing profile (company_master) chosen on the purchase order; NULL falls back to the quotation's company.

-- AlterTable purchase_orders
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `purchase_orders` ADD COLUMN `host_company_id` INTEGER NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'host_company_id');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'CREATE INDEX `idx_po_host_company` ON `purchase_orders` (`host_company_id`)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_orders' AND INDEX_NAME = 'idx_po_host_company');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
