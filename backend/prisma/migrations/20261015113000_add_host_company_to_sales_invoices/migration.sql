-- AlterTable sales_invoices
ALTER TABLE `sales_invoices`
  ADD COLUMN `host_company_id` INTEGER NULL AFTER `client_id`;
