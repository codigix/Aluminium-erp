-- CreateTable
CREATE TABLE IF NOT EXISTS `bulk_design_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `request_no` VARCHAR(100) NOT NULL,
    `sent_by` VARCHAR(255) NOT NULL,
    `sent_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `total_requirements` INTEGER NULL DEFAULT 0,
    `total_drawings` INTEGER NULL DEFAULT 0,
    `status` VARCHAR(50) NULL DEFAULT 'Pending Design',

    UNIQUE INDEX `request_no`(`request_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `bulk_design_request_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bulk_request_id` INTEGER NOT NULL,
    `sales_order_id` INTEGER NOT NULL,
    `drawing_count` INTEGER NULL DEFAULT 0,

    INDEX `bulk_request_id`(`bulk_request_id`),
    INDEX `sales_order_id`(`sales_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bulk_design_request_items` ADD CONSTRAINT `bulk_design_request_items_ibfk_1` FOREIGN KEY (`bulk_request_id`) REFERENCES `bulk_design_requests`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `bulk_design_request_items` ADD CONSTRAINT `bulk_design_request_items_ibfk_2` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
