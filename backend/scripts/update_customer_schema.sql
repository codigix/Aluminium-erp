ALTER TABLE selling_customer ADD COLUMN contact_person VARCHAR(255);
ALTER TABLE selling_customer ADD COLUMN contact_person_phone VARCHAR(50);
ALTER TABLE selling_customer ADD COLUMN payment_terms_days INT DEFAULT 30;
ALTER TABLE selling_customer ADD COLUMN city VARCHAR(100);
ALTER TABLE selling_customer ADD COLUMN state VARCHAR(100);
ALTER TABLE selling_customer ADD COLUMN postal_code VARCHAR(20);
ALTER TABLE selling_customer ADD COLUMN country VARCHAR(100);
