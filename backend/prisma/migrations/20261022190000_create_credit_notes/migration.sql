-- CreateTable
CREATE TABLE IF NOT EXISTS `credit_notes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `voucher_no` VARCHAR(50) NOT NULL,
    `voucher_date` DATE NOT NULL,
    `customer_id` INTEGER NOT NULL,
    `sales_invoice_id` INTEGER NULL,
    `reference_invoice_no` VARCHAR(100) NULL,
    `reason` VARCHAR(50) NOT NULL DEFAULT 'SALES_RETURN',
    `entry_mode` VARCHAR(20) NOT NULL DEFAULT 'ITEM',
    `affected_ledger` VARCHAR(255) NOT NULL DEFAULT 'Sales Returns',
    `gst_type` VARCHAR(20) NOT NULL DEFAULT 'INTRA',
    `taxable_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `cgst_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `sgst_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `igst_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `total_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `narration` TEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'POSTED',
    `cancelled_at` TIMESTAMP NULL,
    `created_by` INTEGER NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE INDEX `uq_credit_note_voucher_no` (`voucher_no`),
    INDEX `idx_cn_customer` (`customer_id`),
    INDEX `idx_cn_invoice` (`sales_invoice_id`),
    INDEX `idx_cn_date` (`voucher_date`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `credit_note_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `credit_note_id` INTEGER NOT NULL,
    `sales_invoice_item_id` INTEGER NULL,
    `drawing_no` VARCHAR(120) NULL,
    `item_code` VARCHAR(120) NULL,
    `description` VARCHAR(500) NULL,
    `quantity` DECIMAL(14, 3) NOT NULL DEFAULT 0.000,
    `unit` VARCHAR(20) NULL,
    `rate` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `gst_percent` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `taxable_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `gst_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `total_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    INDEX `idx_cni_note` (`credit_note_id`),
    INDEX `idx_cni_invoice_item` (`sales_invoice_item_id`),
    CONSTRAINT `credit_note_items_cn_fk` FOREIGN KEY (`credit_note_id`) REFERENCES `credit_notes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
