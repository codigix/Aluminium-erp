-- Migration: QC Inspection Items Table
-- Description: Creates item-level QC inspection tracking for bidirectional sync with GRN items

CREATE TABLE IF NOT EXISTS qc_inspection_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  qc_inspection_id INT NOT NULL,
  grn_item_id INT NOT NULL,
  item_code VARCHAR(100),
  po_qty DECIMAL(12, 3) NOT NULL,
  received_qty DECIMAL(12, 3) NOT NULL,
  accepted_qty DECIMAL(12, 3) DEFAULT 0,
  rejected_qty DECIMAL(12, 3) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'PENDING' COMMENT 'PENDING, ACCEPTED, REJECTED, SHORTAGE, OVERAGE',
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (qc_inspection_id) REFERENCES qc_inspections(id) ON DELETE CASCADE,
  FOREIGN KEY (grn_item_id) REFERENCES grn_items(id) ON DELETE CASCADE,
  INDEX idx_qc_inspection_id (qc_inspection_id),
  INDEX idx_grn_item_id (grn_item_id),
  INDEX idx_status (status)
);

-- Create index for faster lookups (if not exists handled during table creation)
