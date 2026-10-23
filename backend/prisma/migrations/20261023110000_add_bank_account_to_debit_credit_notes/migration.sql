-- AlterTable: company bank account the debit note amount relates to
ALTER TABLE `debit_notes` ADD COLUMN `bank_account_id` INTEGER NULL AFTER `po_id`;
CREATE INDEX `idx_dn_bank_account` ON `debit_notes` (`bank_account_id`);

-- AlterTable: company bank account the credit note amount relates to
ALTER TABLE `credit_notes` ADD COLUMN `bank_account_id` INTEGER NULL AFTER `sales_invoice_id`;
CREATE INDEX `idx_cn_bank_account` ON `credit_notes` (`bank_account_id`);
