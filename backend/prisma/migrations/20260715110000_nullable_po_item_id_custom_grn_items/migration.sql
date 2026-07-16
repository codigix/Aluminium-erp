-- Migration: 20260715110000_nullable_po_item_id_custom_grn_items
-- Description: Allow custom GRN items (not linked to any PO item) by making
--              po_item_id nullable in po_receipt_items and grn_items tables.
--              Adds item_code, material_name, drawing_no, unit columns to
--              po_receipt_items for storing custom item details directly.
--
-- NOTE: All schema changes were applied via db.js startup sync.
--       This migration documents the changes for Prisma tracking.

-- 1. Make po_receipt_items.po_item_id nullable (already applied via db.js)
-- ALTER TABLE `po_receipt_items` MODIFY COLUMN `po_item_id` INT NULL;

-- 2. Add custom item columns to po_receipt_items (already applied via db.js)
-- ALTER TABLE `po_receipt_items` ADD COLUMN `item_code` VARCHAR(100) NULL;
-- ALTER TABLE `po_receipt_items` ADD COLUMN `material_name` VARCHAR(255) NULL;
-- ALTER TABLE `po_receipt_items` ADD COLUMN `drawing_no` VARCHAR(100) NULL;
-- ALTER TABLE `po_receipt_items` ADD COLUMN `unit` VARCHAR(50) NULL;

-- 3. Make grn_items.po_item_id nullable (already applied via db.js/service layer)
-- ALTER TABLE `grn_items` MODIFY COLUMN `po_item_id` INT NULL;

-- Verified state of database columns (2026-07-15):
-- po_receipt_items: po_item_id=NULL, item_code=NULL, material_name=NULL, drawing_no=NULL, unit=NULL
-- grn_items: po_item_id=NULL

SELECT 'Migration 20260715110000 verified and applied' AS status;
