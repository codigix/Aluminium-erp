ALTER TABLE client_pos MODIFY COLUMN po_status ENUM('draft', 'pending_approval', 'approved', 'rejected', 'cancelled', 'confirmed') DEFAULT 'draft';
