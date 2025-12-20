-- Add BOM fields to selling_sales_order table
ALTER TABLE selling_sales_order ADD COLUMN IF NOT EXISTS bom_id VARCHAR(50);
ALTER TABLE selling_sales_order ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 1;
ALTER TABLE selling_sales_order ADD COLUMN IF NOT EXISTS source_warehouse VARCHAR(100);
ALTER TABLE selling_sales_order ADD COLUMN IF NOT EXISTS order_type VARCHAR(50) DEFAULT 'Sales';
ALTER TABLE selling_sales_order ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
ALTER TABLE selling_sales_order ADD COLUMN IF NOT EXISTS customer_email VARCHAR(100);
ALTER TABLE selling_sales_order ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20);
ALTER TABLE selling_sales_order ADD COLUMN IF NOT EXISTS series VARCHAR(50);
ALTER TABLE selling_sales_order ADD COLUMN IF NOT EXISTS cost_center VARCHAR(100);
ALTER TABLE selling_sales_order ADD COLUMN IF NOT EXISTS project VARCHAR(100);
ALTER TABLE selling_sales_order ADD COLUMN IF NOT EXISTS bom_details JSON;

CREATE INDEX IF NOT EXISTS idx_bom_id ON selling_sales_order(bom_id);
CREATE INDEX IF NOT EXISTS idx_order_type ON selling_sales_order(order_type);
