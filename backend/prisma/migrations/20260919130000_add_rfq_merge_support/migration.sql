-- AlterTable procurement_rfqs
ALTER TABLE `procurement_rfqs`
  ADD COLUMN `is_merged` TINYINT(1) DEFAULT 0,
  ADD COLUMN `merged_into_rfq_id` INT NULL;

-- CreateIndex
CREATE INDEX `fk_merged_into_rfq` ON `procurement_rfqs`(`merged_into_rfq_id`);

-- AddForeignKey
ALTER TABLE `procurement_rfqs`
  ADD CONSTRAINT `fk_merged_into_rfq` FOREIGN KEY (`merged_into_rfq_id`) REFERENCES `procurement_rfqs`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AlterTable procurement_rfq_items
ALTER TABLE `procurement_rfq_items`
  ADD COLUMN `source_rfq_id` INT NULL,
  ADD COLUMN `source_rfq_item_id` INT NULL,
  ADD COLUMN `source_rfq_number` VARCHAR(50) NULL,
  ADD COLUMN `project_name` VARCHAR(255) NULL;
