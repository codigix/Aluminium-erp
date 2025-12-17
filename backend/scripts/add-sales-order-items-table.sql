-- Create sales_order_items table for managing line items in sales orders
CREATE TABLE IF NOT EXISTS sales_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sales_order_id VARCHAR(50) NOT NULL,
  item_code VARCHAR(100),
  item_name VARCHAR(255),
  delivery_date DATE,
  qty DECIMAL(10, 2) NOT NULL DEFAULT 1,
  rate DECIMAL(15, 2) NOT NULL DEFAULT 0,
  amount DECIMAL(15, 2) GENERATED ALWAYS AS (qty * rate) STORED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (sales_order_id) REFERENCES selling_sales_order(sales_order_id) ON DELETE CASCADE,
  INDEX idx_sales_order (sales_order_id),
  INDEX idx_item_code (item_code)
);
