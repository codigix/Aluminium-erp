-- Fix incorrect foreign key constraint on payments table
USE sales_erp;

-- Drop the old constraint that incorrectly references companies
ALTER TABLE payments DROP FOREIGN KEY payments_ibfk_1;

-- Add the correct constraint that references vendors
ALTER TABLE payments ADD CONSTRAINT payments_vendor_id_fk FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;
