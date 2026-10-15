-- AlterTable customer_drawings
ALTER TABLE `customer_drawings` MODIFY `file_path` TEXT NOT NULL;

-- AlterTable sales_order_items
ALTER TABLE `sales_order_items` MODIFY `drawing_pdf` TEXT NULL;

-- AlterTable order_items
ALTER TABLE `order_items` MODIFY `drawing_pdf` TEXT NULL;
