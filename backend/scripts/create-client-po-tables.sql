-- Client PO Wizard Tables
-- Run this script to create all required tables for Client PO module

-- 1. Main Client PO Table
CREATE TABLE IF NOT EXISTS client_pos (
  po_id VARCHAR(50) PRIMARY KEY,
  client_id VARCHAR(255) NOT NULL,
  po_number VARCHAR(100) UNIQUE NOT NULL,
  po_date DATE NOT NULL,
  contact_person VARCHAR(255),
  email_reference VARCHAR(255),
  po_status ENUM('draft', 'pending_approval', 'approved', 'rejected', 'cancelled') DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100),
  INDEX idx_client_id (client_id),
  INDEX idx_po_number (po_number),
  INDEX idx_po_status (po_status),
  INDEX idx_po_date (po_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Client PO Projects Table
CREATE TABLE IF NOT EXISTS client_po_projects (
  project_id VARCHAR(50) PRIMARY KEY,
  po_id VARCHAR(50) NOT NULL,
  project_name VARCHAR(255) NOT NULL,
  project_requirement TEXT,
  project_code VARCHAR(100),
  project_type VARCHAR(100),
  sales_engineer VARCHAR(255),
  delivery_start_date DATE,
  delivery_end_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (po_id) REFERENCES client_pos(po_id) ON DELETE CASCADE,
  INDEX idx_po_id (po_id),
  INDEX idx_project_code (project_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Client PO Drawings Table
CREATE TABLE IF NOT EXISTS client_po_drawings (
  drawing_id VARCHAR(50) PRIMARY KEY,
  po_id VARCHAR(50) NOT NULL,
  drawing_no VARCHAR(255) NOT NULL,
  revision VARCHAR(255),
  description VARCHAR(1000),
  quantity DECIMAL(18,6) NOT NULL DEFAULT 1,
  unit VARCHAR(50) DEFAULT 'NOS',
  unit_rate DECIMAL(15,2) DEFAULT 0,
  line_value DECIMAL(15,2) DEFAULT 0,
  delivery_date DATE,
  file_path VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (po_id) REFERENCES client_pos(po_id) ON DELETE CASCADE,
  UNIQUE KEY unique_drawing (po_id, drawing_no, revision),
  INDEX idx_po_id (po_id),
  INDEX idx_drawing_no (drawing_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Client PO Commercials Table
CREATE TABLE IF NOT EXISTS client_po_commercials (
  commercial_id VARCHAR(50) PRIMARY KEY,
  po_id VARCHAR(50) NOT NULL UNIQUE,
  rate DECIMAL(15,2),
  currency VARCHAR(10) DEFAULT 'INR',
  payment_terms VARCHAR(1000),
  tax_rate DECIMAL(5,2),
  freight_charges DECIMAL(15,2),
  total_value DECIMAL(18,2),
  subtotal DECIMAL(18,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (po_id) REFERENCES client_pos(po_id) ON DELETE CASCADE,
  INDEX idx_po_id (po_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Client PO Files/Attachments Table
CREATE TABLE IF NOT EXISTS client_po_files (
  file_id VARCHAR(50) PRIMARY KEY,
  po_id VARCHAR(50) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50),
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT,
  file_category ENUM('po_document', 'drawing', 'quality_document', 'packaging_instruction', 'specification') DEFAULT 'po_document',
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  uploaded_by VARCHAR(100),
  FOREIGN KEY (po_id) REFERENCES client_pos(po_id) ON DELETE CASCADE,
  INDEX idx_po_id (po_id),
  INDEX idx_file_category (file_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Client PO Step Status Tracking Table
CREATE TABLE IF NOT EXISTS client_po_step_status (
  status_id VARCHAR(50) PRIMARY KEY,
  po_id VARCHAR(50) NOT NULL UNIQUE,
  client_info_completed BOOLEAN DEFAULT FALSE,
  project_info_completed BOOLEAN DEFAULT FALSE,
  drawings_completed BOOLEAN DEFAULT FALSE,
  commercials_completed BOOLEAN DEFAULT FALSE,
  attachments_completed BOOLEAN DEFAULT FALSE,
  final_submitted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (po_id) REFERENCES client_pos(po_id) ON DELETE CASCADE,
  INDEX idx_po_id (po_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Client PO Terms & Conditions Table
CREATE TABLE IF NOT EXISTS client_po_terms (
  term_id VARCHAR(50) PRIMARY KEY,
  po_id VARCHAR(50) NOT NULL UNIQUE,
  payment_terms_description VARCHAR(2000),
  delivery_schedule VARCHAR(2000),
  packing_instructions VARCHAR(2000),
  special_remarks VARCHAR(2000),
  quality_standards VARCHAR(2000),
  warranty_terms VARCHAR(2000),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (po_id) REFERENCES client_pos(po_id) ON DELETE CASCADE,
  INDEX idx_po_id (po_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create indexes for better query performance
CREATE INDEX idx_client_pos_po_date ON client_pos(po_date DESC);
CREATE INDEX idx_client_pos_created_at ON client_pos(created_at DESC);
CREATE INDEX idx_client_po_projects_po_id ON client_po_projects(po_id);
CREATE INDEX idx_client_po_drawings_po_id ON client_po_drawings(po_id);
CREATE INDEX idx_client_po_files_po_id ON client_po_files(po_id);

-- Add triggers for automatic updated_at timestamp
DELIMITER //

CREATE TRIGGER client_pos_update_timestamp
BEFORE UPDATE ON client_pos
FOR EACH ROW
SET NEW.updated_at = CURRENT_TIMESTAMP //

CREATE TRIGGER client_po_projects_update_timestamp
BEFORE UPDATE ON client_po_projects
FOR EACH ROW
SET NEW.updated_at = CURRENT_TIMESTAMP //

CREATE TRIGGER client_po_drawings_update_timestamp
BEFORE UPDATE ON client_po_drawings
FOR EACH ROW
SET NEW.updated_at = CURRENT_TIMESTAMP //

CREATE TRIGGER client_po_commercials_update_timestamp
BEFORE UPDATE ON client_po_commercials
FOR EACH ROW
SET NEW.updated_at = CURRENT_TIMESTAMP //

CREATE TRIGGER client_po_step_status_update_timestamp
BEFORE UPDATE ON client_po_step_status
FOR EACH ROW
SET NEW.updated_at = CURRENT_TIMESTAMP //

CREATE TRIGGER client_po_terms_update_timestamp
BEFORE UPDATE ON client_po_terms
FOR EACH ROW
SET NEW.updated_at = CURRENT_TIMESTAMP //

DELIMITER ;
