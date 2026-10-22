-- CreateTable
CREATE TABLE IF NOT EXISTS `customer_payment_allocations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customer_payment_id` INTEGER NOT NULL,
    `receipt_no` VARCHAR(100) NOT NULL,
    `customer_id` INTEGER NOT NULL,
    `invoice_id` INTEGER NULL,
    `sales_order_id` INTEGER NULL,
    `sales_order_source` VARCHAR(50) NULL DEFAULT 'SALES_INVOICE',
    `allocation_type` VARCHAR(50) NULL DEFAULT 'Agst Ref',
    `reference_no` VARCHAR(100) NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    INDEX `idx_cpa_pmt_id` (`customer_payment_id`),
    INDEX `idx_cpa_receipt_no` (`receipt_no`),
    INDEX `idx_cpa_invoice_id` (`invoice_id`),
    INDEX `idx_cpa_so_id` (`sales_order_id`),
    INDEX `idx_cpa_cust_id` (`customer_id`),
    CONSTRAINT `customer_payment_allocations_payment_fk` FOREIGN KEY (`customer_payment_id`) REFERENCES `customer_payments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `payment_allocations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `payment_id` INTEGER NOT NULL,
    `voucher_no` VARCHAR(100) NOT NULL,
    `vendor_id` INTEGER NOT NULL,
    `po_id` INTEGER NULL,
    `invoice_id` INTEGER NULL,
    `allocation_type` VARCHAR(50) NULL DEFAULT 'Agst Ref',
    `reference_no` VARCHAR(100) NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    INDEX `idx_payment_id` (`payment_id`),
    INDEX `idx_voucher_no` (`voucher_no`),
    INDEX `idx_po_id` (`po_id`),
    INDEX `idx_vendor_id` (`vendor_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
