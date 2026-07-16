-- AlterTable
ALTER TABLE `material_request_items` ADD COLUMN `item_source` VARCHAR(20) NULL DEFAULT 'BOM',
    ADD COLUMN `remarks` TEXT NULL;
