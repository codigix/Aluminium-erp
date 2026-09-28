-- AlterTable procurement_rfq_items
ALTER TABLE `procurement_rfq_items`
  ADD COLUMN `required_weight` DECIMAL(14, 3) DEFAULT 0.000 AFTER `quantity`;
