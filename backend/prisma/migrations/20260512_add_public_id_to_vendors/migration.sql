-- AlterTable
ALTER TABLE `vendors` ADD COLUMN `public_id` VARCHAR(100) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `vendors_public_id_key` ON `vendors`(`public_id`);
