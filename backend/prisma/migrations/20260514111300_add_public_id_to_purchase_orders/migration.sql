-- AlterTable
ALTER TABLE `purchase_orders` ADD COLUMN `public_id` VARCHAR(100) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `public_id` ON `purchase_orders`(`public_id`);
