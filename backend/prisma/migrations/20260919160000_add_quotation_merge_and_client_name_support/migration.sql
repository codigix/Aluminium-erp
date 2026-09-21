-- AlterTable quotations
ALTER TABLE `quotations`
  ADD COLUMN `is_merged` TINYINT(1) DEFAULT 0,
  ADD COLUMN `merged_into_quotation_id` INT NULL,
  ADD COLUMN `project_name` VARCHAR(255) NULL,
  ADD COLUMN `client_name` VARCHAR(255) NULL;

-- ModifyEnum quotations status to include MERGED
ALTER TABLE `quotations`
  MODIFY COLUMN `status` ENUM(
    'DRAFT',
    'SENT',
    'RECEIVED',
    'REVIEWED',
    'CLOSED',
    'PENDING',
    'EMAIL_RECEIVED',
    'SUPERSEDED',
    'REJECTED',
    'MERGED'
  ) DEFAULT 'DRAFT';

-- CreateIndex on quotations(merged_into_quotation_id)
CREATE INDEX `fk_merged_into_quotation` ON `quotations`(`merged_into_quotation_id`);

-- AddForeignKey to quotations
ALTER TABLE `quotations`
  ADD CONSTRAINT `fk_merged_into_quotation` FOREIGN KEY (`merged_into_quotation_id`) REFERENCES `quotations`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AlterTable quotation_items
ALTER TABLE `quotation_items`
  ADD COLUMN `source_quotation_id` INT NULL,
  ADD COLUMN `source_quotation_item_id` INT NULL,
  ADD COLUMN `source_quotation_number` VARCHAR(100) NULL,
  ADD COLUMN `source_rfq_id` INT NULL,
  ADD COLUMN `source_rfq_number` VARCHAR(100) NULL,
  ADD COLUMN `project_name` VARCHAR(255) NULL,
  ADD COLUMN `client_name` VARCHAR(255) NULL;

-- CreateIndex on quotation_items(source_quotation_id)
CREATE INDEX `fk_qi_source_quotation` ON `quotation_items`(`source_quotation_id`);

-- AddForeignKey to quotation_items
ALTER TABLE `quotation_items`
  ADD CONSTRAINT `fk_qi_source_quotation` FOREIGN KEY (`source_quotation_id`) REFERENCES `quotations`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
