-- Create missing tables (if not already created)
CREATE TABLE IF NOT EXISTS `procurement_rfq_vendor_assignments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `rfq_id` INT NOT NULL,
  `rfq_item_id` INT NOT NULL,
  `vendor_id` INT NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_assignment` (`rfq_id`,`rfq_item_id`,`vendor_id`),
  KEY `rfq_item_id` (`rfq_item_id`),
  KEY `vendor_id` (`vendor_id`),
  CONSTRAINT `procurement_rfq_vendor_assignments_ibfk_1` FOREIGN KEY (`rfq_id`) REFERENCES `procurement_rfqs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `procurement_rfq_vendor_assignments_ibfk_2` FOREIGN KEY (`rfq_item_id`) REFERENCES `procurement_rfq_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `procurement_rfq_vendor_assignments_ibfk_3` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vendor_invoices` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `po_id` INT NOT NULL,
  `po_number` VARCHAR(100) NOT NULL,
  `po_date` DATE DEFAULT NULL,
  `vendor_id` INT NOT NULL,
  `project_name` VARCHAR(255) DEFAULT NULL,
  `mr_number` VARCHAR(100) DEFAULT NULL,
  `drawing_no` VARCHAR(100) DEFAULT NULL,
  `payment_terms` TEXT,
  `po_pdf_path` VARCHAR(255) DEFAULT NULL,
  `po_amount` DECIMAL(14,2) DEFAULT '0.00',
  `vendor_invoice_no` VARCHAR(100) DEFAULT NULL,
  `invoice_date` DATE DEFAULT NULL,
  `invoice_amount` DECIMAL(14,2) DEFAULT '0.00',
  `gst_amount` DECIMAL(14,2) DEFAULT '0.00',
  `invoice_pdf_path` VARCHAR(255) DEFAULT NULL,
  `status` VARCHAR(50) DEFAULT 'FORWARDED',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `po_id` (`po_id`),
  KEY `vendor_id` (`vendor_id`),
  CONSTRAINT `vendor_invoices_ibfk_1` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `vendor_invoices_ibfk_2` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add missing columns to 'orders' table
ALTER TABLE `orders` 
  ADD COLUMN `sales_order_id` INT NULL DEFAULT NULL,
  ADD COLUMN `shipment_id` INT NULL DEFAULT NULL;

-- Update 'status' ENUM for 'procurement_rfqs'
ALTER TABLE `procurement_rfqs` 
  MODIFY COLUMN `status` ENUM('DRAFT', 'SENT', 'RECEIVED', 'CLOSED', 'PENDING_ITEMS') NULL DEFAULT 'DRAFT';

-- Clean up 'procurement_rfq_items' schema (remove duplicate column)
ALTER TABLE `procurement_rfq_items` 
  DROP COLUMN `vendor_ids`;

-- Add missing indexes
ALTER TABLE `customer_drawings`
  ADD INDEX `idx_cd_drawing_no` (`drawing_no`(50)),
  ADD INDEX `idx_cd_client_name` (`client_name`(100)),
  ADD INDEX `idx_cd_created_at` (`created_at`),
  ADD INDEX `idx_cd_drawing_type` (`drawing_type`),
  ADD INDEX `idx_cd_description` (`description`(255)),
  ADD INDEX `idx_cd_status` (`status`);

ALTER TABLE `quotation_requests`
  ADD INDEX `idx_qr_sales_order_id` (`sales_order_id`),
  ADD INDEX `idx_qr_company_id` (`company_id`),
  ADD INDEX `idx_qr_status` (`status`),
  ADD INDEX `idx_qr_created_at` (`created_at`),
  ADD INDEX `idx_qr_project_name` (`project_name`(100)),
  ADD INDEX `idx_qr_drawing_no` (`drawing_no`(50)),
  ADD INDEX `idx_qr_batch_id` (`batch_id`),
  ADD INDEX `idx_qr_parent_id` (`parent_id`);

ALTER TABLE `sales_order_item_components`
  ADD INDEX `idx_soic_sales_order_item_id` (`sales_order_item_id`),
  ADD INDEX `idx_soic_component_code` (`component_code`);

ALTER TABLE `sales_order_items`
  ADD INDEX `idx_soi_sales_order_id` (`sales_order_id`),
  ADD INDEX `idx_soi_drawing_no` (`drawing_no`),
  ADD INDEX `idx_soi_item_code` (`item_code`),
  ADD INDEX `idx_soi_status` (`status`);
