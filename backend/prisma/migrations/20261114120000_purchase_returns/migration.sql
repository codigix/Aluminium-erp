-- Purchase Returns (Procurement): QC-rejected GRN material sent back to the supplier.
--   purchase_returns       one return (PR-YYYY-NNNN) for one supplier + PO: type REPLACEMENT / DEBIT_NOTE,
--                          status DRAFT → DISPATCHED → CLOSED (or CANCELLED while DRAFT)
--   purchase_return_items  returned qty / weight per rejected QC line (qc_inspection_items), never more than rejected
-- Rejected material never entered stock, so a return posts no stock movement.
-- New tables only; nothing existing is changed. Safe to run more than once.
CREATE TABLE IF NOT EXISTS `purchase_returns` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `return_no` VARCHAR(50) NOT NULL,
  `return_date` DATE NOT NULL,
  `vendor_id` INT NOT NULL,
  `po_id` INT NULL,
  `po_number` VARCHAR(100) NULL,
  `host_company_id` INT NULL,
  `return_type` VARCHAR(20) NOT NULL DEFAULT 'REPLACEMENT',
  `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  `reason` TEXT NULL,
  `vehicle_no` VARCHAR(50) NULL,
  `transporter` VARCHAR(150) NULL,
  `remarks` TEXT NULL,
  `debit_note_id` INT NULL,
  `dispatched_at` TIMESTAMP NULL,
  `dispatched_by` INT NULL,
  `closed_at` TIMESTAMP NULL,
  `cancelled_at` TIMESTAMP NULL,
  `created_by` INT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_purchase_return_no` (`return_no`),
  KEY `idx_pr_vendor` (`vendor_id`),
  KEY `idx_pr_po` (`po_id`),
  KEY `idx_pr_status` (`status`)
);

CREATE TABLE IF NOT EXISTS `purchase_return_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `purchase_return_id` INT NOT NULL,
  `qc_inspection_item_id` INT NOT NULL,
  `qc_inspection_id` INT NULL,
  `grn_id` INT NULL,
  `grn_item_id` INT NULL,
  `po_item_id` INT NULL,
  `item_code` VARCHAR(120) NULL,
  `description` VARCHAR(500) NULL,
  `size_text` VARCHAR(200) NULL,
  `quantity` DECIMAL(12,3) NOT NULL DEFAULT 0,
  `weight` DECIMAL(12,3) NOT NULL DEFAULT 0,
  `unit` VARCHAR(20) NULL,
  `rate` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `amount` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `remarks` VARCHAR(500) NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pri_return` (`purchase_return_id`),
  KEY `idx_pri_qc_item` (`qc_inspection_item_id`),
  KEY `idx_pri_po_item` (`po_item_id`)
);
