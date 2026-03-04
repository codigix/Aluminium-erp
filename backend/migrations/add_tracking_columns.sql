ALTER TABLE shipment_orders
ADD COLUMN current_lat DECIMAL(10, 8) NULL,
ADD COLUMN current_lng DECIMAL(11, 8) NULL,
ADD COLUMN last_location_update TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS shipment_tracking_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shipment_id INT NOT NULL,
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  speed VARCHAR(50),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shipment_id) REFERENCES shipment_orders(id) ON DELETE CASCADE
);
