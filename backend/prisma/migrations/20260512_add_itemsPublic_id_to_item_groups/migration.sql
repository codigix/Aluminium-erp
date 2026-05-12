-- AlterTable
ALTER TABLE `item_groups` ADD COLUMN `itemsPublic_id` VARCHAR(100) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `item_groups_itemsPublic_id_key` ON `item_groups`(`itemsPublic_id`);
