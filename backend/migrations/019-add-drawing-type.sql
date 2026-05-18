ALTER TABLE customer_drawings ADD COLUMN drawing_type VARCHAR(50) DEFAULT 'Part' AFTER description;
ALTER TABLE sales_order_items ADD COLUMN drawing_type VARCHAR(50) DEFAULT 'Part' AFTER description;
