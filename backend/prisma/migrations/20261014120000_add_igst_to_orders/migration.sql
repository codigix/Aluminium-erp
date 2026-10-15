-- AlterTable orders
ALTER TABLE `orders`
  ADD COLUMN `igst_rate` DECIMAL(5, 2) NULL DEFAULT 0.00 AFTER `sgst_rate`,
  ADD COLUMN `is_interstate` BOOLEAN NULL DEFAULT false AFTER `igst_rate`;

-- AlterTable sales_orders
ALTER TABLE `sales_orders`
  ADD COLUMN `igst_rate` DECIMAL(5, 2) NULL DEFAULT 0.00 AFTER `sgst_rate`,
  ADD COLUMN `is_interstate` BOOLEAN NULL DEFAULT false AFTER `igst_rate`;
