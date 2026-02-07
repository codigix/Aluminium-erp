USE sales_erp;

CREATE TABLE IF NOT EXISTS po_receipts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  po_number VARCHAR(100),
  receipt_date DATE,
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS po_receipt_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  receipt_id INT NOT NULL,
  po_item_id INT NOT NULL,
  received_quantity DECIMAL(12, 3) DEFAULT 0,
  FOREIGN KEY (receipt_id) REFERENCES po_receipts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS grn_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grn_id INT NOT NULL,
  po_item_id INT NOT NULL,
  po_qty DECIMAL(12, 3) DEFAULT 0,
  received_qty DECIMAL(12, 3) DEFAULT 0,
  accepted_qty DECIMAL(12, 3) DEFAULT 0,
  rejected_qty DECIMAL(12, 3) DEFAULT 0,
  shortage_qty DECIMAL(12, 3) DEFAULT 0,
  overage_qty DECIMAL(12, 3) DEFAULT 0,
  status VARCHAR(50),
  remarks TEXT,
  is_approved TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (grn_id) REFERENCES grns(id) ON DELETE CASCADE
);
