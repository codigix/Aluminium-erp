-- AlterTable items
ALTER TABLE `items` ADD COLUMN `hsn_code` VARCHAR(50) NULL AFTER `item_group`;

-- AlterTable quotation_requests
ALTER TABLE `quotation_requests` ADD COLUMN `hsn_code` VARCHAR(50) NULL AFTER `item_group`;
