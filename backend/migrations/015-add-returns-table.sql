CREATE TABLE IF NOT EXISTS shipment_returns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  return_code VARCHAR(50) NOT NULL UNIQUE,
  shipment_id INT NOT NULL,
  order_id INT NULL,
  customer_id INT NULL,
  reason TEXT NOT NULL,
  status ENUM('RETURN_INITIATED', 'RETURN_PICKUP_ASSIGNED', 'RETURN_IN_TRANSIT', 'RETURN_RECEIVED', 'RETURN_COMPLETED') DEFAULT 'RETURN_INITIATED',
  pickup_date DATE NULL,
  received_date DATE NULL,
  condition_status ENUM('GOOD', 'DAMAGED', 'WRONG_ITEM', 'CANCELLED') NULL,
  refund_amount DECIMAL(15, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (shipment_id) REFERENCES shipment_orders(id) ON DELETE CASCADE
);

-- Add item-level return details if needed later
CREATE TABLE IF NOT EXISTS shipment_return_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  return_id INT NOT NULL,
  item_code VARCHAR(100) NOT NULL,
  quantity DECIMAL(15, 3) NOT NULL,
  condition_note TEXT,
  FOREIGN KEY (return_id) REFERENCES shipment_returns(id) ON DELETE CASCADE
);

-- Update shipment_orders status to include return-related statuses if not already there
-- Assuming statuses are handled in application logic or ENUM in shipment_orders
