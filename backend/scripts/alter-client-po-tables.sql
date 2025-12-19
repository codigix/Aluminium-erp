-- Alter Client PO Drawings table to fix column size issues
ALTER TABLE client_po_drawings MODIFY COLUMN drawing_no VARCHAR(255);
ALTER TABLE client_po_drawings MODIFY COLUMN revision VARCHAR(255);
ALTER TABLE client_po_drawings MODIFY COLUMN description VARCHAR(1000);

-- Alter Client PO Commercials table to fix column size issues
ALTER TABLE client_po_commercials MODIFY COLUMN payment_terms VARCHAR(1000);

-- Alter Client PO Terms table to fix column size issues
ALTER TABLE client_po_terms MODIFY COLUMN payment_terms_description VARCHAR(2000);
ALTER TABLE client_po_terms MODIFY COLUMN delivery_schedule VARCHAR(2000);
ALTER TABLE client_po_terms MODIFY COLUMN packing_instructions VARCHAR(2000);
ALTER TABLE client_po_terms MODIFY COLUMN special_remarks VARCHAR(2000);
ALTER TABLE client_po_terms MODIFY COLUMN quality_standards VARCHAR(2000);
ALTER TABLE client_po_terms MODIFY COLUMN warranty_terms VARCHAR(2000);
