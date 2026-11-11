-- Purchase Order -> Admin approval. Additive only: existing PO records and statuses are not modified.

-- 1. Add PENDING_APPROVAL to purchase_orders.status (all existing values, incl. MERGED, kept; default unchanged)
SET @has_val = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'status'
    AND COLUMN_TYPE LIKE '%''PENDING_APPROVAL''%'
);
SET @ddl = IF(@has_val = 0,
  'ALTER TABLE `purchase_orders` MODIFY COLUMN `status` ENUM(''DRAFT'',''PO_REQUEST'',''ORDERED'',''SENT'',''ACKNOWLEDGED'',''RECEIVED'',''PARTIALLY_RECEIVED'',''CLOSED'',''COMPLETED'',''FULFILLED'',''APPROVED'',''PENDING_PAYMENT'',''PAID'',''MERGED'',''PENDING_APPROVAL'') DEFAULT ''ORDERED''',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Approval columns (nullable)
SET @c = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'po_approval_code');
SET @ddl = IF(@c = 0, 'ALTER TABLE `purchase_orders` ADD COLUMN `po_approval_code` VARCHAR(30) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'po_approval_remarks');
SET @ddl = IF(@c = 0, 'ALTER TABLE `purchase_orders` ADD COLUMN `po_approval_remarks` TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'submitted_for_approval_by');
SET @ddl = IF(@c = 0, 'ALTER TABLE `purchase_orders` ADD COLUMN `submitted_for_approval_by` INT NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'submitted_for_approval_at');
SET @ddl = IF(@c = 0, 'ALTER TABLE `purchase_orders` ADD COLUMN `submitted_for_approval_at` DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Unique approval code (NULLs allowed for existing POs)
SET @i = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_orders' AND INDEX_NAME = 'uq_purchase_orders_po_approval_code');
SET @ddl = IF(@i = 0, 'ALTER TABLE `purchase_orders` ADD UNIQUE INDEX `uq_purchase_orders_po_approval_code` (`po_approval_code`)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. Approval / revision history
CREATE TABLE IF NOT EXISTS `po_approval_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `po_id` INT NOT NULL,
  `po_number` VARCHAR(100) NULL,
  `vendor_id` INT NULL,
  `action` VARCHAR(20) NOT NULL,
  `approval_code` VARCHAR(30) NULL,
  `total_amount` DECIMAL(14,2) NULL,
  `remarks` TEXT NULL,
  `snapshot` JSON NULL,
  `acted_by` INT NULL,
  `acted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_poah_po` (`po_id`),
  INDEX `idx_poah_action` (`action`)
);

-- 5. PA-YYYY-MM-#### counter
CREATE TABLE IF NOT EXISTS `po_approval_sequences` (
  `period` CHAR(7) NOT NULL PRIMARY KEY,
  `last_seq` INT NOT NULL DEFAULT 0
);

-- 6. Permission (System Admin already bypasses permission checks)
INSERT IGNORE INTO `permissions` (`name`, `code`, `description`, `resource`, `action`, `status`)
VALUES ('Approve Purchase Orders', 'PO_APPROVE', 'Approve or reject Purchase Orders (Admin approval)', 'purchase_orders', 'approve', 'ACTIVE');
