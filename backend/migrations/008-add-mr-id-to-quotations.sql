\"ALTER TABLE quotations ADD COLUMN mr_id INT AFTER sales_order_id; ALTER TABLE quotations ADD CONSTRAINT fk_quotations_mr FOREIGN KEY (mr_id) REFERENCES material_requests(id) ON DELETE SET NULL;\" 
