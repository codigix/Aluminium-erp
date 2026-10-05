-- Add hsn_code to items table if not exists
ALTER TABLE `items` ADD COLUMN IF NOT EXISTS `hsn_code` VARCHAR(50) NULL AFTER `item_group`;

-- Add hsn_code to quotation_requests table if not exists
ALTER TABLE `quotation_requests` ADD COLUMN IF NOT EXISTS `hsn_code` VARCHAR(50) NULL AFTER `item_group`;
