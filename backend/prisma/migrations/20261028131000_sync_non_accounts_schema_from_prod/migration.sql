-- Sync non-Accounts schema: bring spTech_dev in line with spTech_prod (Production Plan objects excluded).
-- Accounts changes (payment_allocations, journal voucher / debit note columns) are in
-- 20261028130000_sync_accounts_schema_from_prod.

-- CreateTable: document number sequences
CREATE TABLE IF NOT EXISTS `document_sequences` (
  `sequence_key` VARCHAR(100) NOT NULL,
  `current_value` INT NOT NULL DEFAULT 0,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`sequence_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- CreateTable: final QC inspections per sales order
CREATE TABLE IF NOT EXISTS `final_qc_inspections` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `sales_order_id` INT NOT NULL,
  `result` ENUM('PASSED', 'FAILED') NOT NULL,
  `passed_qty` DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
  `failed_qty` DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
  `remarks` TEXT NULL,
  `inspected_by` INT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_final_qc_so` (`sales_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- CreateTable: production audit log
CREATE TABLE IF NOT EXISTS `production_audit_log` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` INT NULL,
  `action` VARCHAR(50) NOT NULL,
  `old_value` TEXT NULL,
  `new_value` TEXT NULL,
  `reason` VARCHAR(500) NULL,
  `user_id` INT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_pal_entity` (`entity_type`, `entity_id`),
  INDEX `idx_pal_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- CreateTable: work order predecessor / successor dependencies
CREATE TABLE IF NOT EXISTS `work_order_dependencies` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `predecessor_wo_id` INT NOT NULL,
  `successor_wo_id` INT NOT NULL,
  `qty_per_unit` DECIMAL(12, 4) NOT NULL DEFAULT 1.0000,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_wo_dependency` (`predecessor_wo_id`, `successor_wo_id`),
  INDEX `successor_wo_id` (`successor_wo_id`),
  CONSTRAINT `work_order_dependencies_ibfk_1` FOREIGN KEY (`predecessor_wo_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `work_order_dependencies_ibfk_2` FOREIGN KEY (`successor_wo_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- CreateTable: material returned / offcut / scrap from a work order
CREATE TABLE IF NOT EXISTS `work_order_material_returns` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `work_order_id` INT NOT NULL,
  `item_code` VARCHAR(100) NULL,
  `material_name` VARCHAR(255) NULL,
  `material_type` VARCHAR(100) NULL,
  `quantity` DECIMAL(12, 3) NOT NULL,
  `uom` VARCHAR(20) NULL,
  `return_type` ENUM('RETURN', 'OFFCUT', 'SCRAP') NOT NULL DEFAULT 'RETURN',
  `warehouse` VARCHAR(100) NULL,
  `remarks` TEXT NULL,
  `returned_by` INT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `work_order_id` (`work_order_id`),
  CONSTRAINT `work_order_material_returns_ibfk_1` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- AlterTable: job_card_quality_logs - creator / approval / rework routing
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `job_card_quality_logs` ADD COLUMN `created_by` INT NULL AFTER `vendor_invoice_no`', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'job_card_quality_logs' AND COLUMN_NAME = 'created_by');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `job_card_quality_logs` ADD COLUMN `approved_by` INT NULL AFTER `created_by`', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'job_card_quality_logs' AND COLUMN_NAME = 'approved_by');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `job_card_quality_logs` ADD COLUMN `approved_at` DATETIME NULL AFTER `approved_by`', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'job_card_quality_logs' AND COLUMN_NAME = 'approved_at');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `job_card_quality_logs` ADD COLUMN `rework_routing_type` VARCHAR(30) NULL DEFAULT ''SAME_OPERATION'' AFTER `approved_at`', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'job_card_quality_logs' AND COLUMN_NAME = 'rework_routing_type');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `job_card_quality_logs` ADD COLUMN `rework_target_job_card_id` INT NULL AFTER `rework_routing_type`', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'job_card_quality_logs' AND COLUMN_NAME = 'rework_target_job_card_id');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- AlterTable: job_cards - hold and rework tracking
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `job_cards` ADD COLUMN `held_by_job_card_id` INT NULL AFTER `scrap_qty`', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'job_cards' AND COLUMN_NAME = 'held_by_job_card_id');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `job_cards` ADD COLUMN `held_at` DATETIME NULL AFTER `held_by_job_card_id`', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'job_cards' AND COLUMN_NAME = 'held_at');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `job_cards` ADD COLUMN `hold_reason` VARCHAR(500) NULL AFTER `held_at`', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'job_cards' AND COLUMN_NAME = 'hold_reason');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `job_cards` ADD COLUMN `status_before_hold` VARCHAR(20) NULL AFTER `hold_reason`', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'job_cards' AND COLUMN_NAME = 'status_before_hold');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `job_cards` ADD COLUMN `is_rework` TINYINT(1) NOT NULL DEFAULT 0 AFTER `status_before_hold`', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'job_cards' AND COLUMN_NAME = 'is_rework');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `job_cards` ADD COLUMN `rework_of_job_card_id` INT NULL AFTER `is_rework`', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'job_cards' AND COLUMN_NAME = 'rework_of_job_card_id');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- AlterTable: material_issues - where the issued stock came from
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `material_issues` ADD COLUMN `stock_source` VARCHAR(20) NOT NULL DEFAULT ''DIRECT'' AFTER `remarks`', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'material_issues' AND COLUMN_NAME = 'stock_source');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- AlterTable: sales_orders - payment tracking and the full status list
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `sales_orders` ADD COLUMN `paid_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00 AFTER `host_company_id`', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales_orders' AND COLUMN_NAME = 'paid_amount');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `sales_orders` ADD COLUMN `payment_status` ENUM(''UNPAID'', ''PARTIAL'', ''PAID'') NOT NULL DEFAULT ''UNPAID'' AFTER `paid_amount`', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales_orders' AND COLUMN_NAME = 'payment_status');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE `sales_orders`
  MODIFY COLUMN `status` ENUM('CREATED', 'DESIGN_QUERY', 'DESIGN_IN_REVIEW', 'DESIGN_APPROVED', 'BOM_SUBMITTED', 'BOM_APPROVED', 'QUOTATION_SENT', 'PROCUREMENT_IN_PROGRESS', 'MATERIAL_PURCHASE_IN_PROGRESS', 'MATERIAL_READY', 'IN_PRODUCTION', 'PRODUCTION_COMPLETED', 'QC_IN_PROGRESS', 'QC_REJECTED', 'QC_APPROVED', 'READY_FOR_SHIPMENT', 'PARTIALLY_SHIPPED', 'SHIPPED', 'DELIVERED', 'CLOSED', 'CANCELLED') NULL DEFAULT 'CREATED';

-- AlterTable: work_orders - source_type becomes a free VARCHAR(50), as in prod
ALTER TABLE `work_orders`
  MODIFY COLUMN `source_type` VARCHAR(50) NULL DEFAULT 'FG';
