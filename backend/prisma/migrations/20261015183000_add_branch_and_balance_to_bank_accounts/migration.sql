-- AlterTable bank_accounts
ALTER TABLE `bank_accounts` 
    ADD COLUMN `branch_name` VARCHAR(255) NULL AFTER `ifsc_code`,
    ADD COLUMN `opening_balance` DECIMAL(15, 2) NOT NULL DEFAULT 0.00 AFTER `account_type`,
    MODIFY `account_type` VARCHAR(50) NOT NULL DEFAULT 'CURRENT';
