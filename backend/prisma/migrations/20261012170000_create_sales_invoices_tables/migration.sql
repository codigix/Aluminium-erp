-- CreateTable
CREATE TABLE IF NOT EXISTS `sales_invoices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoice_no` VARCHAR(100) NOT NULL UNIQUE,
    `order_id` INTEGER NOT NULL,
    `sales_order_id` INTEGER NULL,
    `client_id` INTEGER NOT NULL,
    `customer_po_no` VARCHAR(100) NULL,
    `project_name` VARCHAR(255) NULL,
    `invoice_date` DATE NOT NULL,
    `due_date` DATE NULL,
    `billing_address` TEXT NULL,
    `shipping_address` TEXT NULL,
    `gstin` VARCHAR(20) NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'Created',
    `subtotal` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `cgst_rate` DECIMAL(5, 2) NOT NULL DEFAULT 9.00,
    `cgst_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `sgst_rate` DECIMAL(5, 2) NOT NULL DEFAULT 9.00,
    `sgst_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `igst_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `igst_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `total_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `payment_terms` VARCHAR(255) NULL,
    `notes` TEXT NULL,
    `created_by` INTEGER NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    INDEX `idx_sales_invoices_order_id` (`order_id`),
    INDEX `idx_sales_invoices_client_id` (`client_id`),
    INDEX `idx_sales_invoices_date` (`invoice_date`),
    INDEX `idx_sales_invoices_status` (`status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `sales_invoice_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sales_invoice_id` INTEGER NOT NULL,
    `order_item_id` INTEGER NULL,
    `item_code` VARCHAR(100) NULL,
    `drawing_no` VARCHAR(120) NULL,
    `description` TEXT NULL,
    `hsn_code` VARCHAR(50) NULL,
    `uom` VARCHAR(20) NULL DEFAULT 'Nos',
    `ordered_qty` DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    `dispatched_qty` DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    `previously_invoiced_qty` DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    `invoice_qty` DECIMAL(12, 3) NOT NULL,
    `unit_rate` DECIMAL(14, 2) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    INDEX `idx_sales_invoice_items_invoice_id` (`sales_invoice_id`),
    INDEX `idx_sales_invoice_items_item_id` (`order_item_id`),
    CONSTRAINT `sales_invoice_items_invoice_fk` FOREIGN KEY (`sales_invoice_id`) REFERENCES `sales_invoices` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
