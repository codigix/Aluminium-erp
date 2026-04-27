USE sales_erp;

-- Master BOM table
CREATE TABLE IF NOT EXISTS bom (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_code VARCHAR(120),
    drawing_no VARCHAR(120),
    description TEXT,
    uom VARCHAR(20),
    item_group VARCHAR(100),
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_item_code (item_code),
    INDEX idx_drawing_no (drawing_no)
);

-- BOM items (components/materials)
CREATE TABLE IF NOT EXISTS bom_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bom_id INT NOT NULL,
    component_code VARCHAR(120) NOT NULL,
    quantity DECIMAL(12, 4) NOT NULL DEFAULT 0,
    uom VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bom_id) REFERENCES bom(id) ON DELETE CASCADE,
    INDEX idx_bom_id (bom_id),
    INDEX idx_component_code (component_code)
);

-- Create items table if it doesn't exist (referenced in bomService.js)
-- Note: This might be redundant with stock_balance but is needed for the legacy query in bomService.js
CREATE TABLE IF NOT EXISTS items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_code VARCHAR(120) UNIQUE NOT NULL,
    description TEXT,
    uom VARCHAR(20),
    item_group VARCHAR(100),
    valuation_rate DECIMAL(12, 2) DEFAULT 0,
    selling_rate DECIMAL(12, 2) DEFAULT 0,
    weight_per_unit DECIMAL(12, 3) DEFAULT 0,
    length DECIMAL(12, 2) DEFAULT 0,
    width DECIMAL(12, 2) DEFAULT 0,
    thickness DECIMAL(12, 2) DEFAULT 0,
    diameter DECIMAL(12, 2) DEFAULT 0,
    outer_diameter DECIMAL(12, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
