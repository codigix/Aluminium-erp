-- Create Rejection table for tracking production rejections
CREATE TABLE IF NOT EXISTS rejection (
  rejection_id VARCHAR(50) PRIMARY KEY,
  production_entry_id VARCHAR(50) NOT NULL,
  rejection_reason VARCHAR(255) NOT NULL,
  rejection_count DECIMAL(18,6) NOT NULL,
  root_cause VARCHAR(500),
  corrective_action VARCHAR(500),
  reported_by_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_production_entry_id (production_entry_id),
  INDEX idx_rejection_reason (rejection_reason),
  INDEX idx_created_at (created_at)
);
