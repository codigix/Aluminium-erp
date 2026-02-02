ALTER TABLE sales_order_item_components 
ADD COLUMN ref_bom_type ENUM('FG', 'SUB_ASSEMBLY') DEFAULT 'FG',
ADD COLUMN ref_assembly_id VARCHAR(100);

ALTER TABLE sales_order_item_materials
ADD COLUMN ref_bom_type ENUM('FG', 'SUB_ASSEMBLY') DEFAULT 'FG',
ADD COLUMN ref_assembly_id VARCHAR(100);
