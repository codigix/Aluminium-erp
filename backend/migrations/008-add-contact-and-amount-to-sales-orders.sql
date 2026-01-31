ALTER TABLE sales_orders ADD COLUMN contact_email VARCHAR(255) AFTER company_id;
ALTER TABLE sales_orders ADD COLUMN contact_phone VARCHAR(30) AFTER contact_email;
ALTER TABLE sales_order_items ADD COLUMN amount DECIMAL(14, 2) DEFAULT 0 AFTER rate;
