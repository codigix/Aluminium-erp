-- Migration: GRN Item-wise Logic with Shortage, Overage, and Rejection Handling
-- Description: Creates comprehensive GRN item tracking with inventory posting

-- 1. Create GRN Items table
CREATE TABLE IF NOT EXISTS grn_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  grn_id INT NOT NULL,
  po_item_id INT NOT NULL,
  po_qty INT NOT NULL,
  received_qty INT NOT NULL,
  accepted_qty INT NOT NULL,
  rejected_qty INT NOT NULL,
  shortage_qty INT DEFAULT 0,
  overage_qty INT DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'RECEIVED',
  remarks TEXT,
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (grn_id) REFERENCES grns(id) ON DELETE CASCADE,
  FOREIGN KEY (po_item_id) REFERENCES purchase_order_items(id) ON DELETE RESTRICT,
  INDEX idx_grn_id (grn_id),
  INDEX idx_po_item_id (po_item_id),
  INDEX idx_status (status)
);

-- 2. Create GRN Excess Approvals table
CREATE TABLE IF NOT EXISTS grn_excess_approvals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  grn_item_id INT NOT NULL,
  excess_qty INT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  approval_notes TEXT,
  rejection_reason TEXT,
  approved_at TIMESTAMP NULL,
  rejected_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (grn_item_id) REFERENCES grn_items(id) ON DELETE CASCADE,
  INDEX idx_grn_item_id (grn_item_id),
  INDEX idx_status (status)
);

-- 3. Create Inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_code VARCHAR(100) UNIQUE NOT NULL,
  description VARCHAR(255),
  unit VARCHAR(50),
  category_id INT,
  stock_on_hand INT DEFAULT 0,
  reorder_level INT DEFAULT 0,
  reorder_qty INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_item_code (item_code),
  INDEX idx_stock (stock_on_hand)
);

-- 4. Create Inventory Postings table
CREATE TABLE IF NOT EXISTS inventory_postings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  inventory_id INT NOT NULL,
  posting_type VARCHAR(50) NOT NULL,
  quantity INT NOT NULL,
  reference_type VARCHAR(50),
  reference_id INT,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
  INDEX idx_inventory_id (inventory_id),
  INDEX idx_posting_type (posting_type),
  INDEX idx_reference (reference_type, reference_id),
  INDEX idx_created_at (created_at)
);

-- 5. Create Inventory Dashboard table
CREATE TABLE IF NOT EXISTS inventory_dashboard (
  id INT PRIMARY KEY AUTO_INCREMENT,
  total_stock_on_hand INT DEFAULT 0,
  today_inward_qty INT DEFAULT 0,
  grn_count INT DEFAULT 0,
  pending_po_qty INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 6. Add status column to purchase_order_items if not exists
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_NAME = 'purchase_order_items' AND COLUMN_NAME = 'status' AND TABLE_SCHEMA = DATABASE());

SET @sql := IF(@exists > 0, 'SELECT 1', 'ALTER TABLE purchase_order_items ADD COLUMN status VARCHAR(50) DEFAULT "OPEN"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 7. Create Index on grns for po_number
ALTER TABLE grns ADD INDEX idx_po_number_grn (po_number);

-- 8. Insert initial inventory dashboard record
INSERT IGNORE INTO inventory_dashboard (id, total_stock_on_hand, today_inward_qty, grn_count, pending_po_qty) 
VALUES (1, 0, 0, 0, 0);

-- 9. Create useful indexes
CREATE INDEX idx_grn_items_status ON grn_items(status);
CREATE INDEX idx_grn_excess_status ON grn_excess_approvals(status);
CREATE INDEX idx_inventory_postings_type ON inventory_postings(posting_type);
