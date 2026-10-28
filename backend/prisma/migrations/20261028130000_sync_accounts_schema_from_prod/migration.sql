-- Sync Accounts module schema: bring spTech_dev in line with spTech_prod.
-- Compared via information_schema. Indexes / FK that exist in dev under a different name than prod
-- (uq_debit_note_voucher_no, idx_jvi_voucher, idx_jv_date, idx_jv_no, debit_note_items_dn_fk) are
-- functionally identical to prod and are intentionally left as they are.

-- CreateTable: vendor payment allocations (exists in prod only)
CREATE TABLE IF NOT EXISTS `payment_allocations` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `payment_id` INT NOT NULL,
  `voucher_no` VARCHAR(100) NOT NULL,
  `vendor_id` INT NOT NULL,
  `po_id` INT NULL,
  `invoice_id` INT NULL,
  `allocation_type` VARCHAR(50) NULL DEFAULT 'Agst Ref',
  `reference_no` VARCHAR(100) NULL,
  `amount` DECIMAL(14, 2) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_payment_id` (`payment_id`),
  INDEX `idx_voucher_no` (`voucher_no`),
  INDEX `idx_po_id` (`po_id`),
  INDEX `idx_vendor_id` (`vendor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AlterTable: debit_notes - varchar columns become ENUMs, as in prod
ALTER TABLE `debit_notes`
  MODIFY COLUMN `entry_mode` ENUM('ITEM', 'LEDGER') NOT NULL DEFAULT 'ITEM',
  MODIFY COLUMN `gst_type` ENUM('INTRA', 'INTER', 'NONE') NOT NULL DEFAULT 'INTRA',
  MODIFY COLUMN `status` ENUM('POSTED', 'CANCELLED') NOT NULL DEFAULT 'POSTED';

-- AlterTable: journal_vouchers - widen voucher_no / reference_no, amount precision and narration as in prod
ALTER TABLE `journal_vouchers`
  MODIFY COLUMN `voucher_no` VARCHAR(100) NOT NULL,
  MODIFY COLUMN `reference_no` VARCHAR(255) NULL,
  MODIFY COLUMN `total_debit` DECIMAL(14, 2) NOT NULL,
  MODIFY COLUMN `total_credit` DECIMAL(14, 2) NOT NULL,
  MODIFY COLUMN `narration` TEXT NOT NULL;

-- AlterTable: journal_voucher_items - created_at column and nullable amounts as in prod
ALTER TABLE `journal_voucher_items`
  MODIFY COLUMN `debit_amount` DECIMAL(14, 2) NULL DEFAULT 0.00,
  MODIFY COLUMN `credit_amount` DECIMAL(14, 2) NULL DEFAULT 0.00;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `journal_voucher_items` ADD COLUMN `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'journal_voucher_items' AND COLUMN_NAME = 'created_at');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

