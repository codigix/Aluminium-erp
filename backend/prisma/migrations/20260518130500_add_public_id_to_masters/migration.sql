-- AlterTable
ALTER TABLE `customer_drawings` ADD COLUMN `drawing_type` VARCHAR(50) NULL DEFAULT 'Part',
    ADD COLUMN `public_id` VARCHAR(100) NULL;

-- AlterTable
ALTER TABLE `items` ADD COLUMN `public_id` VARCHAR(100) NULL;

-- AlterTable
ALTER TABLE `po_receipts` ADD COLUMN `public_id` VARCHAR(100) NULL;

-- AlterTable
ALTER TABLE `production_plans` ADD COLUMN `public_id` VARCHAR(100) NULL;

-- AlterTable
ALTER TABLE `quotation_requests` ADD COLUMN `public_id` VARCHAR(100) NULL;

-- AlterTable
ALTER TABLE `sales_order_items` ADD COLUMN `drawing_type` VARCHAR(50) NULL DEFAULT 'Part';

-- CreateIndex
CREATE UNIQUE INDEX `public_id` ON `customer_drawings`(`public_id`);

-- CreateIndex
CREATE UNIQUE INDEX `public_id` ON `items`(`public_id`);

-- CreateIndex
CREATE UNIQUE INDEX `public_id` ON `po_receipts`(`public_id`);

-- CreateIndex
CREATE UNIQUE INDEX `public_id` ON `production_plans`(`public_id`);

-- CreateIndex
CREATE UNIQUE INDEX `public_id` ON `quotation_requests`(`public_id`);
