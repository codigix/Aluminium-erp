-- CreateTable
CREATE TABLE IF NOT EXISTS `debit_notes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `voucher_no` VARCHAR(50) NOT NULL,
    `voucher_date` DATE NOT NULL,
    `vendor_id` INTEGER NOT NULL,
    `vendor_invoice_id` INTEGER NULL,
    `po_id` INTEGER NULL,
    `reference_invoice_no` VARCHAR(100) NULL,
    `reason` VARCHAR(50) NOT NULL DEFAULT 'PURCHASE_RETURN',
    `entry_mode` VARCHAR(20) NOT NULL DEFAULT 'ITEM',
    `affected_ledger` VARCHAR(255) NOT NULL DEFAULT 'Purchase Returns',
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
    UNIQUE INDEX `uq_debit_note_voucher_no` (`voucher_no`),
    INDEX `idx_dn_vendor` (`vendor_id`),
    INDEX `idx_dn_invoice` (`vendor_invoice_id`),
    INDEX `idx_dn_po` (`po_id`),
    INDEX `idx_dn_date` (`voucher_date`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `debit_note_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `debit_note_id` INTEGER NOT NULL,
    `po_item_id` INTEGER NULL,
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
    INDEX `idx_dni_note` (`debit_note_id`),
    INDEX `idx_dni_po_item` (`po_item_id`),
    CONSTRAINT `debit_note_items_dn_fk` FOREIGN KEY (`debit_note_id`) REFERENCES `debit_notes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
