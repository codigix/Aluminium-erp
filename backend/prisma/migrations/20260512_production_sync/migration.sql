-- Add test column to shapes
ALTER TABLE shapes ADD COLUMN IF NOT EXISTS test VARCHAR(255);

-- Add new_column to shapes
ALTER TABLE shapes ADD COLUMN IF NOT EXISTS new_column VARCHAR(255);

-- Create product_types table
CREATE TABLE IF NOT EXISTS product_types (
    id INTEGER NOT NULL AUTO_INCREMENT, 
    name VARCHAR(255) NOT NULL, 
    created_at TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0), 
    UNIQUE INDEX product_types_name_key(name), 
    PRIMARY KEY (id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
