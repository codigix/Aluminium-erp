-- AlterTable customer_payments
ALTER TABLE `customer_payments` 
    MODIFY COLUMN `sales_order_source` ENUM('SALES_ORDER', 'DIRECT_ORDER', 'SALES_INVOICE') NULL DEFAULT 'SALES_ORDER';
