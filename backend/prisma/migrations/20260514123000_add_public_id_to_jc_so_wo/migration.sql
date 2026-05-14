-- AlterTable
ALTER TABLE `job_cards` ADD COLUMN `public_id` VARCHAR(100) NULL;

-- AlterTable
ALTER TABLE `sales_orders` ADD COLUMN `public_id` VARCHAR(100) NULL;

-- AlterTable
ALTER TABLE `work_orders` ADD COLUMN `public_id` VARCHAR(100) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `public_id` ON `job_cards`(`public_id`);

-- CreateIndex
CREATE UNIQUE INDEX `public_id` ON `sales_orders`(`public_id`);

-- CreateIndex
CREATE UNIQUE INDEX `public_id` ON `work_orders`(`public_id`);
