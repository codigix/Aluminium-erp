-- Customer Master (Sales): one customer with many contact persons.
-- One GST number per customer (unique; customers without a GSTIN keep it NULL).

-- CreateTable
CREATE TABLE IF NOT EXISTS `customers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customer_name` VARCHAR(255) NOT NULL,
    `gst_no` VARCHAR(20) NULL,
    `address` TEXT NOT NULL,
    `pincode` VARCHAR(10) NOT NULL,
    `email` VARCHAR(150) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `created_by` INTEGER NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE INDEX `uq_customers_gst_no` (`gst_no`),
    INDEX `idx_customers_name` (`customer_name`),
    INDEX `idx_customers_status` (`status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `customer_contacts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customer_id` INTEGER NOT NULL,
    `contact_name` VARCHAR(150) NOT NULL,
    `mobile` VARCHAR(20) NULL,
    `email` VARCHAR(150) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    INDEX `idx_customer_contacts_customer` (`customer_id`),
    INDEX `idx_customer_contacts_name` (`contact_name`),
    CONSTRAINT `customer_contacts_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
