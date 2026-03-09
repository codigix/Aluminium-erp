-- Create procurement_rfqs table
CREATE TABLE IF NOT EXISTS procurement_rfqs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rfq_number VARCHAR(50) UNIQUE NOT NULL,
    mr_id INT,
    requested_by INT,
    status ENUM('DRAFT', 'SENT', 'RECEIVED', 'CLOSED') DEFAULT 'DRAFT',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (mr_id) REFERENCES material_requests(id) ON DELETE SET NULL,
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create procurement_rfq_items table
CREATE TABLE IF NOT EXISTS procurement_rfq_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rfq_id INT,
    item_code VARCHAR(50),
    description TEXT,
    material_name VARCHAR(255),
    material_type VARCHAR(100),
    drawing_no VARCHAR(100),
    quantity DECIMAL(14,2),
    uom VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rfq_id) REFERENCES procurement_rfqs(id) ON DELETE CASCADE
);

-- Add rfq_id to quotations table
ALTER TABLE quotations ADD COLUMN rfq_id INT;
ALTER TABLE quotations ADD FOREIGN KEY (rfq_id) REFERENCES procurement_rfqs(id) ON DELETE SET NULL;
