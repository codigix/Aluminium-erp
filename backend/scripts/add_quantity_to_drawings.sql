ALTER TABLE client_po_drawings ADD COLUMN quantity DECIMAL(10, 2) DEFAULT 1;
ALTER TABLE client_po_drawings ADD COLUMN unit VARCHAR(20) DEFAULT 'NOS';
