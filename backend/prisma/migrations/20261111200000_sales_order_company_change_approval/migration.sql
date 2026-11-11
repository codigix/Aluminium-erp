-- Sales Order issuing company → change only through Admin approval.
-- Additive only: no existing table, column or row is modified. Safe to run more than once.

CREATE TABLE IF NOT EXISTS `company_change_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `order_no` VARCHAR(50) NULL,
  `customer_po_id` INT NULL,
  `customer_po_number` VARCHAR(100) NULL,
  `current_company_id` INT NULL,
  `current_company_name` VARCHAR(255) NULL,
  `requested_company_id` INT NOT NULL,
  `requested_company_name` VARCHAR(255) NULL,
  `reason` TEXT NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  `requested_by` INT NULL,
  `requested_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `decided_by` INT NULL,
  `decided_at` DATETIME NULL,
  `decision_remarks` TEXT NULL,
  `requester_notified_at` DATETIME NULL,
  -- Only one PENDING request per Sales Order (NULL for decided requests, so history is unlimited)
  `pending_order_id` INT GENERATED ALWAYS AS (CASE WHEN `status` = 'PENDING' THEN `order_id` ELSE NULL END) STORED,
  UNIQUE KEY `uq_ccr_one_pending_per_order` (`pending_order_id`),
  INDEX `idx_ccr_order` (`order_id`),
  INDEX `idx_ccr_status` (`status`)
);

CREATE TABLE IF NOT EXISTS `company_change_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `request_id` INT NULL,
  `order_id` INT NOT NULL,
  `order_no` VARCHAR(50) NULL,
  `customer_po_id` INT NULL,
  `old_company_id` INT NULL,
  `new_company_id` INT NULL,
  `old_company_snapshot` JSON NULL,
  `new_company_snapshot` JSON NULL,
  `changed_by` INT NULL,
  `changed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `remarks` TEXT NULL,
  INDEX `idx_cch_order` (`order_id`),
  INDEX `idx_cch_request` (`request_id`)
);

INSERT IGNORE INTO `permissions` (`name`, `code`, `description`, `resource`, `action`, `status`)
VALUES ('Approve Company Changes', 'COMPANY_CHANGE_APPROVE', 'Approve or reject Sales Order issuing-company change requests (Admin)', 'orders', 'approve_company_change', 'ACTIVE');
