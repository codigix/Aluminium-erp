ALTER TABLE shapes ADD COLUMN new_column VARCHAR(255);
CREATE TABLE product_types (
    id INTEGER NOT NULL AUTO_INCREMENT, 
    name VARCHAR(255) NOT NULL, 
    created_at TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0), 
    UNIQUE INDEX product_types_name_key(name), 
    PRIMARY KEY (id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
