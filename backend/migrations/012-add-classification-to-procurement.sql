-- Migration: Add Item Group and Product Type to Procurement Tables
-- Description: Ensures item classification data flows from Quotations to Stock

ALTER TABLE quotation_items ADD COLUMN item_group VARCHAR(100) AFTER material_type;
ALTER TABLE quotation_items ADD COLUMN product_type VARCHAR(100) AFTER item_group;

ALTER TABLE purchase_order_items ADD COLUMN item_group VARCHAR(100) AFTER material_type;
ALTER TABLE purchase_order_items ADD COLUMN product_type VARCHAR(100) AFTER item_group;
