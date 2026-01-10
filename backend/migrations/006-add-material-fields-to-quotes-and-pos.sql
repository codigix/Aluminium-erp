ALTER TABLE quotation_items ADD COLUMN material_name VARCHAR(255) AFTER description;
ALTER TABLE quotation_items ADD COLUMN material_type VARCHAR(100) AFTER material_name;

ALTER TABLE purchase_order_items ADD COLUMN material_name VARCHAR(255) AFTER description;
ALTER TABLE purchase_order_items ADD COLUMN material_type VARCHAR(100) AFTER material_name;
