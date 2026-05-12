ALTER TABLE shapes ADD COLUMN public_id VARCHAR(100);
CREATE UNIQUE INDEX shapes_public_id_key ON shapes(public_id);
