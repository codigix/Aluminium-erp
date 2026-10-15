-- Migration 029: Add branch_name, opening_balance and broaden account_type for bank_accounts

ALTER TABLE `bank_accounts` 
  ADD COLUMN IF NOT EXISTS `branch_name` VARCHAR(255) NULL AFTER `ifsc_code`,
  ADD COLUMN IF NOT EXISTS `opening_balance` DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER `account_type`,
  MODIFY COLUMN `account_type` VARCHAR(50) NOT NULL DEFAULT 'CURRENT';
