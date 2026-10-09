-- AlterTable
ALTER TABLE `purchase_orders`
    ADD COLUMN `po_type` VARCHAR(30) NOT NULL DEFAULT 'DRAWING',
    ADD COLUMN `company_id` INT NULL;
