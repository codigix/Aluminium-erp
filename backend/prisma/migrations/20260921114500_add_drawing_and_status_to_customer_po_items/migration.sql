-- AlterTable customer_po_items
-- Add drawing_id, status, design_status columns
ALTER TABLE `customer_po_items`
  ADD COLUMN `drawing_id` INT NULL,
  ADD COLUMN `status` VARCHAR(50) DEFAULT 'ACTIVE',
  ADD COLUMN `design_status` VARCHAR(50) NULL;

-- CreateIndex on customer_po_items(drawing_id)
CREATE INDEX `idx_cpi_drawing_id` ON `customer_po_items`(`drawing_id`);

-- AddForeignKey to customer_po_items
ALTER TABLE `customer_po_items`
  ADD CONSTRAINT `customer_po_items_ibfk_drawing` FOREIGN KEY (`drawing_id`) REFERENCES `customer_drawings`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
