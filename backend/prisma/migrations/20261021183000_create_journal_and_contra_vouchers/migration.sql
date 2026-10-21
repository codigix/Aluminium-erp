-- CreateTable
CREATE TABLE IF NOT EXISTS `journal_vouchers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `voucher_no` VARCHAR(100) NOT NULL UNIQUE,
    `voucher_date` DATE NOT NULL,
    `reference_no` VARCHAR(255) NULL,
    `total_debit` DECIMAL(14, 2) NOT NULL,
    `total_credit` DECIMAL(14, 2) NOT NULL,
    `narration` TEXT NOT NULL,
    `created_by` INTEGER NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    INDEX `idx_jv_date` (`voucher_date`),
    INDEX `idx_jv_no` (`voucher_no`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `journal_voucher_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `journal_voucher_id` INTEGER NOT NULL,
    `ledger_account` VARCHAR(255) NOT NULL,
    `debit_amount` DECIMAL(14, 2) NULL DEFAULT 0.00,
    `credit_amount` DECIMAL(14, 2) NULL DEFAULT 0.00,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    INDEX `idx_jvi_voucher` (`journal_voucher_id`),
    CONSTRAINT `journal_voucher_items_jv_fk` FOREIGN KEY (`journal_voucher_id`) REFERENCES `journal_vouchers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `contra_vouchers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `voucher_no` VARCHAR(50) NOT NULL UNIQUE,
    `voucher_date` DATE NOT NULL,
    `from_account` VARCHAR(255) NOT NULL,
    `from_bank_account_id` INTEGER NULL,
    `to_account` VARCHAR(255) NOT NULL,
    `to_bank_account_id` INTEGER NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `reference_no` VARCHAR(100) NULL,
    `narration` TEXT NULL,
    `created_by` INTEGER NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    INDEX `idx_contra_voucher_date` (`voucher_date`),
    INDEX `idx_contra_voucher_no` (`voucher_no`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
