ALTER TABLE material_request_items 
ADD COLUMN item_source VARCHAR(20) DEFAULT 'BOM',
ADD COLUMN remarks TEXT NULL;
