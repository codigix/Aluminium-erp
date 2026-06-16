-- AlterTable
ALTER TABLE `quotation_requests` ADD COLUMN `discount_type` VARCHAR(50) NULL DEFAULT 'percentage', ADD COLUMN `discount_value` DECIMAL(10, 2) NULL DEFAULT 0.00;
