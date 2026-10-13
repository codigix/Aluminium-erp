-- AlterTable sales_invoices
ALTER TABLE `sales_invoices` 
  ADD COLUMN `sent_to_accounts` TINYINT(1) NOT NULL DEFAULT 0 AFTER `status`,
  ADD COLUMN `sent_to_accounts_at` DATETIME NULL AFTER `sent_to_accounts`;
