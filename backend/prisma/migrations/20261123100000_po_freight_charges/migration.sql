-- Purchase Order: Loading / Forwarding / Transport charges (entered on the PO form above Discount Type).
-- Taxed with the goods: Taxable = Subtotal - Discount + Charges, then CGST/SGST. Printed on the PO PDF.
-- Additive with default 0, so existing POs and their totals are unchanged. Safe to run more than once.
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'freight_charges'
);
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE `purchase_orders` ADD COLUMN `freight_charges` DECIMAL(14, 2) NULL DEFAULT 0.00',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
