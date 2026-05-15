-- AlterTable
ALTER TABLE `orders` ADD COLUMN `public_id` VARCHAR(100) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `public_id` ON `orders`(`public_id`);
