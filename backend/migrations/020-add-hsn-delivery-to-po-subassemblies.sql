-- Add HSN Code and Delivery Date to Customer PO Item Subassemblies
ALTER TABLE customer_po_item_subassemblies
ADD COLUMN hsn_code VARCHAR(20) DEFAULT NULL,
ADD COLUMN delivery_date DATE DEFAULT NULL;
